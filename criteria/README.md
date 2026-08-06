# Criteria

Distilled, deduplicated checklists — what we look for and why. This is the source of truth for
scoring. Raw transcripts stay local and gitignored; these are our own summaries, in our own words,
with every item tagged to where it came from.

## Tags

| Tag | Meaning |
| --- | --- |
| `[T01]`–`[T08]` | The transcript that item came from. See [`transcripts/00-index.md`](../transcripts/00-index.md). |
| `[BASE]` | Pre-transcript baseline knowledge. **Unconfirmed** — a lead to verify, not a fact. |

Multiple tags on one line means multiple videos agreed, which is real signal. An item carrying
only `[BASE]` after eight transcripts means nobody Vince vetted brought it up.

## Files

| File | What's in it |
| --- | --- |
| [`00-search-parameters.md`](00-search-parameters.md) | The hard filters, the anchor, and measured drive times to every surrounding neighborhood |
| [`10-colorado-springs-baseline.md`](10-colorado-springs-baseline.md) | What's left of the pre-transcript baseline after the transcripts absorbed most of it |
| [`20-deal-breakers.md`](20-deal-breakers.md) | **The core file.** Foundation, wildfire/insurance, flood, drainage/mold, roof/hail, aging systems, utilities, metro districts |
| [`30-our-radius-neighborhoods.md`](30-our-radius-neighborhoods.md) | What the videos say about *our* area specifically — including why most of them don't apply |
| [`40-market-and-negotiation.md`](40-market-and-negotiation.md) | Market data, offer structure, timing, exit strategy |
| [`50-value-and-livability.md`](50-value-and-livability.md) | Sun and orientation, trees, storage, character, what can't be changed |
| [`90-scoring-rubric.md`](90-scoring-rubric.md) | The weights, why each one changed, and how unknowns are handled |

## The four things that matter most

If you read nothing else before touring a house:

1. **Get the insurance quote for the specific address before you tour.** Wildfire premiums run
   $4,500–$8,500/yr in Mountain Shadows — inside our radius — which is $300–600/month on top of
   the mortgage. Some carriers won't write at all. `[T04]` `[T06]` `[T07]`
2. **Pull the FEMA flood map.** Monument Creek runs through our search area. `[T04]`
3. **Foundation is the biggest structural risk** — roughly 25% of COS homes have an issue, and
   clay swells up to 20% in volume. But a **documented, warrantied prior repair is a positive.**
   `[T04]`
4. **Ask for a Class 4 roof, not just "a roof."** 20–30% off the insurance premium every year,
   in a place that gets hail every ~5 years. `[T04]`

## Two structural findings from the batch

**Most of the videos don't apply to us.** Six of eight are north-side focused — Flying Horse,
Cordera, Wolf Ranch, Monument — which is 20–30 minutes away at $800k–$1.5M. Their risk material
and market data transfer completely; their neighborhood picks don't.
See [`30-our-radius-neighborhoods.md`](30-our-radius-neighborhoods.md).

**Our area is on the right side of the market shift.** `[T08]`: *"If you buy in an area where they
can easily build more homes, it will definitely affect your appreciation. Period."* He names
west-side and built-out neighborhoods as the ones to buy. Our whole radius is built-out
west-central with no new-construction pipeline competing against resale. That's an advantage, not
a limitation.

## Adding new criteria

When a new transcript arrives: save it verbatim if possible, extract actionable items into the
right file above, tag with the transcript number, **add the tag to an existing line rather than
duplicating it**, flag contradictions in a `> **Disputed:**` blockquote naming both sides, then
re-score affected homes and say what changed. Full workflow in [`../CLAUDE.md`](../CLAUDE.md).
