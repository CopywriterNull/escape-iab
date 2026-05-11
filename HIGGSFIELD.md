# Higgsfield — Imagery handoff for EscapeHatch

Working manual for driving Higgsfield from the **official CLI + 4 installed skills** to produce brand-consistent, premium imagery for the EscapeHatch marketing site (and A/B variants). Read end-to-end before generating; this encodes the brand, the model routing, and the file pipeline.

> **Path correction (2026-05-10)**: an earlier version of this doc routed through a community `uvx higgsfield-mcp` wrapper. The official path is the **Higgsfield CLI + skills**, which is what's now installed and documented here. The old MCP entry has been removed from `~/.claude.json`.

---

## 0 · Setup status

### Installed

- **CLI**: `@higgsfield/cli` v0.1.35 (global npm). Binary at `/Users/lennyhuynh/.nvm/versions/node/v22.14.0/bin/higgsfield`. Aliases: `higgs`, `hf`.
- **Skills (4)** installed to `./.agents/skills/` (project-local, universal — Codex, Cursor, Amp, Claude Code, etc.):
  - `higgsfield-generate` — generic image/video gen, Marketing Studio, Virality Predictor
  - `higgsfield-product-photoshoot` — brand product visuals via mode-specific prompt enhancement on GPT Image 2
  - `higgsfield-marketplace-cards` — marketplace listing cards
  - `higgsfield-soul-id` — train / manage Soul Character refs for face identity consistency

### Still required

- **`higgsfield auth login`** — user must run this once (interactive OAuth, opens browser). Verify with `higgsfield account status`.

### How to invoke from Claude

Claude reads the skill SKILL.md files automatically. From a session, say *"generate an image of X"* or *"product photoshoot hero banner"* and the right skill fires. To force a specific skill, prefix with the name: *"using higgsfield-product-photoshoot, generate ..."*.

Direct CLI calls also work — see §11 for one-shot invocations.

---

## 1 · Brand context (must read before prompting)

EscapeHatch is a SaaS for Shopify brands spending on Meta ads. The product reroutes Instagram in-app-browser visitors into Safari before checkout breaks. Site at `escape-iab.vercel.app` (custom domain TBD).

### Visual identity

- **Palette**: cool neutral. Off-white `#fafafa` bg, near-black `#09090b` text, **single blue accent `#4f7cff`**. No terracotta, no warm cream, no second accent.
- **Editorial accent**: `Instrument Serif` italic for emphasis phrases.
- **Body**: Geist Sans, Geist Mono for numerics.
- **Reference brands**: Linear, Vercel, Stripe, Cron, Plausible. Clean, restrained, slightly editorial.
- **Mood**: technical confidence, mild tension (the product is named for a problem). Cool, slightly cinematic, never cute.

### What we are NOT

- ❌ Generic SaaS purple/blue gradients
- ❌ "Diverse team" stock photos
- ❌ 3D-rendered shiny chrome / liquid glass
- ❌ Cartoon illustration sets
- ❌ Anything with fake UI text ("Lorem", "Login here")
- ❌ Anything that looks like an OpenAI / Midjourney hero scene

### What we ARE

- ✅ Editorial product photography (single object, dramatic light, void background)
- ✅ Brutalist concrete / matte materials / cold blue rim light
- ✅ Macro detail shots (texture, edge, single physical object)
- ✅ Cinematic motion loops (phone in hand, the moment IAB closes and Safari opens)
- ✅ Abstract conceptual imagery — "door" / "vent" / "hatch" / "tunnel" / "escape route" — handled subtly

---

## 2 · Model routing — what to use for what

**Per Higgsfield's official skill guidance.** Always run `higgsfield model list --json | jq` to confirm current model IDs before scripting, and `higgsfield model get <jst> --json` to discover model-specific params.

### Image models

