# EscapeHatch — project notes

A 1-page lander + scaffolded backend for a SaaS that escapes Instagram's in-app browser, redirecting visitors to their real browser (Safari / Chrome) before checkout breaks.

Repo: `https://github.com/CopywriterNull/escape-iab`

## Stack

- **Next.js 16.2.6** (App Router, Turbopack, React 19)
- **Tailwind v4** (configured via `@theme inline` in `src/app/globals.css` — no `tailwind.config.*`)
- **TypeScript 5**
- **Supabase** (`@supabase/ssr` + `@supabase/supabase-js`) — wired but env-gated; no project required to run the lander.

`AGENTS.md`: Next 16 has breaking changes. Read `node_modules/next/dist/docs/01-app/...` before assuming APIs. `params` is `Promise<{...}>`; `middleware.ts` is deprecated in favor of `proxy.ts`.

## Status

**Shipped**

- Conversion-focused 1-page lander (`src/app/page.tsx`) — hero, before/after IG-IAB visual, problem stats, how-it-works, features, snippet preview, A/B callout, pricing, FAQ, footer. Dark theme, Inter font, gradient accents.
- Brand constants in `src/lib/branding.ts` — single source of truth so renaming the product is one file.
- Waitlist form (Formspree placeholder — drop in real action URL when ready).
- Production build is clean (`npm run build`).

**Scaffolded but inactive (no env vars = no-op)**

- `supabase/schema.sql` — full DDL: `merchants`, `escape_events`, `daily_rollups`, RLS policies, `eh_increment_rollup` RPC.
- `src/lib/supabase/{server,client}.ts` — SSR + browser clients, both gated on `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- `src/lib/snippet.ts` — `buildSnippet({merchantId, ingestUrl, abEnabled, fallbackButton})`. Generates the storefront-side IIFE that detects IG, A/B-buckets via `eh_b` cookie, fires `instagram://extbrowser/?url=...`, beacons impression / escape_attempt / fallback_shown / fallback_clicked to ingest.
- `src/app/s/[merchantId]/route.ts` — serves the snippet JS, content-type `application/javascript`, edge-cached `s-maxage=300` so we can ship patches fast. Returns 404 with comment body if merchant unknown (when DB is configured).
- `src/app/api/track/route.ts` — telemetry ingest. Validates merchant UUID + event type, hashes IP with `IP_HASH_SALT`, writes raw event + calls `eh_increment_rollup` RPC. CORS open. No-op (logs in dev) if `SUPABASE_SERVICE_ROLE_KEY` unset.

**Not yet built (intentional, per "lander only" scope)**

- Auth pages (`/login`, `/signup`, `/auth/callback`)
- Dashboard (`/dashboard/*`) — install snippet, escape analytics, A/B comparison
- Stripe billing — checkout sessions, webhook, plan enforcement
- Per-merchant settings UI (toggle A/B, toggle fallback button, custom CNAME for Pro)
- Shopify App Embed manifest
- CSP-nonce variant of the snippet

## Routes

| Route | Status | Notes |
| --- | --- | --- |
| `/` | ✅ static | the lander |
| `/api/track` | scaffolded | dynamic; expects POST JSON `{m,t,b,ig,u,r,ts}` |
| `/s/[merchantId]` | scaffolded | dynamic; serves the storefront JS |

## Conventions

- Never `git add -A`. Stage specific files.
- Use absolute paths in subshells: `/usr/bin/git`, `/Users/lennyhuynh/.nvm/versions/node/v22.14.0/bin/npm`.
- `npm run build` after multi-file edits to catch cascading errors.

## Env vars (when activating backend)

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
IP_HASH_SALT=                      # any random string for hashing IPs in events
NEXT_PUBLIC_SITE_URL=              # production domain when assigned
```

To activate the DB: create a Supabase project, run `supabase/schema.sql` in the SQL editor, paste keys into Vercel env, redeploy.

## Open TODOs

- Decide brand name + grab domain (current placeholder: **EscapeHatch / escapehatch.app**). Rename in `src/lib/branding.ts` only.
- Replace Formspree action with real waitlist endpoint (Formspree, Loops, ConvertKit, or own `/api/waitlist`).
- Wire OG image (`src/app/opengraph-image.tsx`) — same `display:flex` gotcha as linkme.
- Wire favicon (`src/app/icon.tsx`).
- Activate backend: see env vars above + run `supabase/schema.sql`.
- Build dashboard once auth is ready.
- Add Stripe scaffolding once pricing is validated with real waitlist signups.
- Investigate Shopify App Embed flow — the App Embed manifest format and `extension.toml` setup; this is the core install UX advantage over copy-paste rivals.
- "Andrej Karpathy plugin" — user has referenced this multiple times across linkme + escape-iab sessions. Cannot find a matching skill or plugin in this environment. Asked once already; waiting on clarification (tool name, install path, or a link).

## Significant commits

- initial — bootstrap + lander + scaffolded backend (Supabase clients, snippet endpoint, telemetry ingest, SQL schema)

## Things NOT to chase

- Building the dashboard / auth before the lander has waitlist signups proving demand.
- Adding Stripe before there's a single paying-shaped customer asking to pay.
- Replacing the Supabase scaffolding with another DB. It's already there, RLS is correct, ship it.
- Universal Links / Custom URL Schemes for non-IG IABs. There's no `tiktok://extbrowser` equivalent. The polished fallback overlay is the only realistic recovery path.
