# Performance Billing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Post-trial billing — flip merchants to a 90/10 split, charge $300 on plan start, then draft monthly review-then-charge Stripe invoices for $300 base + 10% of measured incremental revenue.

**Architecture:** Pure-TS billing math (`src/lib/billing/`) computes incremental revenue from `hourly_funnel_rollups` sums (tiny RPC) + outlier-trimmed purchase rows. A daily cron drafts `billing_invoices` rows and emails the admin; `/admin/billing` shows the math, allows edits, and a Charge click creates an auto-collecting Stripe Invoice. A Stripe webhook settles status. Spec: `docs/superpowers/specs/2026-07-15-performance-billing-design.md`.

**Tech Stack:** Next.js 16 App Router, Supabase (service-role via `getSupabaseAdmin`), Stripe Invoicing (`stripe` npm), Resend (existing `src/lib/email.ts` pattern), vitest (new, unit tests only).

## Global Constraints

- All money is **integer cents**; control RPV is stored as **micro-cents/impression** (integer) in snapshots.
- Rollup windows must use `hour >= date_trunc('hour', p_from) and hour < p_to` (boundary rule from migration `20260711120000_outlier_window_boundary_fix.sql`); raw `escape_events` reads compared against rollups use the same `date_trunc('hour', p_from)` lower bound.
- Outlier trim rule (must match existing RPCs): an order is an outlier iff `value_cents > Q3 + 3*IQR` **and** `value_cents > 8 * median`, applied per bucket, only when the bucket has **≥ 8 orders**. Trim affects revenue only.
- Billing cron is its OWN vercel.json cron entry — never piggyback on `/api/cron/retention`.
- Charging is ALWAYS an explicit operator action except the $300 plan-start invoice (the Start-plan click is that approval).
- Admin surfaces live under `src/app/admin/billing/` and are guarded by the existing admin layout; server actions must re-check `isAdminEmail` themselves.
- New env vars: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`. Email reuses `RESEND_API_KEY`.
- Follow repo conventions: no new UI libraries, Tailwind + CSS vars, plain `fetch`-style minimal dependencies.

---

### Task 1: Vitest + billing math module

**Files:**
- Modify: `package.json` (add vitest devDependency + `test` script)
- Create: `vitest.config.ts`
- Create: `src/lib/billing/math.ts`
- Test: `src/lib/billing/math.test.ts`

**Interfaces:**
- Produces:
  - `trimOutliers(valuesCents: number[]): { keptTotalCents: number; trimmedTotalCents: number; outliers: number[] }`
  - `computeInvoice(input: InvoiceInput): InvoiceComputation`
  - `addOneMonthClamped(d: Date): Date`
  - Types `InvoiceInput`, `InvoiceComputation` (exact shapes below) — later tasks import these from `@/lib/billing/math`.

- [ ] **Step 1: Install vitest and add script**

```bash
cd ~/Desktop/codebase/escape-iab
npm i -D vitest
```

Add to `package.json` scripts: `"test": "vitest run"`.

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: { include: ["src/**/*.test.ts"] },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
});
```

- [ ] **Step 2: Write the failing tests**

Create `src/lib/billing/math.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { addOneMonthClamped, computeInvoice, trimOutliers } from "@/lib/billing/math";

describe("trimOutliers", () => {
  it("returns everything kept when under 8 orders (no trim below min sample)", () => {
    const r = trimOutliers([4000, 4100, 320000]); // $3,200 whale, but n=3
    expect(r.outliers).toEqual([]);
    expect(r.keptTotalCents).toBe(328100);
  });

  it("trims a whale that violates BOTH rules (Q3+3*IQR and 8x median)", () => {
    const base = [3800, 4000, 4100, 4200, 4300, 4400, 4500, 4600];
    const r = trimOutliers([...base, 320000]);
    expect(r.outliers).toEqual([320000]);
    expect(r.keptTotalCents).toBe(base.reduce((a, b) => a + b, 0));
    expect(r.trimmedTotalCents).toBe(320000);
  });

  it("does NOT trim a merely-large order that fails the 8x-median rule", () => {
    const base = [3800, 4000, 4100, 4200, 4300, 4400, 4500, 4600];
    // 11600 = under 8*median (~33200): kept even if > Q3+3*IQR
    const r = trimOutliers([...base, 11600]);
    expect(r.outliers).toEqual([]);
  });
});

describe("computeInvoice", () => {
  const base = {
    impA: 10000,
    trimmedRevACents: 2_000_000, // $20,000
    impB: 1100,
    trimmedRevBCents: 110_000, // $1,000 → control RPV = $1.00
    revSharePct: 10,
    baseFeeCents: 30000,
    baseFeeWaived: false,
  };

  it("computes incremental = revA - impA*controlRPV, fee = base + 10%", () => {
    const r = computeInvoice(base);
    expect(r.controlRpvMicroCents).toBe(100_000_000); // $1.00/imp in micro-cents
    expect(r.counterfactualCents).toBe(1_000_000);
    expect(r.incrementalCents).toBe(1_000_000);
    expect(r.revShareCents).toBe(100_000);
    expect(r.totalCents).toBe(130_000);
  });

  it("floors negative lift at zero (base fee still bills)", () => {
    const r = computeInvoice({ ...base, trimmedRevACents: 500_000 });
    expect(r.incrementalCents).toBe(0);
    expect(r.revShareCents).toBe(0);
    expect(r.totalCents).toBe(30000);
  });

  it("waived base + zero lift = $0 total", () => {
    const r = computeInvoice({ ...base, trimmedRevACents: 0, baseFeeWaived: true });
    expect(r.totalCents).toBe(0);
  });

  it("guards divide-by-zero when control has no impressions", () => {
    const r = computeInvoice({ ...base, impB: 0, trimmedRevBCents: 0 });
    expect(r.controlRpvMicroCents).toBe(0);
    expect(r.incrementalCents).toBe(0); // no control data → never bill lift
    expect(r.totalCents).toBe(30000);
  });
});

describe("addOneMonthClamped", () => {
  it("adds a month normally", () => {
    expect(addOneMonthClamped(new Date("2026-07-15T21:10:00Z")).toISOString()).toBe(
      "2026-08-15T21:10:00.000Z",
    );
  });
  it("clamps Jan 31 → Feb 28 instead of Mar 3", () => {
    expect(addOneMonthClamped(new Date("2026-01-31T12:00:00Z")).toISOString()).toBe(
      "2026-02-28T12:00:00.000Z",
    );
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `Cannot find module '@/lib/billing/math'` (or equivalent).

- [ ] **Step 4: Implement `src/lib/billing/math.ts`**

```ts
// Pure billing math. No I/O — everything here is unit-tested and every
// number that lands on an invoice snapshot is produced by this module.