| Use case | Model `<jst>` | Why |
|---|---|---|
| **Hero / section background — environments, no people** | `soul_location` | Higgsfield-declared "best in class" for locations/environments. **Default for EscapeHatch backgrounds.** |
| **Cinematic still frame** | `soul_cinematic` | Filmic mood, single-frame |
| **Aesthetic / editorial / lifestyle** | `text2image_soul_v2` | Soul 2.0; UGC + fashion-editorial aesthetic |
| **Default everything else, on-image text, banners, typography, UI** | `gpt_image_2` | High-fidelity general — Higgsfield-declared default |
| **Vector illustration, face edit, complex scene swap** | `seedream_4_5` | Strong for vector / surgical edits |
| **Character / cartoon / stylized / reference-driven** | `nano_banana_2` (hard cases: `nano_banana_pro`) | Strong reference adherence |
| **Fast / cheap iteration** | `z_image` | Throwaway test runs |
| **Brand-quality product imagery (hero banner, lifestyle, Pinterest, ad pack)** | _via_ `higgsfield-product-photoshoot` skill (backend assembles GPT Image 2 prompt) | Don't freehand the prompt — let the photoshoot backend do it |

### Video models

| Use case | Model `<jst>` | Why |
|---|---|---|
| **Default for serious motion (4–15s, multi-shot, image-to-video)** | `seedance_2_0` | SOTA. Don't downgrade unless cheaper is explicitly requested. |
| **Single-plane scene, cheaper** | `kling3_0` | Budget option |
| **Cinema-grade highest fidelity** | `cinema_studio_video_3_0` | When budget is no object |
| **Cheap with strong physics, no audio** | `minimax_hailuo` | Physics-heavy |
| **Fast batch / volume** | `veo_3_1_lite` | Volume |
| **Advertising / commercial / branded ad** | `marketing_studio_video` | Marketing Studio path |

### Analysis

| Use case | Model `<jst>` |
|---|---|
| Score a finished ad's virality / hook / retention | `brain_activity` (Virality Predictor) |

### EscapeHatch-specific routing

| Slot | Model | Skill |
|---|---|---|
| Hero atmospheric background | `soul_location` | `higgsfield-generate` |
| Cinematic mood pieces (problem section) | `soul_cinematic` | `higgsfield-generate` |
| OG card with overlay-ready space + text | `gpt_image_2` | `higgsfield-generate` |
| Abstract / conceptual hatch metaphor | `gpt_image_2` or `soul_location` | `higgsfield-generate` |
| 5-second hero motion loop | `seedance_2_0` (image-to-video) | `higgsfield-generate` |
| Product-like hero banner (if we ever feature a physical device mockup) | mode `hero_banner` | `higgsfield-product-photoshoot` |

---

## 3 · The MCSLA prompt formula (still applies for `higgsfield-generate`)

For Product Photoshoot, **don't write the prompt yourself** — the backend assembles it from mode + minimal inputs. For everything else, use this structure:

```
[1 framing] of [2 specific subject]. [3 environment]. [4 named lighting].
[5 lens / camera]. [6 style anchor]. [7 inline negatives]. AR [8].
```

1. **Framing** — `Medium close-up`, `Wide overhead`, `Tight macro`, `3/4 isometric`, `Centered front-on`
2. **Subject** — material, color, condition. Specific.
3. **Environment** — one texture: concrete, brushed steel, void, raw plaster
4. **Lighting** — locatable, named, directional. `Cool blue rim from camera-left`. Never "epic" / "stunning" / "cinematic" alone.
5. **Lens** — `50mm`, `85mm portrait`, `macro`, `f/1.4 shallow DOF`. Soul models respond weakly; GPT Image 2 / Nano Banana respond strongly.
6. **Style anchor** — film stock, cinematographer, palette (see §4)
7. **Inline negatives** — Higgsfield has **no first-class `negative_prompt` flag**. Negate inline: `no signage, no text, no people, no logo`.
8. **Aspect ratio** — Hero `16:9`, OG `1.91:1` (use `16:9`), background panel `21:9`, vertical phone `9:16`. Pass as `--aspect_ratio 16:9`.

### Banned tokens

`epic` · `stunning` · `beautiful` · `cinematic` (alone) · `dynamic` · `8k` · `4k` (use `--quality`/`--resolution`) · `masterpiece` · `trending on artstation` · `AI art`

