# Transcripts

Raw YouTube transcripts. **Local only — `transcripts/*.md` is gitignored**, because verbatim
transcripts are the video creators' copyrighted work and this repo is public. The distilled
criteria in [`../criteria/`](../criteria/) are our own summaries and do get published.

**Start here: [`00-index.md`](00-index.md)** — all eight transcripts with metadata and a dense
extraction of every claim, figure, and recommendation. That's the audit trail: when the site says
a roof is a problem, `[T04]` traces it back to the video that said so.

## Index

| # | Title | Channel | Applies to us | Criteria fed |
| --- | --- | --- | --- | --- |
| T01 | Colorado Springs' Biggest Megaprojects | Iris | Low — north/east side | `40` |
| T02 | Everything NEW and COMING SOON in 2026 | Iris | Low — north side | `20`, `40` |
| T03 | AVOID Moving to The Wrong Area (Every Area Explained) | Iris | Partial | `20`, `30`, `50` |
| T04 | **NEVER Buy These Types of Homes** | Iris | **High — nearly all** | `20`, `30`, `50`, `90` |
| T05 | Housing Market Is About To Change FOREVER | Iris | High | `30`, `40`, `90` |
| T06 | AVOID These 5 Areas If You're From Out Of State | Iris | **High — Mountain Shadows** | `20`, `30`, `50` |
| T07 | Hidden value markers (why one house sells for $900k) | other | **High** | `20`, `30`, `50`, `90` |
| T08 | Not all homes age well / rules for 2026 | other | **High** | `30`, `40`, `50`, `90` |

All eight received 2026-08-06 in one batch.

## If you paste more

Save verbatim to `NN-slug.md` with frontmatter:

```yaml
---
title: <video title>
source: <YouTube URL, or "not provided">
channel: <channel name, or "unknown">
added: <YYYY-MM-DD>
topics: [foundation, hail, radon, negotiation]
---
```

Then add a row above and extract into `criteria/`. Full workflow in [`../CLAUDE.md`](../CLAUDE.md).
