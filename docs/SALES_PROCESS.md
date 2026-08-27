# Sales process — inbound lead to first invoice

Companion to `docs/OPERATIONS.md` (which is canonical for everything post-install).
This doc covers the part before that: a lead hits `#leads`, and what happens next.

The offer never changes, so it isn't restated on every call. It is:

> **Two weeks free.** No card, no contract, no setup fee. Then **$300/mo + 10% of the
> incremental revenue** measured against your own control group, Instagram traffic only.
> No lift in a month = no performance fee. Caps at volume.

---

## The one rule

**Never spend a call on a lead you haven't qualified.** A 30-minute call costs more than
the lead is worth if there's no store, no Instagram traffic, or no ad spend. Qualifying is
a 3-minute desk check (below), and it decides which of three tracks the lead goes down.

---

## Stage 0 — Lead lands (automatic, already built)

`/get-started` → `POST /api/early-access` → Block Kit card in **#leads**, 🔥 flagged when
spend ≥ $50k/mo. Two fields are required: store URL and work email. Everything else is
optional, so expect most leads to arrive thin.

**SLA: first touch within 24 hours.** Inbound intent decays fast — a lead that filled a
form on Tuesday has forgotten you by Friday.

---

## Stage 1 — Qualify (3 minutes, at your desk, before you write anything)

Run these four checks on the store URL. They cost nothing and they route the lead.

| Check | How | Why it matters |
|---|---|---|
| **Is there a real store?** | `curl -sL https://<domain> \| grep -c cdn.shopify.com` | A parked page or a coming-soon splash means there is nothing to install on. |
| **Is it Shopify?** | Same grep, or `Shopify.shop = ` in the HTML | Our install is Shopify-shaped (theme header script, Customer Events pixel, order webhook). Non-Shopify is a bigger lift. |
| **Do they run Meta ads?** | Meta Ad Library, search the brand | No paid IG traffic = no test population = nothing to measure. |
| **Is there IG traffic?** | Their IG follower count + whether ads are live | Under ~5k IG sessions/mo, a two-week test won't reach significance. |

Then bucket:

**Track A — Book the call.** Real Shopify store, live Meta ads, meaningful IG traffic.
This is the only track that gets a calendar link as the primary CTA.

**Track B — Self-serve.** Real store, but small or no paid social. The call costs more
than the account is worth right now. Send them straight to `/get-started` and the case
studies. If they install and the numbers show up, they graduate to Track A on their own.

**Track C — Not yet.** Parked domain, no store, no ads, or an agency shopping around on
behalf of an unnamed client. One short qualifying email. No calendar link, no case-study
dump, no follow-up sequence. If they answer with something real, they re-enter at Stage 1.

Write the track into the `#leads` thread so the next person doesn't re-do the check.

---

## Stage 2 — First touch (same day, from Lenny's Gmail, plain text)

Not a newsletter. Five to seven lines, one link, one question. The shape that works:

1. **Name the leak in their words.** "Your IG ad clicks open inside Instagram's in-app
   browser, where Apple Pay and Shop Pay autofill don't exist."
2. **One number from the closest published case study**, by category, never a portfolio
   average. Protective gear → `/case-studies/rider-protective-gear`. Athletic → `/case-studies/athletic-apparel`.
3. **The offer in one line.** Two weeks free, no card, no contract.
4. **The ask.** Track A gets the booking link. Track B gets `/get-started`. Track C gets a
   question.

House style: no em-dashes, no exclamation marks, no "hope this finds you well", no
attachments, no images. State the result, then the caveat.

### The booking link

Always `getescapehatch.com/book`, never a raw cal.com URL. Built by `src/lib/booking.ts`:

```
https://getescapehatch.com/book?s=<store domain>&e=<their email>&n=<first name>&src=<where>
```

- `s` prefills the booking notes and stamps the store on the booking record, so call prep
  isn't a guess