---

## 4 · Approved style anchors

Use these — picked to match the cool-neutral editorial-but-technical brand.

### Film stocks / textures

- `Kodak Portra 400, fine grain`
- `Cinestill 800T, halation around highlights` (night/blue mood)
- `35mm film grain, slight halation`
- `large-format 4x5, sharp edge-to-edge`

### Cinematographers / aesthetic references

- `Roger Deakins lighting` — cool, geometric, controlled
- `Bill Henson palette` — near-black with single warm pool
- `Edward Burtynsky composition` — industrial scale, sharp, blue-grey
- `Hiroshi Sugimoto void` — matte black background, single sharp subject

Avoid: Wes Anderson (too whimsical), Gregory Crewdson (too narrative), A24 (overused).

### Lighting recipes

| Recipe | Phrase |
|---|---|
| **Cool void** | `single subject in matte black void, cool blue rim from upper-left, no fill` |
| **Concrete morning** | `raw concrete environment, warm tungsten key from camera-left, soft cool ambient fill from window` |
| **Volumetric spot** | `centered subject under single overhead beam, volumetric light through soft fog, cold blue ambient` |
| **Edge gloss** | `wet glass surface, single hard rim from behind subject, no front fill, deep shadow` |

### Palettes (call by name in prompt)

- `EscapeHatch blue` → `desaturated cobalt #4f7cff, near-black, off-white, no warm tones`
- `Hatch cool` → `cool blue rim with warm tungsten accent in deep shadow, mostly grey-blue`
- `Hatch monochrome` → `cool greyscale, single accent of cobalt blue on one element only`

---

## 5 · Image registry — where each generated asset lives

| Slot | File path | Dims | Model | Skill |
|---|---|---|---|---|
| Hero background (full-bleed) | `public/img/hero/bg-{variant}.png` | 2560×1440 (16:9) | `soul_location` | generate |
| Hero motion loop | `public/img/hero/loop-{variant}.mp4` | 1920×1080 5s | `seedance_2_0` from still | generate |
| Problem section bg | `public/img/problem/bg-{variant}.png` | 2560×1440 | `soul_cinematic` | generate |
| How-it-works accent | `public/img/how/diagram-{n}.png` | 1600×1200 | `gpt_image_2` | generate |
| Pricing CTA bg | `public/img/pricing/bg.png` | 2560×800 (21:9) | `soul_location` | generate |
| FAQ heading accent | `public/img/faq/accent.png` | 800×800 (1:1) | `soul_location` | generate |
| OG / social share | `app/opengraph-image.tsx` _or_ `public/og-image.png` | 1200×630 | `gpt_image_2` (text-correct) | generate |
| Twitter card | `public/twitter-image.png` | 1200×600 | `gpt_image_2` | generate |
| Favicon | `app/icon.png` + `app/apple-icon.png` | 512×512 | `gpt_image_2` → hand-trace to SVG | generate |
| Dashboard empty states | `public/img/empty/{state}.svg` | Vector | inspire via gen, hand-build | generate |
| A/B hero variants | `public/img/hero/v{n}-{name}.png` | 2560×1440 | mixed | generate |

Naming: `kebab-case`, `{slot}-{descriptor}-{variant}.{ext}`.

---

## 6 · Premium prompt templates (copy-paste ready)

### Template A — Hero background, "concrete void" mood — `soul_location`

```
Wide cinematic frame of an empty raw-concrete room, single matte-graphite
slab tilted against the back wall. Cool blue rim light from camera-left,
deep shadow on the right, no fill. Volumetric dust in the beam. 50mm
equivalent, sharp edge-to-edge, shallow DOF falloff at the back. Kodak
Portra 400 grain, Roger Deakins lighting, Hatch cool palette. No signage,
no text, no people, no logo. AR 16:9.
```
CLI:
```bash
higgsfield generate create soul_location \
  --prompt "$(cat <<'EOF'
Wide cinematic frame of an empty raw-concrete room, single matte-graphite slab tilted against the back wall. Cool blue rim light from camera-left, deep shadow on the right, no fill. Volumetric dust in the beam. 50mm equivalent, sharp edge-to-edge, shallow DOF falloff at the back. Kodak Portra 400 grain, Roger Deakins lighting, Hatch cool palette. No signage, no text, no people, no logo.
EOF
)" \
  --aspect_ratio 16:9 \
  --wait
```