export type InvoiceInput = {
  impA: number;
  trimmedRevACents: number;
  impB: number;
  trimmedRevBCents: number;
  revSharePct: number; // e.g. 10
  baseFeeCents: number; // e.g. 30000
  baseFeeWaived: boolean;
};

export type InvoiceComputation = {
  controlRpvMicroCents: number; // micro-cents per impression, integer
  counterfactualCents: number;
  incrementalCents: number;
  revShareCents: number;
  baseFeeCents: number; // 0 when waived
  totalCents: number;
};

const MIN_ORDERS_FOR_TRIM = 8;

function quantileSorted(sorted: number[], q: number): number {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

/** Same rule as eh_admin_brand_performance_outliers:
 *  outlier iff value > Q3 + 3*IQR AND value > 8*median; needs >= 8 orders. */
export function trimOutliers(valuesCents: number[]): {
  keptTotalCents: number;
  trimmedTotalCents: number;
  outliers: number[];
} {
  const total = valuesCents.reduce((a, b) => a + b, 0);
  if (valuesCents.length < MIN_ORDERS_FOR_TRIM) {
    return { keptTotalCents: total, trimmedTotalCents: 0, outliers: [] };
  }
  const sorted = [...valuesCents].sort((a, b) => a - b);
  const q1 = quantileSorted(sorted, 0.25);
  const q3 = quantileSorted(sorted, 0.75);
  const median = quantileSorted(sorted, 0.5);
  const cutoff = q3 + 3 * (q3 - q1);
  const outliers = valuesCents.filter((v) => v > cutoff && v > 8 * median);
  const trimmed = outliers.reduce((a, b) => a + b, 0);
  return { keptTotalCents: total - trimmed, trimmedTotalCents: trimmed, outliers };
}

export function computeInvoice(input: InvoiceInput): InvoiceComputation {
  const hasControl = input.impB > 0 && input.trimmedRevBCents >= 0;
  const controlRpvMicroCents = hasControl
    ? Math.round((input.trimmedRevBCents * 1_000_000) / input.impB)
    : 0;
  // No control data → never bill lift (conservative).
  const counterfactualCents = hasControl
    ? Math.round((input.impA * controlRpvMicroCents) / 1_000_000)
    : input.trimmedRevACents;
  const incrementalCents = Math.max(0, input.trimmedRevACents - counterfactualCents);
  const revShareCents = Math.round((incrementalCents * input.revSharePct) / 100);
  const baseFeeCents = input.baseFeeWaived ? 0 : input.baseFeeCents;
  return {
    controlRpvMicroCents,
    counterfactualCents: hasControl ? counterfactualCents : input.trimmedRevACents,
    incrementalCents,
    revShareCents,
    baseFeeCents,
    totalCents: revShareCents + baseFeeCents,
  };
}

/** Anniversary month-add: Jul 15 → Aug 15; Jan 31 → Feb 28 (clamped). */
export function addOneMonthClamped(d: Date): Date {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const day = d.getUTCDate();
  const lastDayNextMonth = new Date(Date.UTC(y, m + 2, 0)).getUTCDate();
  return new Date(
    Date.UTC(y, m + 1, Math.min(day, lastDayNextMonth), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()),
  );
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/lib/billing/math.ts src/lib/billing/math.test.ts
git commit -m "feat(billing): pure billing math (outlier trim, invoice computation) + vitest"
```

---

### Task 2: Migration — billing columns, invoices table, rollup-sums RPC

**Files:**
- Create: `supabase/migrations/20260715120000_performance_billing.sql`

**Interfaces:**
- Produces: `merchants.{stripe_customer_id, billing_status, billing_anchor, base_fee_cents, base_fee_waived, rev_share_pct, billing_setup_token}`, table `billing_invoices`, RPC `eh_billing_rollup_sums(p_merchant uuid, p_from timestamptz, p_to timestamptz)` returning `(bucket text, impressions bigint, revenue_cents bigint)`.

- [ ] **Step 1: Write the migration**

```sql
-- Performance billing: merchant billing fields + invoice ledger + rollup sums RPC.

alter table merchants
  add column if not exists stripe_customer_id text,
  add column if not exists billing_status text not null default 'none'
    check (billing_status in ('none','active','paused')),
  add column if not exists billing_anchor timestamptz,
  add column if not exists base_fee_cents integer not null default 30000,
  add column if not exists base_fee_waived boolean not null default false,
  add column if not exists rev_share_pct numeric not null default 10,
  add column if not exists billing_setup_token text;

create unique index if not exists merchants_billing_setup_token_idx
  on merchants (billing_setup_token) where billing_setup_token is not null;

create table if not exists billing_invoices (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id) on delete cascade,
  kind text not null check (kind in ('plan_start','monthly')),
  period_start timestamptz not null,
  period_end timestamptz not null,
  snapshot jsonb not null default '{}'::jsonb,
  base_fee_cents integer not null default 0,
  rev_share_cents integer not null default 0,
  total_cents integer not null default 0,
  edited boolean not null default false,
  note text,
  status text not null default 'pending_review'
    check (status in ('pending_review','charging','paid','failed','voided')),
  stripe_invoice_id text,
  created_at timestamptz not null default now(),
  charged_at timestamptz
);

create unique index if not exists billing_invoices_period_uidx
  on billing_invoices (merchant_id, period_start, kind);
create index if not exists billing_invoices_status_idx on billing_invoices (status);
create unique index if not exists billing_invoices_stripe_idx
  on billing_invoices (stripe_invoice_id) where stripe_invoice_id is not null;

-- Service-role only (admin pages + cron use getSupabaseAdmin). RLS on, no policies.
alter table billing_invoices enable row level security;

-- Per-bucket impression/revenue sums over an hour-aligned window.
-- Boundary rule: hour >= date_trunc('hour', p_from) AND hour < p_to
-- (matches eh_test_funnel / outlier-window-boundary-fix semantics).
create or replace function eh_billing_rollup_sums(
  p_merchant uuid, p_from timestamptz, p_to timestamptz
) returns table (bucket text, impressions bigint, revenue_cents bigint)
language sql stable security definer set search_path = public as $$
  select r.bucket,
         coalesce(sum(r.impressions), 0)::bigint,
         coalesce(sum(r.revenue_cents), 0)::bigint
  from hourly_funnel_rollups r
  where r.merchant_id = p_merchant
    and r.hour >= date_trunc('hour', p_from)
    and r.hour < p_to
  group by r.bucket
$$;
```

- [ ] **Step 2: Apply to prod via Supabase MCP** (`apply_migration`, project `kfzhbkvbxzlsiqcgaoiw`, name `performance_billing`) — this repo has no local Supabase stack; migrations are applied remotely and the file committed for the record.

- [ ] **Step 3: Verify**

Run via MCP `execute_sql`:
```sql
select eh_billing_rollup_sums('85abf31e-b340-4a57-addf-d667f8b73b40', now() - interval '7 days', now());
```
Expected: two rows (buckets a/b) with sane sums; and `select billing_status, base_fee_cents from merchants limit 1;` returns defaults.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260715120000_performance_billing.sql
git commit -m "feat(billing): merchants billing columns, billing_invoices table, rollup sums RPC"
```

---

### Task 3: Data layer — period metrics + invoice drafting

**Files:**
- Create: `src/lib/billing/data.ts`
- Test: `src/lib/billing/data.test.ts` (pure helpers only)

**Interfaces:**
- Consumes: `trimOutliers`, `computeInvoice`, `addOneMonthClamped`, types from `@/lib/billing/math` (Task 1); `eh_billing_rollup_sums` RPC (Task 2); `getSupabaseAdmin` from `@/lib/supabase/server`.
- Produces:
  - `computePeriodMetrics(sb, merchantId: string, controlFrom: Date, periodStart: Date, periodEnd: Date): Promise<PeriodMetrics>`
  - `buildSnapshot(metrics: PeriodMetrics, comp: InvoiceComputation, merchant: {rev_share_pct: number; base_fee_cents: number; base_fee_waived: boolean}): Record<string, unknown>`
  - `nextMonthlyPeriod(anchor: Date, lastMonthlyEnd: Date | null): { start: Date; end: Date }`
  - Type `PeriodMetrics = { impA: number; impB: number; rawRevACents: number; rawRevBCents: number; trimmedRevACents: number; trimmedRevBCents: number; outliersA: number[]; outliersB: number[] }`

- [ ] **Step 1: Write failing tests for the pure helper**

`src/lib/billing/data.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { nextMonthlyPeriod } from "@/lib/billing/data";

describe("nextMonthlyPeriod", () => {
  const anchor = new Date("2026-07-15T21:00:00Z");
  it("first monthly period starts at the anchor", () => {
    const p = nextMonthlyPeriod(anchor, null);
    expect(p.start.toISOString()).toBe("2026-07-15T21:00:00.000Z");
    expect(p.end.toISOString()).toBe("2026-08-15T21:00:00.000Z");
  });
  it("subsequent periods chain from the last monthly end", () => {
    const p = nextMonthlyPeriod(anchor, new Date("2026-08-15T21:00:00Z"));
    expect(p.start.toISOString()).toBe("2026-08-15T21:00:00.000Z");
    expect(p.end.toISOString()).toBe("2026-09-15T21:00:00.000Z");
  });
});
```

Run: `npm test` → FAIL (module not found).

- [ ] **Step 2: Implement `src/lib/billing/data.ts`**

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  addOneMonthClamped,
  computeInvoice,
  trimOutliers,
  type InvoiceComputation,
} from "@/lib/billing/math";