- `e` and `n` prefill the form, so booking is two clicks instead of a typing exercise
- `n` only when you actually know a person's name. Deriving one from the domain fills
  their form with "Odysseyproductsshop", which is worse than blank
- `src` tags where the link was sent (`followup`, `digest`, `linkinbio`)
- moving calendars is one env var (`NEXT_PUBLIC_CAL_LINK`), not a search across surfaces

---

## Stage 3 — The follow-up cadence (max 4 touches, then stop)

| When | Touch | Content |
|---|---|---|
| Day 0 | Email 1 | Stage 2 above |
| Day 3 | Reply in thread | The category case study, one line, link, re-offer the time |
| Day 7 | Reply in thread | "Want me to just send the install steps instead?" — converts Track A leads who won't take a meeting |
| Day 21 | Reply in thread | Two lines. Closing the file, door open. |

All four in the same Gmail thread. A fifth touch has never converted anyone and costs the
domain reputation.

---

## Stage 4 — The call (30 minutes, screen shared)

Not a deck. The demo is the pitch, run on their own store:

1. **Show the leak.** Open their live product page from inside Instagram on a phone. Show
   the missing Apple Pay sheet and the broken Shop Pay autofill. Then show the escape.
2. **Size it.** Ask what share of Meta spend lands on IG placements, and what their IG
   traffic converts at versus direct. They already have both numbers.
3. **Pre-handle the three gates before they ask** (every call has all three):
   - *Does it break the site?* One header script, sync, before paint. Dev review welcome.
   - *Does it break attribution?* fbclid and every UTM pass through. Triple Whale and
     Northbeam compatible. Nothing gets overwritten.
   - *Is the lift real?* Shopify Customer Events and order webhooks, not Meta's attribution
     window. Permanent control group. Outliers trimmed. Significance before any invoice.
4. **Say the Meta artifact out loud, before it happens.** iOS strips fbclid on the browser
   handoff, so Meta will under-attribute the escaped campaigns and they will look worse in
   Ads Manager while first-party revenue is up. A brand that hears this on day 30 instead
   of day 0 churns. See `project_escapehatch_kaiyo_roas`.
5. **The sleeper benefit.** The store stays open in Safari. Days later they see the brand
   again. Retargeting nobody paid for. Every call that closed mentioned this.
6. **Book the install slot before hanging up.** A call that ends in "send me the docs" has
   a much lower install rate than one that ends with a calendar hold.

Honest range, and it works as copy: most land 20 to 40%, a few much higher, a couple flat.
That is precisely why the trial is free.

---

## Stage 5 — Install (target: within 48h of the call)

Collaborator code, then three things: theme header script (**no `async`**, see
OPERATIONS.md), Customer Events pixel, order webhook. Send the tag from `/dashboard/install`
only. Confirm the first impressions land in `hourly_funnel_rollups` before calling it done.

Split: **50/50 for the first test window**, 90/10 after. The control group stays on
permanently for seasonality.

---

## Stage 6 — Readout and conversion

The ready-to-bill agent gates this: z ≥ 1.96, positive, and ≥ 8 control orders. Do not
pitch a number before the gate clears, and never quote a lift percentage off a control
group with fewer than 8 orders (a +572% off 2 orders nearly went out once).

At the readout: show the split, name the trimmed number, then move to billing. Riley's
structure works when they hesitate on price: collect the $300 now, set the incremental
billing 30 days out so they recoup before they pay for performance.

**No lift?** Say so plainly and offer the exit. It costs one account and buys the honesty
that makes the other numbers believable.

---

## What to do when the lead is an agency

`reviv@digital.com.ph` shape: an agency address on a real brand's store. Treat the brand as
the account and the agency as the buyer. Two extra things:
- Ask who signs and who installs. Agencies rarely have theme access on day one.
- Mention the referral program (`/admin/referrers`) early. An agency with a share of the
  performance fee brings the rest of their roster.
