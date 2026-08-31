# Escape engine pause — 2026-08-28

All merchants below had `escape_enabled = true` when the escape engine was turned off
globally on 2026-08-28 (IG began prompting "This webpage is trying to open an app
outside of Instagram" on automatic scheme redirects). Tracking beacons keep running.

Restore with:
```sql
update merchants set escape_enabled = true where id in (<ids below>);
```

| Merchant | Domain | id | ab_enabled | billing |
|---|---|---|---|---|
| AnotherVoid | anothervoid.co | 693bc1f9-8681-4201-a2ab-a2f5298874c2 | true | none |
| Elavi | Elavi.com | b970a349-58e1-481f-ac3f-591f0b4daddb | true | none |
| Ember | buyember.co | 1cad3cc0-1c2d-49e9-8f7d-19f24d3ffd47 | true | none |
| G FUEL | gfuel.com | 8b6e80c0-88fd-4c9e-acab-39e21e6d7154 | false | none |
| Glimmr | glimmr.com | 1c36475f-d3c6-46c4-864a-07c69c5a4eda | true | none |
| GroundingCo | thegrounding.co | 72e25faa-d021-4509-86ac-88496496b5b1 | true | none |
| Higround | higround.co | ef40ca5f-e409-4095-a26e-97452dfcc4d9 | true | none |
| Huppy | behuppy.com | e0f18fd2-7d04-4652-ad03-fa9735a84d3f | true | none |
| Jack Henry | jackhenry.co | 4df25ec8-a61b-4506-8d15-3ada9381d826 | true | none |
| LIFX | lifx.com | 952ec747-1805-4bbc-a9af-b7ce5d883ca6 | true | none |
| Menerals | menerals.com | 558f4c7b-f8e4-4bcb-8f1e-cd4410e369e2 | true | none |
| Minicas Studio | minicas.studio | d61d3aa6-95e2-4c9a-80cf-f3ee8311a9f7 | true | none |
| MUDWTR | mudwtr.com | e7570019-2206-4af7-b28f-180ca110c16d | true | none |
| NotJustSundays | notjustsundays.co | be87e9f8-53fa-4ae2-bed7-6c16c7ea62c0 | true | none |
| Odyssey Liquid Chalk | odysseyproductsshop.com | 8d09e8c3-2f4e-4648-a887-927350ee49d4 | true | none |
| Phoilex | phoilex.com | 9a488fc0-1b51-4cdd-abb4-ca5ba6fd4ae1 | true | none |
| PURE Diffuser Co | purediffuserco.com | 85abf31e-b340-4a57-addf-d667f8b73b40 | true | **active** |
| Retropia | retro-pia.com | 158120e7-599b-4c4e-85de-9948670f4d7c | true | none |
| Retropia (dup) | retro-pia.com | 87b831b9-eda5-4f52-9006-91686b68e06e | true | none |
| SimplyRevival | simplyrevival.com | 9041a4e0-8090-496c-8e5c-4552d5d12a88 | true | none |
| SleepWhale | sleepwhale.com | 592a0ca0-6f85-488f-a93c-5919177b6cfe | true | none |
| SquidHaus | gohaus.com | 13658123-4df2-4660-92f8-62e4ad5366fa | false | none |
| TheMumCrew | themumcrew.com | 82f8183d-92ca-4fe2-8890-a303df5bc53f | true | none |
| Vitanics | tryvitanics.com | 343628ca-27f2-402b-8c29-9e4ac13b746a | true | none |

Not in the list (already off before the pause): Cased / ridecased.com, and every `pending` merchant.

## Guided-mode pilots (2026-08-28, later same day)

iOS auto-escape confirmed dead on IG 444 / iOS 26.3.1 (see the
project_escapehatch_ios_escape_dead memory / commit e71912b). These merchants are
re-enabled in **guided** mode (`escape_mode='guided', escape_enabled=true`) — the
overlay's primary CTA is a primed user-tapped `instagram://extbrowser` anchor; the
sheet is unavoidable so we prime it instead of firing silently. Android stays
zero-tap via `intent://`.

| Merchant | Domain | id | billing |
|---|---|---|---|
| PURE Diffuser Co | purediffuserco.com | 85abf31e-b340-4a57-addf-d667f8b73b40 | active |
| Retropia | retro-pia.com | 158120e7-599b-4c4e-85de-9948670f4d7c | none |
| Retropia (dup row) | retro-pia.com | 87b831b9-eda5-4f52-9006-91686b68e06e | none |
| MUDWTR (2026-08-31) | mudwtr.com | e7570019-2206-4af7-b28f-180ca110c16d | none |
| AnotherVoid (2026-08-31) | anothervoid.co | 693bc1f9-8681-4201-a2ab-a2f5298874c2 | none |

**Do not restore:** Glimmr (1c36475f) churned 2026-08-31 — `merchants.status='churned'`
(new status value; the daily digest filters churned merchants out entirely). Skip it
in any bulk restore from the table above.

The remaining merchants from the pause list stay `escape_enabled=false`. Read
`guided_escaped / guided_shown` per pilot before rolling guided out further.
Note: `/s/<id>.js` is served with `cache-control: max-age=3600`, so a mode change
can take up to an hour to fully propagate off Vercel's edge cache.
