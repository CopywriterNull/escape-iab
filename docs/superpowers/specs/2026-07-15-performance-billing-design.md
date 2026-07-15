# Performance Billing (post-trial) — Design

**Date:** 2026-07-15
**Status:** Approved pending user review

## Summary

When a merchant's free trial ends, we flip them to a 90/10 split (90% escaped,
10% running control), charge a $300 base fee that day, and then bill monthly:
$300 base (waivable per merchant) + 10% of measured incremental revenue.
Every monthly charge is drafted by a cron, reviewed/edited by the operator in
`/admin/billing`, and only charged when the operator clicks **Charge** — the
charge then auto-collects against a card the merchant saved once via a setup
link. Payment rail is **Stripe Invoicing** (`collection_method:
charge_automatically`): itemized invoice emails, hosted invoice page, smart
retries and dunning come free.

## Lifecycle

1. **Card capture (before or during trial).** Operator copies a setup link
   from `/admin/billing` and sends it to the merchant.
   `/billing/setup/[token]` (same tokened public-link pattern as `/r/[token]`
   reports — no login) creates/reuses a Stripe Customer and opens Stripe
   Checkout in `setup` mode. Webhook saves `stripe_customer_id` + default
   payment method.
2. **Plan start.** Operator clicks **Start performance plan** on the merchant
   row (disabled until a card is on file). This atomically:
   - sets `ab_split_pct = 90` (snippet already supports arbitrary splits,
     migration 0016),
   - sets `billing_status = 'active'`, `billing_anchor = now()`,
   - creates and immediately charges a $300 base-fee Stripe invoice
     ("Month 1 platform fee") unless `base_fee_waived`. The button click IS
     the approval for this fixed charge.
3. **Monthly cycle (anniversary billing).** Billing period = anchor day →
   same day next month. A daily cron finds active merchants whose period
   ended and drafts an invoice:
   - **Rev share line:** 10% (per-merchant `rev_share_pct`) of the period's
     incremental revenue (formula below).
   - **Base line:** $300 for the *next* period (skipped if waived). The
     day-1 $300 covered month 1, so no double charge.
   - Status `pending_review`; operator notified by email (existing Resend
     lib, `src/lib/email.ts`) with the amount and a link to the invoice.
4. **Review → charge.** Operator opens the invoice in `/admin/billing`, sees
   the full math, may edit line amounts / add a note / recompute the
   snapshot, then clicks **Charge** (creates + finalizes the Stripe invoice,
   auto-collects) or **Void** (skip this period).
5. **Settlement.** `/api/webhooks/stripe` moves the row to `paid` /
   `failed`. Failures ride Stripe smart retries; row shows retry state with
   a manual retry button.

## Incremental revenue formula

For period [start, end), computed from `hourly_funnel_rollups` +
outlier-trimmed revenue (existing `eh_admin_brand_performance_outliers`
mechanics; window on `date_trunc('hour', …)` per the boundary-bug rule):

```
controlRPV   = trimmedRevB / impB      over [billing start (split flip), period end)   ← running control
counterfact  = impA(period) × controlRPV
incremental  = max(0, trimmedRevA(period) − counterfact)
revShare     = rev_share_pct% × incremental
total        = revShare + (base_fee_waived ? 0 : base_fee_cents)
```

The control RPV deliberately uses the whole running 10% control since the
split flip, not just the period's control — a single month of 10% traffic is
too noisy to bill on. All inputs (impA, impB, trimmedRevA, trimmedRevB,
controlRPV, counterfactual, incremental) are snapshotted into the invoice row
so every charge stays auditable after rollups change. Zero/negative lift ⇒
rev share $0 (base fee still bills unless waived; a would-be $0 invoice is
auto-voided, never charged).

## Data model (one migration)

`merchants` — new columns:

| column | type | default |
|---|---|---|
| `stripe_customer_id` | text | null |
| `billing_status` | text | `'none'` (`none` \| `active` \| `paused`) |
| `billing_anchor` | timestamptz | null |
| `base_fee_cents` | int | 30000 |
| `base_fee_waived` | boolean | false |
| `rev_share_pct` | numeric | 10 |
| `billing_setup_token` | text | null (generated on demand) |

`billing_invoices` — new table:

- `id` uuid PK, `merchant_id` FK, `period_start` / `period_end` timestamptz
- `snapshot` jsonb (all formula inputs + computed values)
- `base_fee_cents`, `rev_share_cents`, `total_cents` int (editable copies —
  edits change these, never the snapshot)
- `edited` boolean, `note` text
- `status` text: `pending_review` → `charging` → `paid` | `failed` | `voided`
- `stripe_invoice_id` text, `created_at`, `charged_at`
- UNIQUE (`merchant_id`, `period_start`) — cron idempotency

## Surfaces

- **`/admin/billing`** — merchant list: card status, billing status, waive
  toggle, MTD incremental preview, Start plan / Copy setup link buttons;
  below it, invoice queue (pending first) with expandable math detail,
  editable amounts, Charge / Void / Recompute / Retry.
- **`/billing/setup/[token]`** — merchant-facing card capture → Stripe
  Checkout (setup mode) → success page.
- **`/api/webhooks/stripe`** — `checkout.session.completed`,
  `invoice.paid`, `invoice.payment_failed`. Verified via
  `STRIPE_WEBHOOK_SECRET`.
- **`/api/cron/billing`** — daily; drafts due invoices + sends the review
  email. Own cron entry (lesson learned: don't piggyback on the retention
  cron).

## Dependencies / env

- `stripe` npm package (server-side only).
- Env: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (Vercel prod + local);
  email reuses `RESEND_API_KEY`.

## Error handling

- Cron drafts even when something's off (no card, Stripe down) and flags the
  row — drafting never charges, so it's safe; charging is always an explicit
  operator click.
- Charge action is idempotent: refuses to create a second Stripe invoice if
  `stripe_invoice_id` is already set.
- Webhook is the source of truth for `paid`/`failed`; the UI never assumes.

## Testing

- Unit: formula function (zero lift, negative lift, waived base, edited
  amounts, boundary hours).
- Integration: Stripe test mode end-to-end — setup link → card saved →
  start plan ($300 charges) → seed rollups → cron drafts → edit → charge →
  webhook marks paid; plus a `4000000000000341` failing-card path.
- Manual: run the real flow against PURE/Kaiyo data in test mode before
  pointing at live keys.

## Out of scope (YAGNI)

- Merchant-facing billing portal/history page (Stripe's hosted invoice page
  covers it).
- Proration, mid-cycle plan changes, multiple currencies (all NJS-style rows
  are USD-inferred today).
- Automatic charging with no review — explicitly rejected by operator.