export type PeriodMetrics = {
  impA: number;
  impB: number;
  rawRevACents: number;
  rawRevBCents: number;
  trimmedRevACents: number;
  trimmedRevBCents: number;
  outliersA: number[];
  outliersB: number[];
};

export function nextMonthlyPeriod(anchor: Date, lastMonthlyEnd: Date | null) {
  const start = lastMonthlyEnd ?? anchor;
  return { start, end: addOneMonthClamped(start) };
}

/** Rev-share window = [periodStart, periodEnd). Control RPV window =
 *  [controlFrom (= billing_anchor, the split flip), periodEnd) — the
 *  running control. Both trimmed. Purchases read must use the same
 *  date_trunc-hour lower bound as the rollup RPC (boundary rule). */
export async function computePeriodMetrics(
  sb: SupabaseClient,
  merchantId: string,
  controlFrom: Date,
  periodStart: Date,
  periodEnd: Date,
): Promise<PeriodMetrics> {
  const [aSums, bSums] = await Promise.all([
    sb.rpc("eh_billing_rollup_sums", {
      p_merchant: merchantId,
      p_from: periodStart.toISOString(),
      p_to: periodEnd.toISOString(),
    }),
    sb.rpc("eh_billing_rollup_sums", {
      p_merchant: merchantId,
      p_from: controlFrom.toISOString(),
      p_to: periodEnd.toISOString(),
    }),
  ]);
  if (aSums.error) throw new Error(`rollup sums (period): ${aSums.error.message}`);
  if (bSums.error) throw new Error(`rollup sums (control): ${bSums.error.message}`);

  type SumRow = { bucket: string; impressions: number; revenue_cents: number };
  const period = Object.fromEntries((aSums.data as SumRow[]).map((r) => [r.bucket, r]));
  const control = Object.fromEntries((bSums.data as SumRow[]).map((r) => [r.bucket, r]));

  const truncHour = (d: Date) => {
    const t = new Date(d);
    t.setUTCMinutes(0, 0, 0);
    return t;
  };

  async function purchaseValues(bucket: "a" | "b", from: Date, to: Date): Promise<number[]> {
    const { data, error } = await sb
      .from("escape_events")
      .select("value_cents")
      .eq("merchant_id", merchantId)
      .eq("event_type", "purchase")
      .eq("in_test", true)
      .eq("bucket", bucket)
      .gte("created_at", truncHour(from).toISOString())
      .lt("created_at", to.toISOString())
      .not("value_cents", "is", null)
      .limit(10000);
    if (error) throw new Error(`purchases ${bucket}: ${error.message}`);
    return (data ?? []).map((r) => r.value_cents as number);
  }

  const [aVals, bVals] = await Promise.all([
    purchaseValues("a", periodStart, periodEnd),
    purchaseValues("b", controlFrom, periodEnd),
  ]);
  const aTrim = trimOutliers(aVals);
  const bTrim = trimOutliers(bVals);

  const rawA = Number(period["a"]?.revenue_cents ?? 0);
  const rawB = Number(control["b"]?.revenue_cents ?? 0);
  return {
    impA: Number(period["a"]?.impressions ?? 0),
    impB: Number(control["b"]?.impressions ?? 0),
    rawRevACents: rawA,
    rawRevBCents: rawB,
    // Rollup revenue minus the trimmed whale total (rollups are the
    // authoritative revenue; raw purchase rows exist only to find whales).
    trimmedRevACents: Math.max(0, rawA - aTrim.trimmedTotalCents),
    trimmedRevBCents: Math.max(0, rawB - bTrim.trimmedTotalCents),
    outliersA: aTrim.outliers,
    outliersB: bTrim.outliers,
  };
}