### Template B — Pricing CTA bg, "volumetric beam" — `soul_location`

```
Centered overhead view of an empty concrete room, single ceiling spotlight
casting a sharp volumetric beam through soft fog onto a circular pedestal.
Cold blue ambient, no warm tones. Symmetrical framing, brutalist architecture.
Deep DOF. Bill Henson palette, Hatch monochrome. No people, no text. AR 21:9.
```

### Template C — Problem section, "cracked glass" — `soul_cinematic`

```
Tight macro of cracked glass surface, single sharp fissure running diagonally,
faint cobalt-blue light bleeding through the crack from behind. Matte black
background. Volumetric dust in the rim light. 100mm macro, f/2.8, razor-thin
focus on the crack edge. Edward Burtynsky composition, EscapeHatch blue.
No text, no people. AR 16:9.
```

### Template D — OG / social share — `gpt_image_2`

```
Centered editorial composition: matte-titanium device leaning against raw
concrete wall, small cobalt-blue glow emanating from the screen, single
overhead key, deep blue-grey ambient. Empty space top-right reserved for
headline overlay. Hatch cool palette. Large-format 4x5 quality, sharp.
No text on the device, no garbled type, no logo, no signage. AR 16:9.
```
CLI:
```bash
higgsfield generate create gpt_image_2 \
  --prompt "..." --aspect_ratio 16:9 --resolution 2k --wait
```
Then overlay actual brand text via Next.js `opengraph-image.tsx` ImageResponse.

### Template E — Hero motion loop (image-to-video, 5s) — `seedance_2_0`

Step 1: generate still via Template A.
Step 2: pass that still as `--start-image` to `seedance_2_0`. Describe ONLY what changes:

```
Slow Robo Arm arc around the slab, 30-degree rotation, subtle dust particles
drifting through the rim light, gentle camera breathing. 5 seconds, slow ease.
```
CLI:
```bash
higgsfield generate create seedance_2_0 \
  --prompt "Slow Robo Arm arc around the slab, 30-degree rotation, subtle dust particles drifting through the rim light, gentle camera breathing. 5 seconds, slow ease." \
  --start-image ./public/img/hero/_raw/bg-concrete-cool.png \
  --duration 5 \
  --aspect_ratio 16:9 \
  --wait
```

### Template F — Abstract "hatch" — `soul_location`

```
Tight 3/4 isometric of a single matte-black architectural vent on raw concrete
wall, vent slats faintly back-lit by cobalt-blue glow from inside, deep shadow
casting downward. Single hard rim from camera-right. Brutalist material study,
85mm-equivalent framing, razor focus on the vent edge. Hiroshi Sugimoto void,
EscapeHatch blue. No text, no signage. AR 1:1.
```

### Template G — Product photoshoot hero banner — `higgsfield-product-photoshoot`

For when we have an actual device or product to feature. Don't write the prompt yourself — backend assembles it.

```bash
higgsfield product-photoshoot create \
  --mode hero_banner \
  --prompt "A matte-graphite smartphone leaning against raw concrete, cool blue rim, no UI on screen" \
  --count 4 \
  --wait
```
Modes available: `product_shot` · `lifestyle_scene` · `closeup_product_with_person` · `moodboard_pin` · **`hero_banner`** · `social_carousel` · `ad_creative_pack` · `virtual_model_tryout` · `conceptual_product` · `restyle`.

---

## 7 · Generation workflow

1. **Pick the slot** from §5. Decide: still / motion / both?
2. **Pick the model** from §2.
3. **Decide which skill to invoke**:
   - General image/video → `higgsfield-generate` skill (or direct `higgsfield generate create`)
   - Brand product image / hero banner with a real device → `higgsfield-product-photoshoot` skill
   - Need same face across many shots → `higgsfield-soul-id` skill first (one-time character training, ~40 credits), then pass `--soul-id <id>` on subsequent generations
