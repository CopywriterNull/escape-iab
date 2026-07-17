# Shopify-visible A/B tagging via `utm_term`

**Date:** 2026-07-17
**Status:** Approved, ready for implementation
**Scope:** G FUEL and Kaiyo only (per-merchant flag)

## Goal

Make EscapeHatch bucket assignment visible inside the *merchant's own*
Shopify analytics (Sessions / Orders "by UTM term"), without any access to
our dashboard or database. When enabled, an escaped visitor's landing URL
carries `utm_term=escapehatch-a` (escape arm) and a control visitor's carries
`utm_term=escapehatch-b`. The merchant then reads A-vs-B conversion straight
out of Shopify.

`utm_term` is chosen because it is near-universally unused by paid social ad
setups, so a static value creates exactly two clean rows in Shopify's UTM-term
report. It is **only set when absent** — an ad that already populates
`utm_term` is never overwritten, so merchant/attribution-tool reporting
(TripleWhale, Northbeam, etc.) is left intact for those sessions.

## Non-goals

- No dashboard UI to toggle the flag (flip via SQL — YAGNI for two merchants).
- No new beacon event or analytics change on our side.
- No change to the attribution-only stub served to non-IAB UAs.

## Design

### 1. Migration

`supabase/migrations/<ts>_merchant_utm_tagging.sql`:

```sql
alter table merchants
  add column if not exists utm_tagging boolean not null default false;
```

Follows the exact pattern of `escape_threads` / `paid_only`: additive,
defaulted off, safe against the `select *` in the `/s` route while the
migration rolls forward.

Enablement is a **manual post-deploy SQL update** for the two merchants,
matched by domain:

```sql
update merchants set utm_tagging = true
where domain ilike '%gfuel%' or domain ilike '%kaiyo%';
```

(Verify the matched rows before/after; G FUEL and Kaiyo merchant IDs are known
in the ops runbook.)

### 2. `/s/[merchantId]` route

Add alongside the other flags in the `select *` handling:

```ts
let utmTagging = false;
// ...
utmTagging = m.utm_tagging === true; // explicit-true only; missing col => off
```

Pass `utmTagging` into `buildSnippet(...)`. The attribution-only stub
(`buildAttributionOnlySnippet`) is **unchanged** — post-escape URLs already
carry the tag, baked in by the redirect on the IAB side.

### 3. Snippet (`buildSnippet`)

New option `utmTagging?: boolean`, embedded as `UT_TAG` (`"true"`/`"false"`,
default false).

A single helper, invoked in both escape paths right **after** the bucket
(`bk`) is assigned and **before** the escape-destination URL is constructed:

```js
function tagUtm(){
  try{
    if(!UT_TAG||!bk||postEscape)return;      // only when enabled, bucketed, IAB side
    if(qsP.has("utm_term"))return;           // only-if-absent (original query string)
    var tu=new URL(location.href);
    tu.searchParams.set("utm_term","escapehatch-"+bk);
    history.replaceState(null,"",tu.toString());
  }catch(e){}
}
```

Insertion points:
- **IG/Threads path**: immediately after the `bk` assignment block
  (~line 443, before `touchCart()` / `beacon("impression")`).
- **FB/Messenger path**: immediately after its `bk` assignment block
  (~line 339, before `beacon("impression")`).

Ordering guarantees:
- Runs synchronously in `<head>` before Shopify's Web Pixels Manager
  initializes — the **same assumption** the existing fbclid-restore
  `history.replaceState` already depends on — so Shopify records the tagged
  landing URL for **both** buckets in the IAB session.
- The escape-destination URL is built from `location.href` *after* `tagUtm()`
  runs, so bucket-A's Safari session inherits `utm_term=escapehatch-a`
  automatically. No separate stamping of the destination URL is needed.
- Post-escape (`postEscape` / Safari side) is explicitly skipped: `utm_term`
  is already present from the IAB rewrite, and the absent-check would skip it
  anyway.

### Edge cases

| Case | Behavior |
|------|----------|
| Ad already sets `utm_term` | No tag applied anywhere (absent-check on original query string). |
| Forced QA visit (`eh_force=a/b`) | Tagged (`bk` is set). Negligible volume; not worth branching. |
| Our own beacons | IAB-side beacons still report original `ut` (null). Post-escape beacons report `ut=escapehatch-a` — accurate landing-URL truth. |
| Script tag below Shopify pixel | Tagging silently misses that session. Accepted — identical exposure to the existing fbclid-restore. |
| Flag off (all other merchants) | `UT_TAG=false`, helper returns immediately; zero behavior change. |

### 4. Tests

Vitest against `buildSnippet`, matching the existing snippet-test style:

- With `utmTagging: true`, the built snippet contains the `tagUtm` body and the
  `"escapehatch-"+bk` literal.
- With `utmTagging` false/omitted, it does not (or `UT_TAG=false`).
- Assert the only-if-absent guard (`qsP.has("utm_term")`) and the `postEscape`
  guard are present.

(If no `snippet.test.ts` exists yet, create one with these cases.)

## Rollout

1. Apply migration.
2. Deploy.
3. Run the enablement `update` for G FUEL + Kaiyo; verify row count = 2.
4. Snippet edge cache (`s-maxage=3600`) refreshes within the hour, or force
   revalidation the same way settings changes already do.
5. Confirm in each store's Shopify UTM-term report that `escapehatch-a` /
   `escapehatch-b` rows appear on new IAB sessions.
