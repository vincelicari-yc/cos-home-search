# Hard Search Parameters

Set by Vince, 2026-08-06. These are **filters, not scores**. A home failing any one of these
is rejected outright rather than scored low — otherwise a cheap house 25 minutes away
out-scores the right house on the right street.

## Non-negotiable

| Parameter | Value | Notes |
| --- | --- | --- |
| Transaction | Purchase | Not renting |
| Price ceiling | **$600,000** | Under, not "around". Leaves room for the repair reserve below. |
| Bedrooms | **4 minimum** | A basement conforming bedroom counts only with an egress window. |
| Bathrooms | **3 minimum** | A half-bath does not count toward the 3. |
| Drive time to anchor | **10 minutes maximum** | Driving, not straight-line. Measured to 505 Popes Bluff Trail. |

## The anchor

**505 Popes Bluff Trail, Colorado Springs, CO 80907** — YWAM Colorado Springs.
Coordinates `38.8986334, -104.8334325`. Just north of W Garden of the Gods Rd, near the
Centennial Blvd corridor.

Everything is measured from here. Secondary places that matter to daily life:

| Place | Coordinates | Why it matters |
| --- | --- | --- |
| YWAM Colorado Springs | 38.8986, -104.8334 | **The anchor.** Daily. |
| In-N-Out Burger (W Garden of the Gods Rd) | 38.8964, -104.8318 | 0.2 mi from anchor — a landmark for the corridor |
| Kairos Coffee | *needs geocoding* | Regular stop |
| Garden of the Gods Park | 38.8744, -104.8824 | Recreation, trails |

## The 10-minute radius, measured

Actual OSRM driving times from the anchor, computed 2026-08-06 via
`./tools/intake.py --check-neighborhoods`. Cached in `data/drivetimes.json`.

| Neighborhood | Min | Mi | |
| --- | --- | --- | --- |
| Pope's Bluff | 3.0 | 0.7 | ✅ |
| Holland Park | 3.0 | 1.0 | ✅ |
| Vista Grande | 3.3 | 1.3 | ✅ |
| University Park | 4.7 | 1.8 | ✅ |
| Mountain Shadows | 6.6 | 2.6 | ✅ |
| **Rockrimmon (SE, Hawkeye Cir)** | **6.6** | 2.7 | ✅ |
| Pleasant Valley | 7.7 | 3.7 | ✅ |
| Pinecliff | 8.4 | 3.7 | ✅ |
| Kissing Camels | 9.0 | 3.6 | ✅ |
| Woodmen Valley | 9.2 | 5.1 | ✅ |
| **Rockrimmon (central)** | **9.4** | 3.7 | ⚠️ tight in traffic |
| Old Colorado City | 10.0 | 4.8 | ⚠️ right at the line |
| **Peregrine (south edge)** | **10.1** | 4.2 | ❌ just out |
| **Rockrimmon (NW)** | **11.9** | 4.6 | ❌ out |
| Peregrine (main) | 11.2 | 4.5 | ❌ out |
| Cedar Heights | 16.7 | 7.0 | ❌ out |

> **Corrected 2026-08-06 — never treat a neighbourhood as uniform.** I originally wrote that
> "Rockrimmon is outside the radius," based on a single reference point in northwest Rockrimmon
> that measured 11.9 minutes. **That was wrong at the address level.** A real listing at
> 6520 Hawkeye Cir, in southeast Rockrimmon, measures **6.6 minutes** — comfortably inside.
> Re-measuring across the neighbourhood shows it straddles the line: **southeast 6.6, central
> 9.4, northwest 11.9** — roughly five minutes end to end.
>
> **The rule: always run `./tools/intake.py` on the specific address.** A neighbourhood name is
> not a drive time.

Cedar Heights is genuinely far outside — the gated access and winding approach cost far more time
than the 7 miles suggest. Peregrine is out at 11.2, and even its southern edge is 10.1. Pinecliff,
which I expected to be marginal, comes in comfortably at 8.4.

> **Important caveat on these numbers.** OSRM routes at free-flow speed limits with no traffic
> model. Real driving at 8am or 5pm on Garden of the Gods Rd, Centennial, or 30th St will run
> meaningfully longer — commonly 15–25% on this corridor. So treat anything over ~8.5 measured
> minutes as genuinely at risk of breaking the 10-minute rule in practice. Old Colorado City at
> a measured 10.0 is realistically a 12-minute drive at rush hour.
>
> **Before making an offer, drive the route at the hour you'd actually drive it.** No routing
> engine substitutes for that.

**Outside — do not bother:** Briargate, Northgate, Broadmoor, Fountain, Falcon, Powers corridor,
Monument, Black Forest. Plus **Peregrine**, **Cedar Heights**, and **northwest Rockrimmon** per
above — but note southeast and central Rockrimmon ARE in range, so route the address rather than
dismissing the name.

## Budget reality check at $600k

In this specific corridor, under $600k with 4bd/3ba most likely means a **1970s–1980s
split-level, tri-level, or ranch with a finished basement**. That housing stock carries a
predictable cluster of issues, and the transcripts will almost certainly reinforce them:

- Expansive clay soil and foundation movement — the dominant COS structural risk
- Original or second-generation roofs in a severe hail corridor
- Radon (El Paso County is EPA Zone 1 — highest)
- Aluminum branch wiring (roughly 1965–1975 builds)
- Polybutylene or galvanized supply lines
- Cast-iron or clay sewer laterals with root intrusion

**Hold back a repair reserve.** Buying at the full $600k with no cushion is how a good house
becomes a bad purchase. A sensible target is offering at $560–575k and reserving $25–40k for
roof, sewer, radon, and foundation drainage. This gets revisited once the transcripts land.

## Not scored

**Schools.** Homeschool, so district boundaries carry no weight. The site will still display
assigned schools for reference, because they move resale value even when they don't affect
daily life — but they never change a home's score.
