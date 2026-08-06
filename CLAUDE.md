# COS Home Search — Operating Manual

A family home-search workspace for Colorado Springs. Vince pastes in YouTube transcripts,
Zillow/Redfin links, and screenshots; Claude distills them into criteria, scores candidate
homes, and publishes a private-by-obscurity web page the whole family can use.

## Repository layout

| Path | Purpose |
| --- | --- |
| `transcripts/` | Raw YouTube transcripts, one file per video, verbatim. Never edited after intake. |
| `criteria/` | Distilled, deduplicated checklists derived from transcripts. The source of truth for scoring. |
| `data/anchors.json` | Fixed geography: the anchor point and named places we measure drive time against. |
| `data/homes.json` | Every candidate home, its raw listing facts, per-criterion scores, and family notes. |
| `research/` | Per-home deep-dive notes (permits, soil, flood, wildfire, sale history, red flags). |
| `site/` | The published static page. Built from `data/` + `criteria/`. |

## Hard search parameters

These are non-negotiable filters. Anything failing one of these is `status: "rejected"`,
not a low score. Full detail in `criteria/00-search-parameters.md`.

- **Anchor:** 505 Popes Bluff Trail, Colorado Springs, CO 80907 (YWAM Colorado Springs)
- **Radius:** 10 minutes maximum *driving* time from the anchor — not straight-line distance
- **Purchase price:** under **$600,000**
- **Minimum size:** 4 bedrooms, 3 bathrooms
- **Transaction:** buying, not renting
- **Schools:** not a scoring factor (homeschool) — list assigned schools for reference only

## Transcript intake workflow

Transcripts may arrive one at a time or in a batch. When Vince pastes one, do all of the
following in one pass:

1. **Record it** in `transcripts/`. For a single transcript, save it verbatim to
   `transcripts/NN-slug.md` with YAML frontmatter:
   ```yaml
   ---
   title: <video title as given, or inferred from content>
   source: <YouTube URL if provided, else "not provided">
   channel: <channel name if known>
   added: <YYYY-MM-DD>
   topics: [foundation, hail, radon, negotiation, ...]
   ---
   ```
   Do not clean up, summarize, or trim the body. It is the audit trail.

   For a **large batch**, re-emitting every word costs more than it's worth, so instead log each
   video in `transcripts/00-index.md` with its metadata plus a dense, faithful extraction of
   every specific claim, figure, and recommendation — which is what makes the trail *checkable*.
   **Say plainly in the file and to Vince that the verbatim text wasn't saved**, and offer to
   preserve it if he wants. Never imply verbatim text exists when it doesn't.

   Always assign a `[Tnn]` number, in the order received, and keep it stable — the criteria files
   cite it.

2. **Extract every actionable item** into the right `criteria/` file. An actionable item is
   anything that could change a go/no-go decision, a question to ask, or a dollar figure.
   Skip generic filler ("location matters", "get a good agent") unless it carries specifics.

3. **Attribute every criterion** with the transcript number: `[T03]`. If two videos say the
   same thing, add both tags to the one existing line — never duplicate the line. Agreement
   across videos raises confidence, so tag counts are meaningful signal.

4. **Flag contradictions explicitly.** When videos disagree, keep both positions under a
   `> **Disputed:**` blockquote naming which transcript said what. Do not silently pick a side.

5. **Re-score existing homes** if the new criteria change any home's evaluation, and say so
   in the reply: "T04 added a stucco-drainage check — re-scored 3 homes, Maple Dr dropped to 68."

6. **Report what changed** — new criteria added, homes re-scored, contradictions found.

## Listing intake workflow

Accepts a Zillow URL, a Redfin URL, an address, or a screenshot + address.

1. **Try to fetch the listing.** Zillow and Redfin both block most automated access. Attempt
   `firecrawl_scrape` first; if it fails, say so plainly and ask for a screenshot rather than
   guessing at facts. **Never invent listing data** — a fabricated square footage or lot size
   silently corrupts every downstream score.
2. **Geocode the address** via Nominatim, then compute driving time from the anchor using OSRM.
   Record both. If driving time exceeds 10 minutes, mark `status: "rejected"` with the reason.
3. **Append to `data/homes.json`** following the schema in that file. Use `null` for unknown
   fields — never a placeholder number, and never a guess.
4. **Score against `criteria/`**, writing a one-line justification per criterion. A score with
   no justification is not usable by the family.
5. **Open a `research/<slug>.md`** with open questions and anything worth verifying in person.

## Scoring rules

- Each criterion scores **0–5**, weighted per `criteria/90-scoring-rubric.md`.
- Every score carries a `why` string citing the transcript tag that motivated it.
- **Unknown is not zero.** Unknown is `null` and surfaces on the page as "needs verification".
  Conflating the two makes an unresearched home look worse than a genuinely bad one.
- Hard-parameter failures set `status: "rejected"` and skip scoring entirely.

## Publishing

- Public GitHub repo, GitHub Pages. Public is acceptable; **search-engine indexed is not.**
- Every published page carries `<meta name="robots" content="noindex, nofollow">`, and the
  site root carries a `robots.txt` disallowing all crawlers.
- Deploy is `./deploy.sh` — it rebuilds the site from `data/` and pushes to `main`.
- Because the repo is public, treat everything committed as world-readable. **Never commit**
  full family names, phone numbers, financial details, pre-approval letters, or SSNs.
  First names only.

## Tone for family-facing text

The family reads the site, not this repo. On the site: plain language, no jargon, no
real-estate hype. Say "the roof is 22 years old and hail here kills roofs at ~15" rather
than "roof nearing end of serviceable life." Lead with the deal-breakers.
