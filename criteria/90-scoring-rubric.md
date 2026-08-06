# Scoring Rubric

Every home scores **0–5 per criterion**, weighted below, producing a 0–100 total.

**Revised 2026-08-06 after the eight-transcript batch.** Weights now reflect what the transcripts
actually emphasize rather than my generic baseline. `data/rubric.json` mirrors this file and is
what the site computes from — keep the two in sync.

## Why drive time isn't scored

Drive time is a **hard filter** — over 10 minutes is a rejection, not a low score. Within the
radius, closer is still better, so *Location* carries the residual preference. This keeps a
slightly-closer house from beating a much better one on geography alone.

## Weights

| id | Criterion | Weight | A 5 looks like | A 0 looks like |
| --- | --- | --- | --- | --- |
| `foundation` | **Structure & foundation** | 16 | Documented, warrantied prior repair, or engineered foundation; no cracking; positive drainage | Stair-step cracks, sloping floors, slab heave, no engineering history |
| `wildfire` | **Wildfire risk & insurability** | 14 | Outside the WUI, quoted at normal premium, documented defensible space | High-risk zone, $8k+/yr quote, or carriers declining outright |
| `water` | **Water, drainage & flood** | 12 | Slopes away all sides, outside FEMA zone, interior drain tile, dry basement | In flood zone without elevation docs, efflorescence, downspouts at the wall |
| `roof` | **Roof & hail** | 12 | Class 4 impact-resistant, under 5 yrs, permitted, warrantied | 20+ yr roof, hail bruising, carrier on actual-cash-value terms |
| `systems` | **HVAC / electrical / plumbing / sewer** | 10 | Under 10 yrs, copper or PEX, 200A panel, scoped clean sewer | Aluminum wiring, polybutylene, Federal Pacific panel, failing clay lateral |
| `layout` | **Layout, storage & fit** | 9 | 4 real beds with egress, 3 usable baths, real storage, mud room, flex space | Stranded bath, windowless basement "bedroom", nowhere for gear |
| `value` | **Price vs. value & repair reserve** | 9 | Well under $600k with little deferred maintenance — real cushion left | At the ceiling *and* needs roof, sewer, and drainage work |
| `location` | **Location, orientation & sun** | 8 | Under 6 min, quiet street, south-facing drive, covered patio, protected views | 9–10 min, arterial noise, sloped north-facing drive, uncovered west deck |
| `carrying` | **Carrying costs — HOA, metro district, utilities, taxes** | 5 | No HOA, no metro district, all four services on one CSU bill | Two HOAs plus a metro district, or a private water co-op |
| `radon` | **Radon** | 3 | Mitigation system with a passing post-mitigation test | No test, basement bedrooms, no mitigation |
| `resale` | **Resale position & future supply** | 2 | Built-out area, nothing new competing, protected views | Adjacent land easily subdividable, new builds undercutting resale |
| | **Total** | **100** | | |

## What changed, and why

| Criterion | Was | Now | Driven by |
| --- | --- | --- | --- |
| Wildfire & insurability | 8 | **14** | Biggest revision. `[T05]`: "I'm seeing this kill deals left and right." `[T06]`: $300–600/month added in Mountain Shadows, which is **inside our radius**. `[T04]`: carriers refusing to write at all. This can break the budget before we ever discuss the house. |
| Water, drainage & flood | 10 (as "lot") | **12** | Split flood out of the generic lot score. `[T04]` devotes two of six segments to water; Monument Creek runs through our search area; freeze–thaw mold escalation is fast and expensive. |
| Carrying costs | 3 (as "hoa") | **5** | Broadened. `[T07]`'s utility-district finding (hundreds/month for a private water co-op) and `[T06]`'s metro-district math were both new to me. |
| Layout | 12 | **9** | Still matters, but `[T08]`'s storage/flex-space point is a refinement rather than a top-tier risk. Reduced to fund wildfire. |
| Foundation | 18 | **16** | Still the largest single item — `[T04]` puts it at ~25% of COS homes. Trimmed slightly because a **documented prior repair is a positive**, which makes this more manageable than I first weighted it. |
| Radon | 5 | **3** | **Not mentioned in any of the eight transcripts.** El Paso County is still EPA Zone 1 and it's a real health issue, but it's cheap to mitigate and no source Vince vetted raised it. Kept, lowered, flagged. |
| Resale & future supply | — | **2** (new) | `[T08]`'s headline thesis. Weighted low **on purpose**: every candidate in our radius is built-out west-central, so this is nearly constant across our options — it's a reason to feel good about the area, not a way to separate houses inside it. |

## Reading the totals

| Range | Meaning |
| --- | --- |
| 80–100 | Strong. Tour it, and move quickly if it's real. |
| 65–79 | Solid with known tradeoffs. Tour it, price the fixes first. |
| 50–64 | Only if inventory is thin. Assume real money in repairs. |
| Under 50 | Pass unless something unscored makes it special. |
| `rejected` | Failed a hard parameter. Not a score at all. |

## Unknown ≠ zero

An unresearched criterion is `null` and shows on the site as **"needs verification"** in amber,
never as a zero. A home we haven't dug into must not look worse than one we have and found
wanting. Totals are computed over *known* criteria only and rescaled, and the site displays the
confidence — "78, based on 7 of 11 criteria" — so a thin evaluation is never mistaken for a
thorough one.

## Two scores to get before touring, not after

Both come straight from the transcripts, and both can disqualify a house on their own:

1. **`wildfire` — get the address-specific insurance quote first.** `[T04]` `[T06]` `[T07]`
2. **`water` — pull the FEMA flood map.** `[T04]` `[T06]`

Everything else can wait for a walkthrough. These two can't, because they change what we can
afford to borrow.

## Weight change log

| Date | Change | Driven by |
| --- | --- | --- |
| 2026-08-06 | Initial weights from general COS housing risk | Baseline, pre-transcript |
| 2026-08-06 | Wildfire 8→14, water split to 12, carrying 3→5, layout 12→9, foundation 18→16, radon 5→3, added `resale` | Transcripts T01–T08 |
