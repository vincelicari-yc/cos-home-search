# Scoring Rubric

Every home gets scored **0–5 per criterion**, weighted below, producing a 0–100 total.

**These weights are a starting point and will move as transcripts land.** They currently
reflect general Colorado Springs housing risk (see `10-colorado-springs-baseline.md`), not yet
the specific videos Vince found useful. When a transcript makes a strong case that something
matters more or less than this, adjust the weight and note the change at the bottom of this file.

## Why drive time is not scored here

Drive time is a **hard filter** — over 10 minutes and the home is rejected. But within the
radius, closer is still better, so *Location quality* below carries the residual preference
(4 minutes genuinely beats 9). This keeps a slightly-closer house from beating a much better
house purely on geography.

## Weights

| # | Criterion | Weight | What a 5 looks like | What a 0 looks like |
| --- | --- | --- | --- | --- |
| `foundation` | **Structure & foundation** | 18 | Full basement, no visible cracks, documented soil/structural engineer report, positive drainage | Stair-step cracks in foundation, sloping floors, sticking doors, heaved basement slab |
| `roof` | **Roof & hail exposure** | 13 | Class 4 impact-resistant shingles under 5 years old, documented replacement, insurance discount | 20+ year original roof, visible hail bruising, prior claim denied |
| `systems` | **HVAC / electrical / plumbing** | 12 | Furnace + water heater under 10 yrs, copper or PEX, updated 200A panel | Aluminum branch wiring, polybutylene supply, 30-yr furnace, 100A panel at capacity |
| `layout` | **Layout fit for the family** | 12 | 4 real bedrooms with a usable 3rd bath placement, good flow, room to host | Bedrooms split awkwardly across levels, 4th "bedroom" is a windowless basement room |
| `lot` | **Lot, drainage & grading** | 10 | Ground slopes away on all sides, mature trees off the foundation, usable yard | Negative slope to foundation, downspouts dumping at the wall, drainage from uphill neighbor |
| `location` | **Location quality within radius** | 10 | Under 6 min to anchor, quiet street, mountain views, no arterial noise | 9–10 min, backs to Centennial or I-25, no yard privacy |
| `value` | **Price vs. value & repair reserve** | 9 | Well under $600k with little deferred maintenance — real cushion left | At $600k *and* needs roof, sewer, and radon work |
| `wildfire` | **Wildfire & insurability** | 8 | Low-risk zone, defensible space, insurer quotes without surcharge | High-risk foothills interface, insurers declining or surcharging heavily |
| `radon` | **Radon & environmental** | 5 | Existing mitigation system with a passing post-mitigation test | No test, sealed basement bedrooms, no mitigation |
| `hoa` | **HOA / metro district burden** | 3 | No HOA, or low dues with healthy reserves and sane rules | High dues, active special assessment, or a metro district inflating the mill levy |
| | **Total** | **100** | | |

## Reading the totals

| Range | Meaning |
| --- | --- |
| 80–100 | Strong. Tour it, and move quickly if it's real. |
| 65–79 | Solid with known tradeoffs. Tour it, price the fixes first. |
| 50–64 | Only if inventory is thin. Assume real money in repairs. |
| Under 50 | Pass unless something unscored makes it special. |
| `rejected` | Failed a hard parameter. Not a score at all. |

## Unknown ≠ zero

An unresearched criterion is `null`, and shows on the site as **"needs verification"** in
amber — never as a zero. A home we haven't dug into must not look worse than one we have and
found wanting. Totals are computed over *known* criteria only, and the site displays the
confidence (e.g. "78 — based on 7 of 10 criteria") so a thin evaluation is never mistaken
for a thorough one.

## Weight change log

| Date | Change | Driven by |
| --- | --- | --- |
| 2026-08-06 | Initial weights from general COS housing risk | Baseline, pre-transcript |