export function buildSnapshot(
  m: PeriodMetrics,
  comp: InvoiceComputation,
  merchant: { rev_share_pct: number; base_fee_cents: number; base_fee_waived: boolean },
) {
  return {
    ...m,
    ...comp,
    revSharePct: merchant.rev_share_pct,
    baseFeeConfigCents: merchant.base_fee_cents,
    baseFeeWaived: merchant.base_fee_waived,
    computedAt: new Date().toISOString(),
  };
}

export { computeInvoice };
```

- [ ] **Step 3: Run tests** — `npm test` → all PASS. Also `npm run build` to catch type errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/billing/data.ts src/lib/billing/data.test.ts
git commit -m "feat(billing): period metrics (running control, trimmed) + snapshot builder"
```

---

### Task 4: Stripe client + invoice creation

**Files:**
- Modify: `package.json` (`npm i stripe`)
- Create: `src/lib/billing/stripe.ts`

**Interfaces:**
- Produces:
  - `getStripe(): Stripe | null` (null when `STRIPE_SECRET_KEY` unset — mirror the `supabaseConfigured` pattern)
  - `ensureCustomer(stripe, merchant: {id: string; name: string | null; stripe_customer_id: string | null}, sb): Promise<string>` — returns customer id, persists it on the merchant row
  - `createSetupCheckoutSession(stripe, customerId: string, token: string): Promise<{ url: string }>`
  - `chargeInvoice(stripe, opts: { customerId: string; merchantId: string; invoiceRowId: string; lines: { description: string; amountCents: number }[] }): Promise<{ stripeInvoiceId: string }>`

- [ ] **Step 1: Install** — `npm i stripe`

- [ ] **Step 2: Implement `src/lib/billing/stripe.ts`**

```ts
import Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { siteOrigin } from "@/lib/site";

export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
}

export async function ensureCustomer(
  stripe: Stripe,
  merchant: { id: string; name: string | null; stripe_customer_id: string | null },
  sb: SupabaseClient,
): Promise<string> {
  if (merchant.stripe_customer_id) return merchant.stripe_customer_id;
  const customer = await stripe.customers.create({
    name: merchant.name ?? undefined,
    metadata: { merchant_id: merchant.id },
  });
  const { error } = await sb
    .from("merchants")
    .update({ stripe_customer_id: customer.id })
    .eq("id", merchant.id);
  if (error) throw new Error(`persist customer id: ${error.message}`);
  return customer.id;
}

export async function createSetupCheckoutSession(
  stripe: Stripe,
  customerId: string,
  token: string,
): Promise<{ url: string }> {
  const origin = siteOrigin();
  const session = await stripe.checkout.sessions.create({
    mode: "setup",
    customer: customerId,
    payment_method_types: ["card"],
    success_url: `${origin}/billing/setup/${token}/done`,
    cancel_url: `${origin}/billing/setup/${token}`,
  });
  if (!session.url) throw new Error("checkout session has no url");
  return { url: session.url };
}

/** Creates an itemized invoice and auto-collects the saved card.
 *  charge_automatically + explicit pay() so the attempt is immediate and
 *  failures still ride Stripe smart retries. */
export async function chargeInvoice(
  stripe: Stripe,
  opts: {
    customerId: string;
    merchantId: string;
    invoiceRowId: string;
    lines: { description: string; amountCents: number }[];
  },
): Promise<{ stripeInvoiceId: string }> {
  const invoice = await stripe.invoices.create({
    customer: opts.customerId,
    collection_method: "charge_automatically",
    auto_advance: true,
    metadata: { merchant_id: opts.merchantId, billing_invoice_id: opts.invoiceRowId },
  });
  for (const line of opts.lines) {
    if (line.amountCents <= 0) continue;
    await stripe.invoiceItems.create({
      customer: opts.customerId,
      invoice: invoice.id,
      amount: line.amountCents,
      currency: "usd",
      description: line.description,
    });
  }
  const finalized = await stripe.invoices.finalizeInvoice(invoice.id);
  try {
    await stripe.invoices.pay(finalized.id);
  } catch {
    // Card declined etc. — webhook will mark failed; smart retries take over.
  }
  return { stripeInvoiceId: finalized.id };
}
```

- [ ] **Step 3: Verify build** — `npm run build` → compiles clean.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/lib/billing/stripe.ts
git commit -m "feat(billing): stripe client — customers, setup checkout, invoice charging"
```

---

### Task 5: Server actions — setup link, start plan, invoice actions

**Files:**
- Create: `src/app/actions/billing.ts`

**Interfaces:**
- Consumes: Tasks 1–4 exports; `getSupabaseServer`/`getSupabaseAdmin`; `isAdminEmail`; `randomToken` — check `src/lib/uuid.ts` for an existing token helper and reuse the one the `report_token` migration/actions use (see `20260714120000_merchant_report_token.sql` usage); fall back to `crypto.randomUUID().replace(/-/g, "")` only if none exists.
- Produces server actions used by the admin page (Task 8):
  - `generateSetupLink(merchantId: string): Promise<{ url: string } | { error: string }>`
  - `startPerformancePlan(merchantId: string): Promise<{ ok: true } | { error: string }>`
  - `saveInvoiceEdits(invoiceId: string, baseFeeCents: number, revShareCents: number, note: string): Promise<{ ok: true } | { error: string }>`
  - `chargeInvoiceAction(invoiceId: string): Promise<{ ok: true } | { error: string }>`
  - `voidInvoiceAction(invoiceId: string): Promise<{ ok: true } | { error: string }>`
  - `recomputeInvoiceAction(invoiceId: string): Promise<{ ok: true } | { error: string }>`
  - `setBaseFeeWaived(merchantId: string, waived: boolean): Promise<{ ok: true } | { error: string }>`

- [ ] **Step 1: Implement `src/app/actions/billing.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin, getSupabaseServer } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { siteOrigin } from "@/lib/site";
import { computeInvoice } from "@/lib/billing/math";
import { buildSnapshot, computePeriodMetrics } from "@/lib/billing/data";
import { chargeInvoice, ensureCustomer, getStripe } from "@/lib/billing/stripe";