4. **Draft the prompt** in MCSLA order (§3) using anchors (§4) or copy a §6 template. **Skip for Product Photoshoot — backend builds it.**
5. **Generate 4 variants.** Call `higgsfield generate create <jst> --prompt "..." --aspect_ratio X --wait` four times in parallel, or pass `--count 4` where supported.
6. **Compare side-by-side, pick the winner.**
7. **If none works**, change ONE slot at a time (lighting → style anchor → framing) and re-run.
8. **For brand consistency across many shots**, train a Soul Character via `higgsfield-soul-id` once (20+ varied reference images, no sunglasses, no heavy shadows), then pass `--soul-id <id>` on every subsequent call.
9. **Save raw output** to `public/img/{slot}/_raw/` (gitignored). Optimized variants commit to `public/img/{slot}/`.
10. **Process and ship** per §8.

---

## 8 · Output, optimization, ship

### Format

- **Hero stills**: drop a single 2k/4k PNG into `public/img/{slot}/{name}.png`. Reference via Next `<Image>` and Next handles AVIF/WebP/srcset at runtime.
- **Section accents**: WebP single-size.
- **Motion loops**: MP4 H.264 baseline (Safari iOS). Add WebM/AV1 sibling for modern. `<video preload="metadata" autoPlay muted loop playsInline>`.
- **OG card**: PNG 1200×630, < 300KB.

### Don't commit raw 4K outputs

Already in `.gitignore`:
```
public/img/**/_raw/
```

---

## 9 · A/B variant pattern

When request is "3 hero variants for A/B testing":

1. Lock a base palette + lighting recipe ("Hatch cool", "concrete morning").
2. Vary ONE dimension across variants:
   - V1 (control): Template C cinematic abstract
   - V2 (pedestal): Template B mood
   - V3 (hatch metaphor): Template F mood
