# Higgsfield MCP — Imagery handoff for EscapeHatch

A working manual for driving Higgsfield from the MCP to produce brand-consistent, premium imagery for the EscapeHatch marketing site and (later) A/B variants. Read this end-to-end before generating; it encodes the brand, the prompt grammar, and the file pipeline.

---

## 0 · Setup status

- **MCP installed** at user scope via `claude mcp add higgsfield -s user -e ... -- uvx higgsfield-mcp`
- **`uv` / `uvx`** installed at `~/.local/bin`
- **API keys**: placeholder values in `~/.claude.json` — **the user must paste real values** at `platform.higgsfield.ai`:
  - `HIGGSFIELD_API_KEY`
  - `HIGGSFIELD_SECRET`
- **Optional web-backend access** (unlocks Sora 2 / Veo 3 / Flux 2 / Nano Banana Pro inside the MCP) requires two more env vars from the higgsfield.ai web app cookies:
  - `HIGGSFIELD_CLERK_CLIENT` (`__client` cookie, 7-day TTL)
  - `HIGGSFIELD_JWT` (`__session` cookie, 1-min TTL — re-paste each session)
  - Plus: `HIGGSFIELD_ENABLE_WEB_BACKEND=1`

After pasting keys, restart Claude Code. Verify with `list_models` MCP call before generating anything.

---

## 1 · Brand context (must read before prompting)

EscapeHatch is a SaaS for Shopify brands spending on Meta ads. The product reroutes Instagram in-app-browser visitors into Safari before checkout breaks. Site at `escape-iab.vercel.app` (custom domain TBD).

### Visual identity