async function requireAdmin(): Promise<{ error: string } | null> {
  const supabase = await getSupabaseServer();
  if (!supabase) return { error: "backend not configured" };
  const { data } = await supabase.auth.getUser();
  if (!data.user || !isAdminEmail(data.user.email)) return { error: "admin only" };
  return null;
}

export async function generateSetupLink(merchantId: string) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const sb = getSupabaseAdmin();
  if (!sb) return { error: "backend not configured" };
  const token = crypto.randomUUID().replace(/-/g, "");
  const { error } = await sb
    .from("merchants")
    .update({ billing_setup_token: token })
    .eq("id", merchantId);
  if (error) return { error: error.message };
  revalidatePath("/admin/billing");
  return { url: `${siteOrigin()}/billing/setup/${token}` };
}

export async function setBaseFeeWaived(merchantId: string, waived: boolean) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const sb = getSupabaseAdmin();
  if (!sb) return { error: "backend not configured" };
  const { error } = await sb
    .from("merchants")
    .update({ base_fee_waived: waived })
    .eq("id", merchantId);
  if (error) return { error: error.message };
  revalidatePath("/admin/billing");
  return { ok: true as const };
}

/** Flip 90/10, anchor billing, charge the month-1 $300 (unless waived).
 *  The operator's click is the approval for this fixed charge. */
export async function startPerformancePlan(merchantId: string) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const sb = getSupabaseAdmin();
  const stripe = getStripe();
  if (!sb || !stripe) return { error: "backend or stripe not configured" };

  const { data: m, error: mErr } = await sb
    .from("merchants")
    .select("id, name, stripe_customer_id, billing_status, base_fee_cents, base_fee_waived")
    .eq("id", merchantId)
    .single();
  if (mErr || !m) return { error: mErr?.message ?? "merchant not found" };
  if (m.billing_status === "active") return { error: "plan already active" };
  if (!m.stripe_customer_id) return { error: "no card on file — send the setup link first" };

  const customer = await stripe.customers.retrieve(m.stripe_customer_id);
  if (customer.deleted || !customer.invoice_settings?.default_payment_method) {
    return { error: "no default payment method — merchant must complete the setup link" };
  }

  const anchor = new Date();
  const { error: upErr } = await sb
    .from("merchants")
    .update({ billing_status: "active", billing_anchor: anchor.toISOString(), ab_split_pct: 90 })
    .eq("id", merchantId);
  if (upErr) return { error: upErr.message };

  const baseFee = m.base_fee_waived ? 0 : m.base_fee_cents;
  const { data: row, error: insErr } = await sb
    .from("billing_invoices")
    .insert({
      merchant_id: merchantId,
      kind: "plan_start",
      period_start: anchor.toISOString(),
      period_end: anchor.toISOString(),
      snapshot: { planStart: true, baseFeeCents: baseFee },
      base_fee_cents: baseFee,
      rev_share_cents: 0,
      total_cents: baseFee,
      status: baseFee > 0 ? "charging" : "voided",
      note: m.base_fee_waived ? "Plan start — base fee waived" : "Plan start — month 1 platform fee",
    })
    .select("id")
    .single();
  if (insErr || !row) return { error: insErr?.message ?? "invoice insert failed" };

  if (baseFee > 0) {
    const { stripeInvoiceId } = await chargeInvoice(stripe, {
      customerId: m.stripe_customer_id,
      merchantId,
      invoiceRowId: row.id,
      lines: [{ description: "EscapeHatch platform fee — month 1", amountCents: baseFee }],
    });
    await sb
      .from("billing_invoices")
      .update({ stripe_invoice_id: stripeInvoiceId, charged_at: new Date().toISOString() })
      .eq("id", row.id);
  }
  revalidatePath("/admin/billing");
  return { ok: true as const };
}

export async function saveInvoiceEdits(
  invoiceId: string,
  baseFeeCents: number,
  revShareCents: number,
  note: string,
) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const sb = getSupabaseAdmin();
  if (!sb) return { error: "backend not configured" };
  if (!Number.isInteger(baseFeeCents) || baseFeeCents < 0) return { error: "bad base fee" };
  if (!Number.isInteger(revShareCents) || revShareCents < 0) return { error: "bad rev share" };
  const { error } = await sb
    .from("billing_invoices")
    .update({
      base_fee_cents: baseFeeCents,
      rev_share_cents: revShareCents,
      total_cents: baseFeeCents + revShareCents,
      edited: true,
      note: note || null,
    })
    .eq("id", invoiceId)
    .eq("status", "pending_review"); // never edit after charge
  if (error) return { error: error.message };
  revalidatePath("/admin/billing");
  return { ok: true as const };
}

export async function chargeInvoiceAction(invoiceId: string) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const sb = getSupabaseAdmin();
  const stripe = getStripe();
  if (!sb || !stripe) return { error: "backend or stripe not configured" };

  const { data: inv, error } = await sb
    .from("billing_invoices")
    .select("id, merchant_id, base_fee_cents, rev_share_cents, total_cents, status, stripe_invoice_id, snapshot, period_start, period_end")
    .eq("id", invoiceId)
    .single();
  if (error || !inv) return { error: error?.message ?? "invoice not found" };
  if (inv.status !== "pending_review" && inv.status !== "failed")
    return { error: `cannot charge from status ${inv.status}` };
  if (inv.stripe_invoice_id && inv.status !== "failed")
    return { error: "already has a stripe invoice" };
  if (inv.total_cents <= 0) return { error: "total is $0 — void it instead" };

  const { data: m } = await sb
    .from("merchants")
    .select("id, name, stripe_customer_id")
    .eq("id", inv.merchant_id)
    .single();
  if (!m?.stripe_customer_id) return { error: "merchant has no stripe customer" };

  await sb.from("billing_invoices").update({ status: "charging" }).eq("id", inv.id);

  const period = `${inv.period_start.slice(0, 10)} → ${inv.period_end.slice(0, 10)}`;
  const snap = (inv.snapshot ?? {}) as { incrementalCents?: number; revSharePct?: number };
  const lines = [
    {
      description: `Performance fee — ${snap.revSharePct ?? 10}% of $${((snap.incrementalCents ?? 0) / 100).toFixed(2)} incremental revenue (${period})`,
      amountCents: inv.rev_share_cents,
    },
    { description: "EscapeHatch platform fee — next period", amountCents: inv.base_fee_cents },
  ];
  const { stripeInvoiceId } = await chargeInvoice(stripe, {
    customerId: m.stripe_customer_id,
    merchantId: m.id,
    invoiceRowId: inv.id,
    lines,
  });
  await sb
    .from("billing_invoices")
    .update({ stripe_invoice_id: stripeInvoiceId, charged_at: new Date().toISOString() })
    .eq("id", inv.id);
  revalidatePath("/admin/billing");
  return { ok: true as const };
}