3. Generate all 3 with same seed family — run base, lock seed, then 3 prompt variants on same seed (where seed is honored; Soul models with reference images don't honor seed).
4. Name as `hero-bg-v1-control.png`, `hero-bg-v2-pedestal.png`, `hero-bg-v3-hatch.png`.
5. Wire into `Lander.tsx` behind a `?v=` URL query for A/B without redeploys.

---

## 10 · Approval / sanity checklist

Before shipping to `main`:

- [ ] Palette matches §1 (no rogue warm tones, no second accent)
- [ ] No people / no faces
- [ ] No fake UI text / garbled signage / logo hallucinations
- [ ] Aspect ratio matches the slot
- [ ] File <500KB optimized (or <2MB hero AVIF)
- [ ] Renders well on light AND dark theme
- [ ] Passes "would this look at home on linear.app?" test
- [ ] Doesn't read as obvious AI

---

## 11 · CLI cheatsheet

### Setup / auth

```bash
higgsfield auth login                    # one-time browser OAuth
higgsfield account status                # verify
higgsfield account credits               # current balance
higgsfield workspace list                # billing workspaces
```

### Discover

```bash
higgsfield model list --json | jq '[.[] | {id: .job_set_type, name: .display_name}]'
higgsfield model list --video --json
higgsfield model get soul_location --json
```

### Generate — common patterns

```bash
# Hero background (Soul Location)
higgsfield generate create soul_location \
  --prompt "<paste Template A>" --aspect_ratio 16:9 --wait

# General image (GPT Image 2 default)
higgsfield generate create gpt_image_2 \
  --prompt "..." --aspect_ratio 16:9 --resolution 2k --wait

# Soul 2.0 with reference Soul Character
higgsfield generate create text2image_soul_v2 \
  --prompt "..." --soul-id <soul_ref_id> --quality 2k --wait

# Image-to-video (Seedance 2.0)
higgsfield generate create seedance_2_0 \
  --prompt "<motion-only description>" \
  --start-image ./public/img/hero/_raw/bg-v1.png \
  --duration 5 --aspect_ratio 16:9 --wait

# Brand-quality hero banner (Product Photoshoot)
higgsfield product-photoshoot create \
  --mode hero_banner --prompt "..." --count 4 --wait

# Train a Soul Character (one time, ~40 credits)
higgsfield soul-id create --name "EscapeHatchDevice" --image ./ref1.png --image ./ref2.png ... --wait

# Inspect a finished job
higgsfield generate get <job_id> --json
higgsfield generate list --json
```

### Useful flags (anywhere)

- `--wait` — block until done, print URL on stdout (use this; avoid two-step create→wait)
- `--wait-timeout 20m` — default 10m
- `--json` — raw JSON output (good for chained pipelines / agent context)
- `--aspect_ratio 16:9` (or `21:9`, `1:1`, `9:16`, `2:3`, `3:2`, `4:3`, `3:4`, `2.35:1`)
- `--resolution 1k|2k|4k` (GPT Image 2 / Nano Banana)
- `--quality 1.5k|2k` (Soul 2.0, Soul Cinema)
- `--duration N` (video, 4–15s for Seedance 2.0)
- `--seed N` (where honored — not in Soul Mode with refs)

---

## 12 · Known failure modes

- **Soul garbles text and signage** — always inline-negate (`no text, no signage`); if text is required, use `gpt_image_2`.
- **Celebrities are blended deliberately** — safety layer; don't try.
- **Seedance I2V prompts must NOT re-describe the source image** — describe only what *changes* (motion, environmental shift).
- **Soul Mode + reference images ignores `--seed`** — every call re-rolls.
- **Free tier is heavily watermarked**, 150 credits/mo. Plus plan ($39) for unwatermarked + 2,000 credits.
- **Always validate the latest model first.** Don't downgrade to Seedance 1.5 just because its enums are easier — check Seedance 2.0 first.
- **`--hook_id` / `--setting_id` only valid for `ugc`, `ugc_how_to`, `ugc_unboxing`, `product_review`, `ugc_virtual_try_on`** modes — don't pass them to `marketing_studio_image`.

---

## 13 · First-session ritual

When ready to generate, run:

```bash
higgsfield auth login           # if not done
higgsfield account status       # confirm
higgsfield account credits      # know your budget
```

Then in Claude, paste this:

> Read HIGGSFIELD.md end-to-end. Then use the `higgsfield-generate` skill (or direct `higgsfield generate create soul_location`) to produce 4 variants of Template A (hero background). Show me the URLs side-by-side. We'll pick a winner, lock the seed, and iterate.

---

## 14 · Skills reference

The 4 installed skills (in `./.agents/skills/`) cover the whole surface:

| Skill | When it fires | Underlying model |
|---|---|---|
| `higgsfield-generate` | "generate an image / video", "animate this", "make a clip", "stylize/remix", general gen | Any image/video model, or Marketing Studio if branded |
| `higgsfield-product-photoshoot` | "product photo", "lifestyle", "Pinterest pin", "hero banner", "ad creative", "carousel", "Meta ads" | GPT Image 2 with mode-specific backend prompt enhancement |
| `higgsfield-marketplace-cards` | "Amazon listing", "Etsy card", marketplace product cards | Backend prompt enhancement |
| `higgsfield-soul-id` | "train a face", "consistent character", "Soul Character" | Reference training, returns `soul_id` |

Each skill's `SKILL.md` is the authoritative source for its parameters and workflow — Claude reads it on-demand when the matching trigger words appear. To force a specific skill, prefix your request: *"using higgsfield-product-photoshoot, generate ..."*.

---

## Sources

Drawn from the official skill bundles installed locally:
- `./.agents/skills/higgsfield-generate/SKILL.md` (v0.3.0)
- `./.agents/skills/higgsfield-product-photoshoot/SKILL.md` (v0.3.0)
- `./.agents/skills/higgsfield-marketplace-cards/SKILL.md`
- `./.agents/skills/higgsfield-soul-id/SKILL.md`
- Plus Higgsfield CLI built-in help (`higgsfield --help`, `higgsfield <command> --help`)
- Plus prior community research on prompt grammar (MCSLA, style anchors, banned tokens)
