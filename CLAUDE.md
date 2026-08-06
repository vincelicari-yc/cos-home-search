# COS Home Search — Operating Manual

A family home-search workspace for Colorado Springs. Vince pastes in YouTube transcripts,
Zillow/Redfin links, and screenshots; Claude distills them into criteria, scores candidate
homes, and publishes a read-only, private-by-obscurity web page the whole family can use.

## Repository layout

| Path | Purpose |
| --- | --- |
| `transcripts/` | Raw YouTube transcripts, one file per video, verbatim. Never edited after intake. |
| `criteria/` | Distilled, deduplicated checklists derived from transcripts. The source of truth for scoring. |
| `data/anchors.json` | Fixed geography: the anchor point and named places we measure drive time against. |
| `data/homes.json` | Every candidate home, its raw listing facts, per-criterion scores, and family notes. |
| `research/` | Per-home deep-dive notes (permits, soil, flood, wildfire, sale history, red flags). |
| `docs/` | The published static page. GitHub Pages serves from here. |

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

## Listing intake workflow — the main job

**This is the core loop.** Vince pastes a Zillow (or Redfin) URL; you return a full analysis on
the site. Accepts a URL, an address, or a screenshot + address.

### 1. Scrape it — with `proxy: "stealth"`

```
firecrawl_scrape(url, formats: ["json"], proxy: "stealth", jsonOptions: {schema, prompt})
```

**`proxy: "stealth"` is not optional.** With `basic`/`auto`, Zillow silently returns a partial
page: flood zone, tax history, price history, lat/lon, and roof material all come back empty.
Verified on the same URL — `basic` gave nulls, `stealth` gave everything. Costs ~9 credits vs 5.
If stealth throws `ERR_TUNNEL_CONNECTION_FAILED`, just retry.

**Force nulls in the schema.** Use `{"type": ["number", "null"]}` and tell the model explicitly
*"use null for anything not stated; do NOT substitute 0"*. Without that it happily returns
`annualTax: 0`, `latitude: 0`, `walkScore: 0` for missing fields — which look like real data and
silently corrupt scores. **Never invent listing data.** If the scrape fails, say so plainly and
ask for a screenshot.

Zillow gives up a lot: FEMA flood zone verbatim, full price history, 3 years of public tax
history, both HOA fees, roof material, basement, heating/cooling, water, lat/lon, walk score,
listing terms, MLS#, views and saves.

### 2. Geocode and route

```bash
./tools/intake.py "1443 Acacia Dr, Colorado Springs, CO 80907"
```
Exit code 2 means it's outside 10 minutes → `status: "rejected"` with the reason. Prefer Zillow's
lat/lon when the scrape returned it; the script's Census result is a good cross-check.

### 3. Read the two things that can disqualify it on their own

- **`floodZone`** — Zillow states it outright. Note the difference: "Zone X (unshaded),
  minimal-risk" is fine; "Zone X, moderate-risk" is a warning; anything AE/A is serious.
- **Wildfire exposure** — infer from location vs. the foothills interface, then say plainly that
  an address-specific insurance quote is still required. Never present an estimate as a quote.

### 4. Score against `criteria/`, write the analysis

Fill in the full schema in `data/homes.json`:
- **`verdict`** — one or two plain sentences. What this house is, and what to do about it. The
  first thing the family reads, so lead with the real tradeoff, not a summary of the facts.
- **`scores`** — every criterion gets a `why` citing its `[Tnn]` tag. **`null` when genuinely
  unknown**, never a guess and never a zero. The site renders null as "needs check" in amber.
- **`flags`** — plain language, severity-ranked. This is what the family actually reads.
- **`monthly`** — the real payment. State the rate and down-payment assumption in `note`, and set
  `insuranceIsQuote: false` unless it's a real address-specific quote.
- **`offer`** — suggested number, rationale grounded in `40-market-and-negotiation.md`, the asks,
  and the reserve. Calibrate to the actual listing: an as-is investor listing that excluded
  FHA/VA won't entertain a repair addendum, so push price instead of repairs.
- **`openQuestions`** — everything to ask the agent or verify in person.

### 5. Deploy and report

`./deploy.sh "added 1443 Acacia Dr"`. Then tell Vince the verdict, the score, the real monthly,
and the suggested offer — in the chat, not just on the site.

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

## Read-only by design

The site has **no backend**. Decided 2026-08-06: family ratings and comments would have needed a
hosted service, and the value wasn't worth the moving parts. The family reads; Vince sends Claude
URLs; Claude regenerates and redeploys. The only client-side state is tour-checklist progress in
`localStorage`, which is deliberately per-device and never synced.

If that changes, the removed approach was a Google Apps Script endpoint writing to a Sheet —
recoverable from git history.

## Asset caching

`deploy.sh` stamps `?v=<timestamp>` onto the CSS and JS refs in `docs/index.html`. Without it,
family members who've already opened the page keep getting a cached `app.js` and quietly see the
old site. Don't remove it, and don't hand-edit those version strings.