export async function voidInvoiceAction(invoiceId: string) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const sb = getSupabaseAdmin();
  if (!sb) return { error: "backend not configured" };
  const { error } = await sb
    .from("billing_invoices")
    .update({ status: "voided" })
    .eq("id", invoiceId)
    .in("status", ["pending_review", "failed"]);
  if (error) return { error: error.message };
  revalidatePath("/admin/billing");
  return { ok: true as const };
}

/** Re-pull rollups + purchases and rebuild the snapshot (e.g. after refunds). */
export async function recomputeInvoiceAction(invoiceId: string) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const sb = getSupabaseAdmin();
  if (!sb) return { error: "backend not configured" };
  const { data: inv, error } = await sb
    .from("billing_invoices")
    .select("id, merchant_id, kind, period_start, period_end, status")
    .eq("id", invoiceId)
    .single();
  if (error || !inv) return { error: error?.message ?? "invoice not found" };
  if (inv.status !== "pending_review") return { error: "only pending invoices recompute" };
  if (inv.kind !== "monthly") return { error: "plan-start invoices are fixed" };

  const { data: m } = await sb
    .from("merchants")
    .select("billing_anchor, rev_share_pct, base_fee_cents, base_fee_waived")
    .eq("id", inv.merchant_id)
    .single();
  if (!m?.billing_anchor) return { error: "merchant has no billing anchor" };

  const metrics = await computePeriodMetrics(
    sb,
    inv.merchant_id,
    new Date(m.billing_anchor),
    new Date(inv.period_start),
    new Date(inv.period_end),
  );
  const comp = computeInvoice({
    impA: metrics.impA,
    trimmedRevACents: metrics.trimmedRevACents,
    impB: metrics.impB,
    trimmedRevBCents: metrics.trimmedRevBCents,
    revSharePct: Number(m.rev_share_pct),
    baseFeeCents: m.base_fee_cents,
    baseFeeWaived: m.base_fee_waived,
  });
  const { error: upErr } = await sb
    .from("billing_invoices")
    .update({
      snapshot: buildSnapshot(metrics, comp, {
        rev_share_pct: Number(m.rev_share_pct),
        base_fee_cents: m.base_fee_cents,
        base_fee_waived: m.base_fee_waived,
      }),
      base_fee_cents: comp.baseFeeCents,
      rev_share_cents: comp.revShareCents,
      total_cents: comp.totalCents,
      edited: false,
    })
    .eq("id", inv.id);
  if (upErr) return { error: upErr.message };
  revalidatePath("/admin/billing");
  return { ok: true as const };
}
```

- [ ] **Step 2: Verify build** — `npm run build` → clean.

- [ ] **Step 3: Commit**

```bash
git add src/app/actions/billing.ts
git commit -m "feat(billing): server actions — setup link, start plan, charge/void/edit/recompute"
```

---

### Task 6: Merchant-facing setup pages + Stripe webhook

**Files:**
- Create: `src/app/billing/setup/[token]/page.tsx`
- Create: `src/app/billing/setup/[token]/done/page.tsx`
- Create: `src/app/api/webhooks/stripe/route.ts`

**Interfaces:**
- Consumes: `getStripe`, `ensureCustomer`, `createSetupCheckoutSession` (Task 4); `getSupabaseAdmin`.
- Produces: webhook keeps `billing_invoices.status` + customer default payment method in sync. Uses `stripe.webhooks.constructEvent` with the RAW request body (`await req.text()`), mirroring the Shopify HMAC route's raw-body handling.

- [ ] **Step 1: Setup page — `src/app/billing/setup/[token]/page.tsx`**

Server component: look up merchant by `billing_setup_token`; 404 if none; ensure Stripe customer; create setup Checkout session; `redirect(session.url)`.

```tsx
import { notFound, redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { createSetupCheckoutSession, ensureCustomer, getStripe } from "@/lib/billing/stripe";

export const dynamic = "force-dynamic";

export default async function BillingSetupPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const sb = getSupabaseAdmin();
  const stripe = getStripe();
  if (!sb || !stripe) notFound();
  const { data: m } = await sb
    .from("merchants")
    .select("id, name, stripe_customer_id")
    .eq("billing_setup_token", token)
    .single();
  if (!m) notFound();
  const customerId = await ensureCustomer(stripe, m, sb);
  const { url } = await createSetupCheckoutSession(stripe, customerId, token);
  redirect(url);
}
```

- [ ] **Step 2: Done page — `src/app/billing/setup/[token]/done/page.tsx`**

Simple branded confirmation (reuse `brand` from `@/lib/branding`): "Card saved — you're all set. EscapeHatch bills monthly based on measured incremental revenue; every invoice is itemized." No data access needed.

```tsx
import { brand } from "@/lib/branding";