- **Palette**: cool neutral. Off-white `#fafafa` bg, near-black `#09090b` text, **single blue accent `#4f7cff`**. No terracotta, no warm cream, no second accent.
- **Editorial accent**: `Instrument Serif` italic for emphasis phrases ("how IG opens links").
- **Body**: Geist Sans, Geist Mono for numerics.
- **Reference brands** (the visual neighborhood we're aiming for): Linear, Vercel, Stripe, Cron, Plausible. Clean, restrained, slightly editorial. Not "AI gradients", not warm SaaS purple, not cartoony illustration.
- **Mood**: technical confidence, mild tension (the product is named for a problem). Cool, slightly cinematic, never cute.

### What we are NOT

- ❌ Generic SaaS purple/blue gradients
- ❌ "Diverse team" stock photos
- ❌ 3D-rendered shiny chrome / liquid glass
- ❌ Cartoon illustration sets
- ❌ Anything with garbled fake UI text ("Lorem", "Login here", "Acme Corp")
- ❌ Anything that looks like an OpenAI / Midjourney hero scene (sweeping landscapes, glowing portals, neon cities)

### What we ARE

- ✅ Editorial product photography (single object, dramatic light, void background)
- ✅ Brutalist concrete / matte materials / cold blue rim light
- ✅ Macro detail shots (texture, edge, single physical object)
- ✅ Cinematic motion loops (phone in hand, the moment the IAB closes and Safari opens)
- ✅ Abstract conceptual imagery (a "door" / "vent" / "hatch" / "tunnel" / "escape route" metaphor — handled subtly)

---

## 2 · Model selection — which Higgsfield model for which job

Higgsfield is a **router** — pick the right backing model. Default routing:

| Use case | Model | model_id | Why |
|---|---|---|---|
| Marketing **hero / section background** (cinematic, no text) | **Soul v2** | `higgsfield-ai/soul/standard` | Editorial aesthetic by default; 20+ presets; weakest on text but we'll inline-negate |
| **Product / device mockup** with sharp detail + reflection | **Nano Banana 2** | `nano-banana-2` | Best fidelity on hard surfaces, accepts up to 16 reference images for brand consistency |
| **OG / social share** card (1200×630, must contain logo/text) | **Nano Banana Pro** | `nano-banana-pro` | Only Higgsfield model that renders text reliably |
| **Architecture / environment / abstract** backgrounds | **Seedream v4** | `bytedance/seedream/v4/text-to-image` | Photoreal landscapes + interiors without people |
| **Image-to-video** (hero motion loop, 3–5 s) | **Higgsfield DoP** | `higgsfield-ai/dop/standard` | Purpose-built I2V for product / hero motion |
| **Diagrammatic / infographic** ("how it works" technical illustration) | Hazel (gpt-image-1.5) | `openai-hazel` | Text-correct, infographic-friendly. Or skip Higgsfield entirely — Ideogram is better. |

Routing call: when in doubt, run the prompt against **Soul + Nano Banana 2** in parallel (4 variants each), pick the strongest.

---

## 3 · The MCSLA prompt formula

Every premium Higgsfield prompt follows this order. Skip any optional element, but **do not reorder**.

```
[1 framing/shot size] of [2 specific subject].
[3 environment]. [4 named lighting]. [5 lens / camera].
[6 style anchor]. [7 inline negatives, if needed]. AR [8].
```

### What each slot means

1. **Framing** — `Medium close-up`, `Wide overhead`, `Tight macro`, `3/4 isometric`, `Centered front-on`. Be specific.
2. **Subject** — material, color, condition. Not "phone", use "matte-graphite smartphone with edge-lit display, screen showing a single line of text, no UI". Specify what's wrong / right.
3. **Environment** — concrete, brushed steel, glass tile, void, raw plaster, rough linen. *One* environmental texture.
4. **Lighting** — **locatable, named, directional**. `Cool blue rim light from camera-left, warm tungsten fill from behind`, `single overhead spot, volumetric beam, soft fog`, `morning sun through frosted glass`. Banned: "epic", "stunning", "beautiful", "dynamic", "cinematic" alone.
5. **Lens** — `35mm`, `85mm portrait`, `macro`, `f/1.4 shallow DOF`, `crash zoom`. Soul responds weakly to lens vocab (uses presets), Nano Banana / Seedream respond strongly.
6. **Style anchor** — choose from the approved list in §4. Don't invent.
7. **Inline negatives** — Higgsfield has **no first-class negative_prompt parameter**. Negate inline: `no signage, no text, no people, no logo, no garbled type`.
8. **Aspect ratio** — match the slot. Hero `16:9`, OG `1.91:1` (use `16:9` and crop), background panel `21:9`, square `1:1`, vertical phone mockup `9:16`.

### Banned tokens (waste of budget, don't steer)

- "epic", "stunning", "beautiful", "high-quality", "masterpiece"
- "8k", "4k", "ultra-realistic" (handled by `quality` parameter, not prompt)
- "AI art", "trending on artstation"
- "vibrant colors", "dynamic composition"

---

## 4 · Approved style anchors for EscapeHatch

Use these — they're picked to match the cool-neutral, editorial-but-technical brand. Mix and match within a prompt is fine; do not stray outside the list without approval.

### Film stocks / textures
- `Kodak Portra 400, fine grain`
- `Cinestill 800T, halation around highlights` *(for night/blue mood)*
- `35mm film grain, slight halation`
- `large-format 4x5, sharp edge-to-edge`

### Cinematographers / aesthetic references
- `Roger Deakins lighting` *(cool, geometric, controlled)*
- `Bill Henson palette` *(near-black with single warm pool of light)*
- `Edward Burtynsky composition` *(industrial scale, sharp, blue-grey)*
- `Hiroshi Sugimoto void` *(matte black background, single sharp subject)*

**Avoid**: Wes Anderson (too whimsical), Gregory Crewdson (too narrative), A24 (overused / unspecific).

### Lighting recipes (use verbatim)

| Recipe | Prompt phrase | When |
|---|---|---|
| **Cool void** | `single subject in matte black void, cool blue rim light from upper-left, no fill` | Hero product / abstract |
| **Concrete morning** | `raw concrete environment, warm tungsten key from camera-left, soft cool ambient fill from window` | Atmospheric backgrounds |
| **Volumetric spot** | `centered subject under single overhead beam, volumetric light through soft fog, cold blue ambient` | Pedestal / "spotlight" sections |
| **Edge gloss** | `wet glass surface, single hard rim from behind subject, no front fill, deep shadow` | Product hero |

### Approved palettes (call out by name in prompt)

- `EscapeHatch blue` → `desaturated cobalt #4f7cff, near-black, off-white, no warm tones`
- `Hatch cool` → `cool blue rim with warm tungsten accent in deep shadow, mostly grey-blue`
- `Hatch monochrome` → `cool greyscale, single accent of cobalt blue on one element only`

---

## 5 · Image registry — where each generated asset lives

When generating, name the file after the slot. Save to `public/img/{slot}/` so it's discoverable.

| Slot | File path | Dimensions | Model | Use |
|---|---|---|---|---|
| Hero background (full-bleed behind phones) | `public/img/hero/bg-{variant}.{ext}` | 2560×1440 (16:9) | Soul v2 + DoP for motion loop | Behind `HeroVisual` in `Lander.tsx` |
| Hero motion loop | `public/img/hero/loop-{variant}.mp4` | 1920×1080 5s | DoP I2V (from still) | Optional ambient loop |
| Problem section background | `public/img/problem/bg-{variant}.png` | 2560×1440 | Soul v2 | Behind "the IG tax" section |
| How-it-works section accent | `public/img/how/diagram-{n}.png` | 1600×1200 | Nano Banana 2 | Inline editorial illustration |
| Pricing CTA background | `public/img/pricing/bg.png` | 2560×800 (21:9) | Seedream v4 | Behind "Reclaim 30% of ROAS" CTA |
| FAQ heading accent | `public/img/faq/accent.png` | 800×800 (1:1) | Soul v2 | Small editorial accent |
| OG / social share | `app/opengraph-image.tsx` or `public/og-image.png` | 1200×630 | Nano Banana Pro (text-correct) | All social shares |
| Twitter card | `public/twitter-image.png` | 1200×600 | Nano Banana Pro | Twitter |
| Favicon | `app/icon.png` + `app/apple-icon.png` | 512×512 | Generate, hand-trace to SVG | All browsers |
| Dashboard empty states | `public/img/empty/{state}.svg` | Vector | Generate inspiration, hand-build as SVG | Empty funnel / no data states |
| A/B variant heroes | `public/img/hero/v{n}-{name}.png` | 2560×1440 | Soul / Nano Banana | A/B test alternates |

**Naming convention**: `kebab-case`, `{slot}-{descriptor}-{variant}.{ext}`. Examples: `hero-bg-concrete-cool.png`, `pricing-bg-spotlight.png`, `hero-loop-iab-escape-v1.mp4`.

---

## 6 · Premium prompt templates (copy-paste ready)

### Template A — Hero background, "concrete void" mood

```
Wide cinematic frame of a single matte-graphite smartphone tilted 30 degrees,
floating against a raw concrete environment. Cool blue rim light from camera-left,
deep shadow on the right, no fill. 50mm lens, sharp edge-to-edge, shallow DOF
falloff at the back. Kodak Portra 400 grain, Roger Deakins lighting, Hatch cool
palette. No signage, no text, no garbled UI, no logo. AR 16:9.
```
Models: Soul v2 (primary), Nano Banana 2 (variant). Negative inline. Run 4 variants seed unset, lock winning seed.

### Template B — Pricing CTA background, "volumetric beam"

```
Centered overhead view of an empty concrete room, single ceiling spotlight
casting a sharp volumetric beam through soft fog onto a circular pedestal.
Cold blue ambient fill, no warm tones. Symmetrical framing, brutalist
architecture. 35mm lens, deep DOF. Bill Henson palette, Hatch monochrome.
No people, no text, no signage. AR 21:9.
```
Model: Seedream v4. This is "object on pedestal" SaaS imagery — versatile under any CTA.

### Template C — Problem section, "the broken checkout" abstract

```
Tight macro of cracked glass surface, single sharp fissure running diagonally
across the frame, faint cobalt-blue light bleeding through the crack from
behind. Matte black background beyond the crack. Volumetric dust particles
in the rim light. 100mm macro lens, f/2.8, razor-thin focus on the
crack edge. Edward Burtynsky composition, EscapeHatch blue. No text,
no people. AR 16:9.
```
Model: Soul v2. Subtle metaphor for "broken checkout."

### Template D — OG / social share card

```
Centered composition: matte-titanium device leaning against raw concrete wall,
small cobalt-blue glow emanating from the screen, single overhead key light,
deep blue-grey ambient. Editorial product photography, large-format 4x5,
sharp edge-to-edge. Empty space top-right for headline overlay. Hatch cool
palette. No text, no signage, no garbled type, no logo on device. AR 16:9.
```
Model: Nano Banana Pro (Higgsfield's only text-reliable model, in case we add typography later).
Then overlay the actual brand text via `opengraph-image.tsx` ImageResponse.

### Template E — Hero motion loop (image-to-video, 5s)

Step 1 — generate the still with Template A above (Soul v2).
Step 2 — I2V via DoP with this motion prompt (describe ONLY what changes, not the scene):

```
Slow Robo Arm arc around the device, 30-degree rotation, subtle dust particles
drifting through the rim light, gentle camera breathing. 5 seconds, slow ease.
```
Model: `higgsfield-ai/dop/standard`, quality `turbo`, duration 5s, AR 16:9, image_url = the still from step 1.

### Template F — Abstract "hatch / escape" concept

```
Tight 3/4 isometric of a single matte-black architectural vent on raw concrete
wall, vent slats faintly back-lit by cobalt-blue glow from inside, deep shadow
casting downward. Single hard rim light from camera-right. Brutalist
material study, 85mm lens, f/2, razor focus on vent edge. Hiroshi Sugimoto
void, EscapeHatch blue. No text, no signage. AR 1:1.
```
Model: Soul v2. The "hatch" concept made literal but tasteful.

---

## 7 · Generation workflow (every time)

Repeat this exact pipeline for each slot. **Never skip step 3 (variant pass).**

1. **Pick the slot** from §5. Decide: still / motion / both?
2. **Pick the model** per §2.
3. **Draft the prompt** in MCSLA order (§3) using approved style anchors (§4) or copy a §6 template.
4. **Generate 4 variants, seed unset.** Call the MCP tool 4 times in parallel.
5. **Compare side-by-side.** Pick the strongest. If none works, revise prompt — change ONE slot at a time (lighting recipe, then style anchor, then framing) — and re-run 4 more.
6. **Lock the winning seed** (read from job metadata).
7. **Nudge with seed locked**: small prompt edits (≤3 words) to refine composition.
   - ⚠️ For Soul Mode with `reference_image_urls`, seed locking does NOT work. Generations re-roll. Plan for variation.
8. **For brand consistency across many shots**: build a Mix composite from 2-4 brand-reference stills, pass as `reference_image_urls` to subsequent generations. Or `create_character` once with 20+ refs, then pass `character_id` on every call.
9. **Save the raw output** to `public/img/{slot}/_raw/` (don't commit raw to git — add to `.gitignore`).
10. **Process and ship** per §8.

### When to abort and try a different model

- Soul v2 keeps producing garbled text or signage → switch to **Nano Banana 2** with `no text, no signage` inline negation
- Nano Banana 2 result feels "stock-photo-y" or lifeless → switch to **Soul v2** with a preset
- Both feel synthetic → try **Seedream v4** with environmental anchor language

---

## 8 · Output, optimization, ship

### Format

- **Hero / background stills**: AVIF primary, WebP fallback, JPG legacy. Three sizes via Next `<Image>` `srcset` (1280 / 1920 / 2560 wide).
- **Section accents**: WebP only, single size (matches container).
- **Motion loops**: MP4 H.264 baseline (Safari iOS), MP4 AV1 or WebM VP9 sibling for modern browsers. `<video preload="metadata" autoPlay muted loop playsInline>`.
- **OG card**: PNG 1200×630, < 300KB.

### Pipeline

```bash
# After saving raw output to public/img/{slot}/_raw/{name}.png:
# 1. Optimize for web — install once: npm i -g @squoosh/cli
# 2. Generate AVIF + WebP + JPG (or use Next's built-in optimizer at runtime)
# 3. Commit only the optimized output to public/img/{slot}/{name}.{ext}
```

Or — preferred — let **Next.js Image Optimization** do this at runtime: drop a single high-res PNG at `public/img/{slot}/{name}.png`, reference via `<Image src="/img/{slot}/{name}.png" width={2560} height={1440} />`. Next handles AVIF/WebP/srcset automatically.

### Don't commit

Add to `.gitignore`:
```
public/img/**/_raw/
```

Raw 4K generations are 5-15MB each — bloats the repo. Only ship optimized variants.

---

## 9 · A/B variant generation pattern

When the request is "give me 3 hero variants for A/B testing":

1. Lock a single **base palette + lighting recipe** (Hatch cool, "concrete morning")
2. Vary ONLY one dimension across variants:
   - **Variant 1 (control)**: cinematic abstract (Template C)
   - **Variant 2 (object-on-pedestal)**: Template B mood
   - **Variant 3 (literal hatch metaphor)**: Template F mood
3. Generate all 3 with the **same seed family** (run base, lock seed, then 3 prompt variants on same seed) for visual sibling-ness
4. Name as `hero-bg-v1-control.png`, `hero-bg-v2-pedestal.png`, `hero-bg-v3-hatch.png`
5. Wire into `Lander.tsx` behind a feature flag or URL query (`?v=2`) so we can test without redeploys

---

## 10 · Approval / sanity checklist

Before shipping any generated image to `main`, verify:

- [ ] Palette matches §1 (no rogue warm tones, no second accent)
- [ ] No people / no faces (we don't need people anywhere on the marketing site yet)
- [ ] No fake UI text / garbled signage / logo hallucinations
- [ ] Aspect ratio matches the slot in §5
- [ ] File is <500 KB optimized (or <2 MB for hero AVIF)
- [ ] Renders well on light AND dark theme (test both)
- [ ] Passes the "would this look at home on linear.app?" sniff test
- [ ] Doesn't read as obvious AI (skin texture, eyes, hands — none of these because no people)

If any box fails, regenerate. **Premium-or-don't-ship.**

---

## 11 · Quick reference — common MCP calls

```jsonc
// List available models — run first time per session
{ "tool": "list_models", "params": { "kind": "image" } }

// Generate a hero still — 4 variants in parallel
{ "tool": "generate_image",
  "params": {
    "model_id": "higgsfield-ai/soul/standard",
    "prompt": "<paste Template A>",
    "aspect_ratio": "16:9",
    "quality": "2k"
  } }

// Image-to-video motion loop
{ "tool": "generate_video",
  "params": {
    "model_id": "higgsfield-ai/dop/standard",
    "prompt": "<paste Template E motion-only prompt>",
    "image_url": "<URL of the still from previous step>",
    "duration": 5,
    "quality": "turbo",
    "aspect_ratio": "16:9"
  } }

// Multi-reference brand consistency
{ "tool": "generate_image",
  "params": {
    "model_id": "nano-banana-2",
    "prompt": "<prompt>",
    "reference_image_urls": [
      "https://escape-iab.vercel.app/img/hero/bg-v1.png",
      "https://escape-iab.vercel.app/img/problem/bg-v1.png"
    ],
    "aspect_ratio": "16:9"
  } }
```

---

## 12 · Known failure modes (research-validated)

- **Soul garbles text and signage** — always negate inline (`no text, no signage`); if text is required, use Nano Banana Pro
- **Celebrity faces are deliberately blended** by Higgsfield's safety layer — don't try
- **DoP I2V prompts must NOT re-describe the source image** — describe only what changes (motion, environmental shift, new action)
- **Seed is not applicable in Soul Mode with reference_image_urls** — every call re-rolls
- **Free tier is heavily watermarked** + 150 credits/mo. Plus plan ($39/mo) for unwatermarked + 2,000 credits.

---

## 13 · Next steps after first session

1. Paste real API keys into `~/.claude.json` and restart Claude
2. Run `list_models` to confirm MCP is alive
3. Generate **Template A** (hero background) — 4 variants — review together
4. Iterate on §10 checklist, ship the winner
5. Build Mix composite from final hero to anchor all subsequent generations
6. Generate Templates B–F in sequence, lock palette + lighting across all

---

## Sources

This doc was synthesized from:
- Higgsfield official: MCP product page, Soul intro, DoP preview, Cinema Studio, Marketing Studio, Nano Banana Pro guide, Seedance prompting guide, 20-preset launch
- Community: Chase Jarvis review, 302.AI Soul realism test, SoloSoft 2026 MCP guide, Gaga.art Higgsfield review, Segmind prompt format guide
- Repos: Hikhakk `higgsfield-mcp-unified`, jfikrat `higgsfield-mcp`, geopopos `higgsfield_ai_mcp`, OSideMedia prompt-skill repo