export default function BillingSetupDone() {
  return (
    <main className="min-h-dvh flex items-center justify-center p-8">
      <div className="max-w-md text-center space-y-3">
        <h1 className="text-xl font-semibold">Card saved — you&apos;re all set</h1>
        <p className="text-sm opacity-70">
          {brand.name} bills monthly based on measured incremental revenue. Every
          invoice is itemized and emailed to you by Stripe.
        </p>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Webhook — `src/app/api/webhooks/stripe/route.ts`**

```ts
import Stripe from "stripe";
import { type NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getStripe } from "@/lib/billing/stripe";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const sb = getSupabaseAdmin();
  if (!stripe || !secret || !sb) return new Response("not configured", { status: 500 });

  const raw = await req.text();
  const sig = req.headers.get("stripe-signature");
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig ?? "", secret);
  } catch {
    return new Response("bad signature", { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.mode === "setup" && session.customer && session.setup_intent) {
      const si = await stripe.setupIntents.retrieve(String(session.setup_intent));
      if (si.payment_method) {
        await stripe.customers.update(String(session.customer), {
          invoice_settings: { default_payment_method: String(si.payment_method) },
        });
      }
    }
  } else if (event.type === "invoice.paid" || event.type === "invoice.payment_failed") {
    const invoice = event.data.object as Stripe.Invoice;
    const rowId = invoice.metadata?.billing_invoice_id;
    const status = event.type === "invoice.paid" ? "paid" : "failed";
    if (rowId) {
      await sb.from("billing_invoices").update({ status }).eq("id", rowId);
    } else if (invoice.id) {
      await sb.from("billing_invoices").update({ status }).eq("stripe_invoice_id", invoice.id);
    }
  }
  return new Response("ok");
}
```

- [ ] **Step 4: Verify build** — `npm run build` → clean.

- [ ] **Step 5: Commit**

```bash
git add src/app/billing src/app/api/webhooks/stripe
git commit -m "feat(billing): merchant card-setup pages + stripe webhook (setup, paid, failed)"
```

---

### Task 7: Billing cron + review email

**Files:**
- Create: `src/app/api/cron/billing/route.ts`
- Modify: `src/lib/email.ts` (add `sendBillingReviewEmail`)
- Modify: `vercel.json` (add cron entry)

**Interfaces:**
- Consumes: `nextMonthlyPeriod`, `computePeriodMetrics`, `buildSnapshot` (Task 3); `computeInvoice` (Task 1); `ADMIN_EMAILS` (`@/lib/admin`); existing Resend send pattern in `src/lib/email.ts`.
- Produces: daily cron drafting `pending_review` monthly invoices, idempotent via the `(merchant_id, period_start, kind)` unique index.

- [ ] **Step 1: Add `sendBillingReviewEmail` to `src/lib/email.ts`**

Follow `sendInviteEmail`'s exact structure (plain fetch to `RESEND_ENDPOINT`, best-effort `SendResult`):

```ts
export async function sendBillingReviewEmail(opts: {
  merchantName: string;
  totalCents: number;
  incrementalCents: number;
  reviewUrl: string;
  to: readonly string[];
}): Promise<SendResult> {
  const dollars = (c: number) => `$${(c / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
  const subject = `Invoice ready for review: ${opts.merchantName} — ${dollars(opts.totalCents)}`;
  const html = `
  <div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#111">
    <div style="font-size:15px;font-weight:600;margin-bottom:24px">${brand.name}</div>
    <h1 style="font-size:20px;margin:0 0 12px">${escapeHtml(opts.merchantName)} — ${dollars(opts.totalCents)}</h1>
    <p style="font-size:14px;line-height:1.6;color:#444;margin:0 0 20px">
      Measured incremental revenue: <strong>${dollars(opts.incrementalCents)}</strong>.
      Nothing charges until you approve it.
    </p>
    <a href="${opts.reviewUrl}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:10px 18px;border-radius:8px">Review &amp; charge</a>
  </div>`;
  return sendViaResend({ to: [...opts.to], subject, html });
}
```

(If `email.ts` doesn't already have a shared `sendViaResend` helper, extract one from `sendInviteEmail`'s fetch block as part of this step — same endpoint, same error shape — rather than duplicating the fetch.)

- [ ] **Step 2: Cron — `src/app/api/cron/billing/route.ts`**

```ts
import { type NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { ADMIN_EMAILS } from "@/lib/admin";
import { sendBillingReviewEmail } from "@/lib/email";
import { siteOrigin } from "@/lib/site";
import { computeInvoice } from "@/lib/billing/math";
import { buildSnapshot, computePeriodMetrics, nextMonthlyPeriod } from "@/lib/billing/data";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return new Response("unauthorized", { status: 401 });
  const sb = getSupabaseAdmin();
  if (!sb) return new Response("not configured", { status: 500 });

  const { data: merchants, error } = await sb
    .from("merchants")
    .select("id, name, billing_anchor, rev_share_pct, base_fee_cents, base_fee_waived")
    .eq("billing_status", "active")
    .not("billing_anchor", "is", null);
  if (error) return new Response(error.message, { status: 500 });

  const results: Record<string, string> = {};
  for (const m of merchants ?? []) {
    try {
      const { data: last } = await sb
        .from("billing_invoices")
        .select("period_end")
        .eq("merchant_id", m.id)
        .eq("kind", "monthly")
        .order("period_end", { ascending: false })
        .limit(1)
        .maybeSingle();
      const anchor = new Date(m.billing_anchor as string);
      const period = nextMonthlyPeriod(anchor, last ? new Date(last.period_end) : null);
      if (period.end > new Date()) {
        results[m.id] = "not due";
        continue;
      }
      const metrics = await computePeriodMetrics(sb, m.id, anchor, period.start, period.end);
      const comp = computeInvoice({
        impA: metrics.impA,
        trimmedRevACents: metrics.trimmedRevACents,
        impB: metrics.impB,
        trimmedRevBCents: metrics.trimmedRevBCents,
        revSharePct: Number(m.rev_share_pct),
        baseFeeCents: m.base_fee_cents,
        baseFeeWaived: m.base_fee_waived,
      });
      const { error: insErr } = await sb.from("billing_invoices").insert({
        merchant_id: m.id,
        kind: "monthly",
        period_start: period.start.toISOString(),
        period_end: period.end.toISOString(),
        snapshot: buildSnapshot(metrics, comp, {
          rev_share_pct: Number(m.rev_share_pct),
          base_fee_cents: m.base_fee_cents,
          base_fee_waived: m.base_fee_waived,
        }),
        base_fee_cents: comp.baseFeeCents,
        rev_share_cents: comp.revShareCents,
        total_cents: comp.totalCents,
        status: comp.totalCents > 0 ? "pending_review" : "voided",
      });
      if (insErr) {
        // 23505 unique violation = already drafted this period; fine.
        results[m.id] = insErr.code === "23505" ? "already drafted" : `error: ${insErr.message}`;
        continue;
      }
      if (comp.totalCents > 0) {
        await sendBillingReviewEmail({
          merchantName: m.name ?? m.id,
          totalCents: comp.totalCents,
          incrementalCents: comp.incrementalCents,
          reviewUrl: `${siteOrigin()}/admin/billing`,
          to: ADMIN_EMAILS,
        });
      }
      results[m.id] = comp.totalCents > 0 ? "drafted" : "auto-voided ($0)";
    } catch (e) {
      results[m.id] = `error: ${e instanceof Error ? e.message : String(e)}`;
    }
  }
  return Response.json({ ok: true, results });
}
```

- [ ] **Step 3: Add the cron to `vercel.json`** (its own entry — never on retention):

```json
{
  "crons": [
    { "path": "/api/cron/retention", "schedule": "17 * * * *" },
    { "path": "/api/cron/billing", "schedule": "0 9 * * *" }
  ]
}
```

- [ ] **Step 4: Verify** — `npm run build` clean, then locally: `curl -s http://localhost:3000/api/cron/billing | head` (dev mode skips auth when CRON_SECRET unset) → `{"ok":true,"results":{}}` (no active merchants yet).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/cron/billing src/lib/email.ts vercel.json
git commit -m "feat(billing): daily invoice-drafting cron + admin review email"
```

---

### Task 8: /admin/billing page

**Files:**
- Create: `src/app/admin/billing/page.tsx` (server component: data fetch)
- Create: `src/app/admin/billing/_components/merchant-row.tsx` (client: setup link, waive, start plan)
- Create: `src/app/admin/billing/_components/invoice-card.tsx` (client: math detail, edit, charge/void/recompute)
- Modify: `src/app/admin/_components/sidebar-nav.tsx` (add "Billing" nav item — match how Performance/Health entries are declared)

**Interfaces:**
- Consumes: every action from Task 5.
- Produces: operator UI. Follow the visual conventions of `src/app/admin/performance/page.tsx` (CSS vars, table/card styles) — read it before writing markup.

- [ ] **Step 1: Server page** — `page.tsx` fetches via `getSupabaseAdmin`:
  - merchants: `id, name, billing_status, billing_anchor, ab_split_pct, stripe_customer_id, billing_setup_token, base_fee_cents, base_fee_waived, rev_share_pct` ordered by name;
  - invoices: all `billing_invoices` ordered `status='pending_review'` first then `created_at desc`, limit 100, joined client-side to merchant names.
  Render: **Pending review** section (invoice cards), **Merchants** table (rows), **History** list. Card-on-file = `stripe_customer_id != null` (show "link sent, awaiting card" when a `billing_setup_token` exists but no customer).

- [ ] **Step 2: Merchant row client component** — buttons wired to Task 5 actions with `useTransition`; "Copy setup link" calls `generateSetupLink` then `navigator.clipboard.writeText(url)`; "Start performance plan" is behind a `confirm()` dialog stating: "Flips to 90/10 and charges $300 now (unless waived). Continue?".

- [ ] **Step 3: Invoice card client component** — shows the snapshot math verbatim:

```
impressions (escape, period)   {snapshot.impA}
trimmed revenue (escape)       ${snapshot.trimmedRevACents/100}
control RPV (running, trimmed) ${snapshot.controlRpvMicroCents/1e6}/visitor   ← from {snapshot.impB} control impressions
counterfactual                 ${snapshot.counterfactualCents/100}
incremental                    ${snapshot.incrementalCents/100}
outliers trimmed               A: {snapshot.outliersA} · B: {snapshot.outliersB}
─────────────────────────────
rev share ({snapshot.revSharePct}%)   [$ editable input]
base fee                              [$ editable input]
total                                 $X,XXX.XX
```

Inputs default to `rev_share_cents`/`base_fee_cents`; Save calls `saveInvoiceEdits`; Charge calls `chargeInvoiceAction` behind `confirm("Charge $X to <merchant>'s card now?")`; Void and Recompute wired likewise. Show `status` badge (pending/charging/paid/failed/voided) and `edited` marker. Failed rows show a Retry button (same `chargeInvoiceAction`).

- [ ] **Step 4: Verify** — `npm run build` clean; `npm run dev`, sign in as admin, open `/admin/billing`: page renders with merchant list, no pending invoices, no console errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/billing src/app/admin/_components/sidebar-nav.tsx
git commit -m "feat(billing): /admin/billing — merchant billing controls + invoice review/charge UI"
```

---

### Task 9: Env wiring + Stripe test-mode end-to-end QA

**Files:**
- Modify: Vercel env (CLI) + local `.env.local`
- No code changes expected; fixes fold back into the task that owns the file.

- [ ] **Step 1: Create a Stripe account/test keys.** In Stripe dashboard (test mode): copy `sk_test_...`. Create a webhook endpoint pointing at the deployed preview URL `/api/webhooks/stripe` with events `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`; copy the signing secret.

- [ ] **Step 2: Set env** — locally in `.env.local` and on Vercel:

```bash
vercel env add STRIPE_SECRET_KEY production   # paste sk_test_... for now
vercel env add STRIPE_WEBHOOK_SECRET production
```

(Also add to `preview` if QA runs on a preview deployment. Redeploy after adding — env changes require redeploy.)

- [ ] **Step 3: E2E in test mode against a low-stakes merchant (Glimmr or a dummy merchant row):**
  1. `/admin/billing` → Copy setup link → open it in an incognito window → Stripe Checkout → card `4242 4242 4242 4242` → lands on the done page.
  2. Verify: merchant row shows card on file (webhook set the default payment method — check Stripe dashboard customer).
  3. Click Start performance plan → confirm → verify: `ab_split_pct=90` in DB, `billing_status='active'`, a `plan_start` invoice row `charging`→`paid` (after webhook), $300 test invoice in Stripe.
  4. Force a monthly draft without waiting a month: `update merchants set billing_anchor = now() - interval '32 days' where id = '<test merchant>';` then `curl -H "Authorization: Bearer $CRON_SECRET" https://<deploy>/api/cron/billing`. Verify: `pending_review` row with a real snapshot, review email arrives.
  5. Open `/admin/billing`, check the math rendering, edit the rev share down $1, Save, Charge → confirm → Stripe invoice created with two line items, auto-paid, row flips to `paid` via webhook.
  6. Failure path: in Stripe, set the customer's default card to test card `4000 0000 0000 0341` (attach via a new setup link run), draft + charge another invoice → row flips to `failed`, Retry button appears.
  7. Reset the test merchant: `update merchants set billing_status='none', billing_anchor=null, ab_split_pct=50 where id='<test merchant>';` and void stray test invoices.

- [ ] **Step 4: Commit any QA fixes** (in the task-owning files), then push.

- [ ] **Step 5: Go-live checklist (do NOT execute without the user):** swap `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` to live-mode values + live webhook endpoint at `getescapehatch.com/api/webhooks/stripe`, redeploy, and only then Start plan on a real merchant.

---

## Self-Review Notes

- Spec coverage: card capture (T4–T6), plan start + day-1 $300 (T5), 90/10 flip (T5 sets `ab_split_pct=90`), running-control trimmed formula (T1/T3), monthly draft + email + review gate (T7/T8), edit/void/recompute (T5/T8), Stripe invoicing auto-collect + retries (T4/T6), snapshot auditability (T3), idempotency (T2 unique index + T7 23505 handling + T5 charge guards), $0 auto-void (T7), own cron entry (T7). No gaps found.
- Type consistency: `InvoiceComputation.baseFeeCents` (0 when waived) flows into `billing_invoices.base_fee_cents`; `snapshot` keys used by the UI (T8) match `buildSnapshot` output (T3).
- Known simplification: control RPV uses rollup revenue minus TS-side whale totals rather than the SQL RPCs — same trim rule, unit-tested, snapshotted.
