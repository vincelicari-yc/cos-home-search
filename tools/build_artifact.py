#!/usr/bin/env python3
"""
Build a single self-contained HTML page from data/, for publishing as a shareable Artifact.

    ./tools/build_artifact.py            -> writes build/home-search.html

Why this exists separately from docs/: the Artifact host enforces a strict CSP that blocks every
external request. The GitHub Pages site can pull Leaflet and OSM tiles from a CDN; the Artifact
cannot. So this build inlines all CSS, all data, and all markup, drops the Leaflet map in favour
of a per-home distance dial, and links out to Zillow rather than hotlinking Zillow photos.
Regenerate and re-publish whenever data/ changes.
"""

import html
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
D = ROOT / "data"

homes_doc = json.loads((D / "homes.json").read_text())
HOMES = homes_doc["homes"]
RUBRIC = json.loads((D / "rubric.json").read_text())["criteria"]
CHECKLIST = json.loads((D / "checklist.json").read_text())["sections"]
ANCHOR = json.loads((D / "anchors.json").read_text())["primary"]
try:
    DRIVE = json.loads((D / "drivetimes.json").read_text())["neighborhoods"]
except Exception:
    DRIVE = []

MAX_MIN = ANCHOR.get("maxDriveMinutes", 10)
e = html.escape


def strip_tags(s):
    """Drop [T04]/[BASE] provenance tags from family-facing text."""
    import re
    s = re.sub(r"\s*\[(?:T\d{2}|BASE)\]", "", str(s or ""))
    return re.sub(r"\s+([.,;:!?])", r"\1", s).strip()


def money(n):
    return "—" if n is None else f"${int(n):,}"


def score_of(h):
    """Total over KNOWN criteria only, rescaled. Unknown is never zero."""
    got = wk = known = 0
    for c in RUBRIC:
        s = (h.get("scores") or {}).get(c["id"])
        if not s or s.get("score") is None:
            continue
        got += (s["score"] / 5) * c["weight"]
        wk += c["weight"]
        known += 1
    if not wk:
        return None, 0, len(RUBRIC)
    return round(got / wk * 100), known, len(RUBRIC)


def tier(t):
    return "none" if t is None else "good" if t >= 80 else "ok" if t >= 65 else "bad"


CSS = """
*,*::before,*::after{box-sizing:border-box}

:root{
  --ground:#F6F7F8; --surface:#FFFFFF; --surface-2:#EDEFF2; --line:#DCE0E5;
  --ink:#171A1D; --ink-2:#4A5158; --ink-3:#7C858E;
  --accent:#31536B; --accent-soft:#E8EEF3;
  --good:#2E7D52; --good-soft:#E6F2EB;
  --warn:#8F6709; --warn-soft:#FAF1DC;
  --crit:#AF3527; --crit-soft:#FBEAE7;
  --shadow:0 1px 2px rgba(23,26,29,.06),0 6px 18px rgba(23,26,29,.05);
  --display:ui-serif,"New York",Georgia,"Times New Roman",serif;
  --sans:ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  --mono:ui-monospace,SFMono-Regular,"SF Mono",Menlo,Consolas,monospace;
}
@media (prefers-color-scheme:dark){
  :root{
    --ground:#101315; --surface:#191D20; --surface-2:#22272B; --line:#2E353A;
    --ink:#EDF0F2; --ink-2:#AEB7BE; --ink-3:#7C858E;
    --accent:#7FB0D0; --accent-soft:#1B2A35;
    --good:#6DC894; --good-soft:#17281E;
    --warn:#D9AF57; --warn-soft:#2A2314;
    --crit:#EE8B7E; --crit-soft:#2C1A17;
    --shadow:0 1px 2px rgba(0,0,0,.4),0 6px 18px rgba(0,0,0,.3);
  }
}
:root[data-theme="dark"]{
  --ground:#101315; --surface:#191D20; --surface-2:#22272B; --line:#2E353A;
  --ink:#EDF0F2; --ink-2:#AEB7BE; --ink-3:#7C858E;
  --accent:#7FB0D0; --accent-soft:#1B2A35;
  --good:#6DC894; --good-soft:#17281E;
  --warn:#D9AF57; --warn-soft:#2A2314;
  --crit:#EE8B7E; --crit-soft:#2C1A17;
  --shadow:0 1px 2px rgba(0,0,0,.4),0 6px 18px rgba(0,0,0,.3);
}
:root[data-theme="light"]{
  --ground:#F6F7F8; --surface:#FFFFFF; --surface-2:#EDEFF2; --line:#DCE0E5;
  --ink:#171A1D; --ink-2:#4A5158; --ink-3:#7C858E;
  --accent:#31536B; --accent-soft:#E8EEF3;
  --good:#2E7D52; --good-soft:#E6F2EB;
  --warn:#8F6709; --warn-soft:#FAF1DC;
  --crit:#AF3527; --crit-soft:#FBEAE7;
  --shadow:0 1px 2px rgba(23,26,29,.06),0 6px 18px rgba(23,26,29,.05);
}

body{margin:0;background:var(--ground);color:var(--ink);
  font:16px/1.55 var(--sans);-webkit-text-size-adjust:100%}
.wrap{max-width:1000px;margin:0 auto;padding:0 20px}
h1,h2,h3{text-wrap:balance;line-height:1.2}
a{color:var(--accent)}
.num{font-family:var(--mono);font-variant-numeric:tabular-nums}

/* masthead */
.mast{border-bottom:1px solid var(--line);background:var(--surface)}
.mast-in{display:flex;flex-wrap:wrap;gap:16px;align-items:baseline;
  justify-content:space-between;padding:22px 20px}
.mast h1{margin:0;font-family:var(--display);font-size:1.65rem;font-weight:600;letter-spacing:-.015em}
.mast p{margin:4px 0 0;font-size:.85rem;color:var(--ink-3)}
.params{display:flex;flex-wrap:wrap;gap:7px}
.param{background:var(--surface-2);border-radius:999px;padding:4px 11px;font-size:.76rem;color:var(--ink-2)}
.param b{color:var(--ink);font-weight:650}

section{padding:34px 0}
.sec-head{display:flex;align-items:baseline;gap:12px;margin:0 0 4px}
.sec-head h2{margin:0;font-family:var(--display);font-size:1.22rem;font-weight:600}
.eyebrow{font-size:.68rem;text-transform:uppercase;letter-spacing:.12em;color:var(--ink-3);
  font-family:var(--sans);font-weight:650}
.lede{margin:6px 0 18px;color:var(--ink-2);font-size:.92rem;max-width:66ch}

/* pre-tour alert */
.alert{border:1px solid var(--crit);background:var(--crit-soft);border-radius:12px;padding:16px 18px}
.alert h2{margin:0 0 6px;font-family:var(--display);font-size:1.08rem;color:var(--crit)}
.alert p{margin:0;font-size:.9rem}
.alert ol{margin:12px 0 0;padding-left:20px;font-size:.9rem}
.alert li+li{margin-top:8px}

/* standings */
.stand{width:100%;border-collapse:collapse;font-size:.88rem}
.stand th{text-align:left;font-size:.67rem;text-transform:uppercase;letter-spacing:.1em;
  color:var(--ink-3);padding:0 10px 8px;font-weight:650}
.stand td{padding:11px 10px;border-top:1px solid var(--line);vertical-align:middle}
.stand tbody tr:hover{background:var(--surface-2)}
.stand td.r,.stand th.r{text-align:right}
.rank{font-family:var(--mono);color:var(--ink-3);font-size:.8rem}
.stand .addr{font-family:var(--display);font-size:1rem;font-weight:600}
.stand .catch{display:block;color:var(--ink-3);font-size:.78rem;margin-top:2px;max-width:44ch}
.scroller{overflow-x:auto}

/* score chip */
.chip{display:inline-flex;align-items:baseline;gap:5px;border-radius:8px;
  padding:4px 9px;border:1px solid;font-family:var(--mono);font-weight:700;font-size:1rem}
.chip small{font-family:var(--sans);font-weight:600;font-size:.6rem;text-transform:uppercase;letter-spacing:.07em;opacity:.75}
.t-good{color:var(--good);background:var(--good-soft);border-color:var(--good)}
.t-ok{color:var(--warn);background:var(--warn-soft);border-color:var(--warn)}
.t-bad{color:var(--crit);background:var(--crit-soft);border-color:var(--crit)}
.t-none{color:var(--ink-3);background:var(--surface-2);border-color:var(--line)}

/* home cards */
.homes{display:grid;gap:22px}
.home{background:var(--surface);border:1px solid var(--line);border-radius:14px;
  box-shadow:var(--shadow);overflow:hidden}
.home-hd{display:flex;gap:14px;justify-content:space-between;align-items:flex-start;
  padding:18px 20px 0}
.home-hd h3{margin:0;font-family:var(--display);font-size:1.2rem;font-weight:600;letter-spacing:-.01em}
.hood{font-size:.8rem;color:var(--ink-3);margin-top:3px}
.body{padding:0 20px 20px}
.verdict{margin:14px 0 0;font-size:.95rem;line-height:1.55;padding-left:13px;
  border-left:2px solid var(--accent)}

.facts{display:flex;flex-wrap:wrap;gap:6px;margin:15px 0 0}
.fact{background:var(--surface-2);border-radius:6px;padding:3px 9px;font-size:.79rem;color:var(--ink-2)}
.fact b{color:var(--ink);font-family:var(--mono);font-weight:650}

/* distance dial — replaces the map, which CSP blocks */
.dial{margin:16px 0 0;padding:12px 14px;background:var(--surface-2);border-radius:10px}
.dial-top{display:flex;justify-content:space-between;font-size:.76rem;color:var(--ink-3)}
.dial-track{position:relative;height:8px;background:var(--surface);border:1px solid var(--line);
  border-radius:999px;margin-top:7px;overflow:hidden}
.dial-fill{position:absolute;inset:0 auto 0 0;border-radius:999px}
.dial-mark{position:absolute;top:-4px;bottom:-4px;width:2px;background:var(--ink-3)}
.dial-note{margin:7px 0 0;font-size:.74rem;color:var(--ink-3)}

/* flags: severity in shape and label, not colour alone */
.flags{display:grid;gap:7px;margin:16px 0 0}
.flag{display:grid;grid-template-columns:auto 1fr;gap:10px;align-items:start;
  border-left:3px solid;border-radius:8px;padding:9px 11px;font-size:.86rem;line-height:1.5}
.flag b{font-size:.62rem;text-transform:uppercase;letter-spacing:.08em;
  font-family:var(--sans);padding-top:2px;white-space:nowrap}
.f-critical{background:var(--crit-soft);border-color:var(--crit)}
.f-critical b{color:var(--crit)}
.f-warning{background:var(--warn-soft);border-color:var(--warn)}
.f-warning b{color:var(--warn)}
.f-note{background:var(--surface-2);border-color:var(--line);color:var(--ink-2)}
.f-note b{color:var(--ink-3)}

details{border-top:1px solid var(--line);margin-top:14px;padding-top:11px}
summary{cursor:pointer;font-size:.8rem;font-weight:650;color:var(--accent);list-style:none}
summary::-webkit-details-marker{display:none}
summary::before{content:"+ ";font-family:var(--mono)}
details[open] summary::before{content:"− "}
summary:focus-visible{outline:2px solid var(--accent);outline-offset:3px;border-radius:4px}

.kv{width:100%;border-collapse:collapse;margin-top:11px;font-size:.85rem}
.kv td{padding:6px 0;border-bottom:1px solid var(--line)}
.kv td:last-child{text-align:right;font-family:var(--mono);font-variant-numeric:tabular-nums}
.kv tfoot td{border-bottom:none;border-top:2px solid var(--line);font-weight:700;padding-top:9px}
.kv .est td{color:var(--warn)}
.foot-note{margin:9px 0 0;font-size:.78rem;color:var(--warn);line-height:1.5}

.offer-hd{display:flex;justify-content:space-between;align-items:baseline;gap:10px;
  background:var(--good-soft);border:1px solid var(--good);border-radius:9px;padding:10px 13px;margin-top:11px}
.offer-hd span{font-size:.7rem;text-transform:uppercase;letter-spacing:.09em;color:var(--good);font-weight:650}
.offer-hd strong{font-family:var(--mono);font-size:1.18rem;color:var(--good)}
.asks{margin:11px 0 0;padding-left:19px;font-size:.85rem;color:var(--ink-2)}
.asks li+li{margin-top:5px}
.why{margin:10px 0 0;font-size:.85rem;color:var(--ink-2)}

.crits{display:grid;gap:10px;margin-top:12px}
.crit-top{display:flex;justify-content:space-between;gap:10px;font-size:.79rem}
.crit-top span:first-child{color:var(--ink-2)}
.crit-top span:last-child{font-family:var(--mono);font-weight:650}
.bar{height:5px;background:var(--surface-2);border-radius:999px;margin-top:4px;overflow:hidden}
.bar i{display:block;height:100%;background:var(--accent);border-radius:999px}
.crit-why{margin:5px 0 0;font-size:.77rem;color:var(--ink-3);line-height:1.5}
.unk span:last-child{color:var(--warn)}

ul.q{margin:11px 0 0;padding-left:19px;font-size:.85rem;color:var(--ink-2)}
ul.q li+li{margin-top:5px}

.btn{display:inline-block;margin-top:16px;background:var(--accent);color:var(--surface);
  border-radius:8px;padding:8px 15px;font-size:.83rem;font-weight:600;text-decoration:none}
.btn:hover{filter:brightness(1.1)}

/* drive table */
.dt{width:100%;border-collapse:collapse;font-size:.87rem}
.dt th{text-align:left;font-size:.67rem;text-transform:uppercase;letter-spacing:.1em;
  color:var(--ink-3);padding:0 10px 8px;font-weight:650}
.dt td{padding:8px 10px;border-top:1px solid var(--line)}
.dt td.r,.dt th.r{text-align:right;font-family:var(--mono);font-variant-numeric:tabular-nums}
.pill{font-size:.7rem;padding:2px 8px;border-radius:999px;font-weight:650;white-space:nowrap}
.p-in{background:var(--good-soft);color:var(--good)}
.p-edge{background:var(--warn-soft);color:var(--warn)}
.p-out{background:var(--crit-soft);color:var(--crit)}

/* checklist */
.chk{background:var(--surface);border:1px solid var(--line);border-radius:12px;margin-top:12px;
  padding:0 16px}
.chk>summary{padding:13px 0;font-family:var(--sans);font-size:.92rem;color:var(--ink);
  display:flex;justify-content:space-between;gap:10px}
.chk>summary b{font-weight:600}
.chk>summary em{font-style:normal;font-family:var(--mono);font-size:.76rem;color:var(--ink-3)}
.chk-intro{margin:0 0 10px;font-size:.84rem;color:var(--ink-2);line-height:1.5}
.chk ul{list-style:none;margin:0 0 14px;padding:0;display:grid;gap:3px}
.chk li{display:grid;grid-template-columns:auto 1fr;gap:9px;align-items:start;
  font-size:.86rem;line-height:1.5;padding:6px 9px;border-left:3px solid transparent;border-radius:6px}
.chk li.s-critical{border-color:var(--crit);background:var(--crit-soft)}
.chk li.s-warning{border-color:var(--warn);background:var(--warn-soft)}
.chk li.s-note{border-color:var(--line);background:var(--surface-2);color:var(--ink-2)}
.chk li i{font-style:normal;font-family:var(--mono);font-size:.68rem;color:var(--ink-3);padding-top:3px}

footer{border-top:1px solid var(--line);margin-top:14px;padding:22px 0 34px;
  font-size:.79rem;color:var(--ink-3)}

@media (min-width:860px){
  .homes{grid-template-columns:1fr}
  .mast h1{font-size:1.9rem}
}
@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
"""


def dial(h):
    """Horizontal drive-time gauge against the 10-minute hard limit."""
    m = (h.get("geo") or {}).get("driveMinutesToAnchor")
    if m is None:
        return ""
    pct = min(100, m / (MAX_MIN * 1.4) * 100)
    limit_pct = MAX_MIN / (MAX_MIN * 1.4) * 100
    # 7.0 is the "comfortable" bar, not 8.5: free-flow times run 15-25% under real rush hour, so
    # anything from ~7 up can break the 10-minute rule in practice. Keeps the dial consistent with
    # the drive-time flags on the cards.
    col = "var(--good)" if m <= 7.0 else "var(--warn)" if m <= MAX_MIN else "var(--crit)"
    note = ("Comfortably inside the limit, even in traffic." if m <= 7.0 else
            f"Inside the {MAX_MIN}-minute limit, but this is free-flow with no traffic - "
            f"at 8am expect nearer {m * 1.2:.0f} minutes." if m <= MAX_MIN else
            f"Over the {MAX_MIN}-minute limit.")
    return f"""
      <div class="dial">
        <div class="dial-top"><span>Drive to YWAM</span>
          <span class="num">{m} min · {(h.get('geo') or {}).get('driveMilesToAnchor','?')} mi</span></div>
        <div class="dial-track">
          <i class="dial-fill" style="width:{pct:.1f}%;background:{col}"></i>
          <i class="dial-mark" style="left:{limit_pct:.1f}%"></i>
        </div>
        <p class="dial-note">{e(note)} The tick marks the {MAX_MIN}-minute limit.</p>
      </div>"""


def card(h, rank):
    total, known, of = score_of(h)
    L, G = h.get("listing") or {}, h.get("geo") or {}
    facts = []
    for label, val, mono in [
        ("bd", L.get("beds"), True), ("ba", L.get("baths"), True),
        ("sqft", f"{L['sqft']:,}" if L.get("sqft") else None, True),
        ("", money(L.get("price")), True),
        ("/sqft", money(L.get("pricePerSqft")), True),
        ("built", L.get("yearBuilt"), True),
        ("days listed", L.get("daysOnMarket"), True),
    ]:
        if val is None:
            continue
        facts.append(f'<span class="fact"><b>{e(str(val))}</b> {e(label)}</span>' if label
                     else f'<span class="fact"><b>{e(str(val))}</b></span>')

    order = {"critical": 0, "warning": 1, "note": 2}
    fl = [v for k, v in (h.get("flags") or {}).items() if isinstance(v, dict) and v.get("text")]
    fl.sort(key=lambda f: order.get(f.get("severity"), 3))
    flags = "".join(
        f'<div class="flag f-{e(f.get("severity","note"))}"><b>{e(f.get("severity","note"))}</b>'
        f'<div>{e(strip_tags(f["text"]))}</div></div>' for f in fl)

    m = h.get("monthly") or {}
    rows = ""
    for lbl, key, cls in [("Principal &amp; interest", "principalInterest", ""),
                          ("Property tax", "propertyTax", ""),
                          ("Insurance — <b>estimate, not a quote</b>", "insuranceEstimate", "est"),
                          ("HOA", "hoa", ""), ("Metro district", "metroDistrict", "")]:
        v = m.get(key)
        if not v:
            continue
        rows += f'<tr class="{cls}"><td>{lbl}</td><td>{money(v)}</td></tr>'
    monthly = (f'<table class="kv"><tbody>{rows}</tbody>'
               f'<tfoot><tr><td>Real monthly</td><td>{money(m.get("total"))}</td></tr></tfoot></table>'
               + (f'<p class="foot-note">{e(strip_tags(m.get("note","")))}</p>' if m.get("note") else "")
               ) if m else ""

    o = h.get("offer") or {}
    offer = ""
    if o:
        asks = "".join(f"<li>{e(strip_tags(a))}</li>" for a in (o.get("asks") or []))
        offer = (f'<div class="offer-hd"><span>Suggested offer</span>'
                 f'<strong>{money(o.get("suggested"))}</strong></div>'
                 f'<p class="why">{e(strip_tags(o.get("rationale","")))}</p>'
                 + (f'<ul class="asks">{asks}</ul>' if asks else "")
                 + (f'<p class="why"><strong>Hold back {money(o.get("reserveNeeded"))}</strong> '
                    f'for the repairs above.</p>' if o.get("reserveNeeded") else ""))

    crits = ""
    for c in RUBRIC:
        s = (h.get("scores") or {}).get(c["id"]) or {}
        got = s.get("score")
        pct = (got / 5 * 100) if got is not None else 0
        crits += (f'<div class="crit{" unk" if got is None else ""}">'
                  f'<div class="crit-top"><span>{e(c["label"])}</span>'
                  f'<span>{f"{got}/5" if got is not None else "needs check"}</span></div>'
                  f'<div class="bar"><i style="width:{pct:.0f}%"></i></div>'
                  + (f'<p class="crit-why">{e(strip_tags(s.get("why","")))}</p>' if s.get("why") else "")
                  + "</div>")

    det = []
    for k, v in [("Flood zone", L.get("floodZone")), ("Foundation", L.get("foundationRepair")),
                 ("Roof", L.get("roofMaterial")), ("Basement", L.get("basement")),
                 ("Heating", L.get("heating")), ("Cooling", L.get("cooling")),
                 ("Water", L.get("water")),
                 ("Annual tax", money(L["annualTax"]) if L.get("annualTax") else None),
                 ("County value", money(L["taxAssessedValue"]) if L.get("taxAssessedValue") else None),
                 ("HOA", (money(L["hoaMonthly"]) + "/mo") if L.get("hoaMonthly") else
                  ("None" if L.get("hoaMonthly") == 0 else None)),
                 ("Loan types", L.get("listingTerms")), ("Lot", f"{L['lotSqft']:,} sqft" if L.get("lotSqft") else None),
                 ("MLS", L.get("mlsNumber"))]:
        if v:
            det.append(f"<tr><td>{e(k)}</td><td>{e(str(v))}</td></tr>")
    details = f'<table class="kv"><tbody>{"".join(det)}</tbody></table>' if det else ""

    ph = "".join(f'<tr><td>{e(p.get("date",""))} — {e(p.get("event",""))}</td>'
                 f'<td>{money(p.get("price"))}</td></tr>' for p in (h.get("priceHistory") or []))
    qs = "".join(f"<li>{e(strip_tags(q))}</li>" for q in (h.get("openQuestions") or []))

    # Precompute every optional block. Nested f-strings this deep break on Python 3.9.
    conf = ""
    if total is not None and known < of:
        conf = ('<p class="crit-why" style="margin-top:12px">Score uses the {k} criteria we could '
                'verify, out of {o}. {n} still need checking — an unknown is never counted as a '
                'zero.</p>').format(k=known, o=of, n=of - known)

    verdict_html = ""
    if h.get("verdict"):
        verdict_html = '<p class="verdict">' + e(strip_tags(h["verdict"])) + "</p>"

    flags_html = '<div class="flags">' + flags + "</div>" if flags else ""
    offer_html = "<details open><summary>Offer strategy</summary>" + offer + "</details>" if offer else ""
    monthly_html = ("<details><summary>What it really costs per month</summary>"
                    + monthly + "</details>") if monthly else ""
    crits_html = ('<details><summary>Score breakdown, criterion by criterion</summary>'
                  '<div class="crits">' + crits + "</div></details>")
    details_html = "<details><summary>Listing details</summary>" + details + "</details>" if details else ""
    ph_html = ('<details><summary>Price history</summary><table class="kv"><tbody>'
               + ph + "</tbody></table></details>") if ph else ""
    q_count = len(h.get("openQuestions") or [])
    q_html = ("<details><summary>Open questions (" + str(q_count) + ')</summary><ul class="q">'
              + qs + "</ul></details>") if qs else ""
    link_html = ""
    if L.get("zillowUrl"):
        link_html = ('<a class="btn" href="' + e(L["zillowUrl"])
                     + '" target="_blank" rel="noopener noreferrer">Open on Zillow</a>')
    score_txt = str(total) if total is not None else "—"

    return f"""
    <article class="home">
      <div class="home-hd">
        <div>
          <div class="rank">No. {rank}</div>
          <h3>{e(h["address"])}</h3>
          <div class="hood">{e(G.get("neighborhood") or "")}</div>
        </div>
        <div class="chip t-{tier(total)}">{score_txt}<small>score</small></div>
      </div>
      <div class="body">
        {verdict_html}
        <div class="facts">{"".join(facts)}</div>
        {dial(h)}
        {flags_html}
        {conf}
        {offer_html}
        {monthly_html}
        {crits_html}
        {details_html}
        {ph_html}
        {q_html}
        {link_html}
      </div>
    </article>"""


# ---- standings ----
ranked = sorted([h for h in HOMES if h.get("status") != "rejected"],
                key=lambda h: -(score_of(h)[0] or -1))


def biggest_catch(h):
    for k, v in (h.get("flags") or {}).items():
        if isinstance(v, dict) and v.get("severity") == "critical":
            return strip_tags(v["text"])
    for k, v in (h.get("flags") or {}).items():
        if isinstance(v, dict) and v.get("severity") == "warning":
            return strip_tags(v["text"])
    return "—"


stand_rows = ""
for i, h in enumerate(ranked, 1):
    total, known, of = score_of(h)
    L = h.get("listing") or {}
    catch = biggest_catch(h)
    stand_rows += f"""
      <tr>
        <td class="rank num">{i}</td>
        <td><span class="addr">{e(h["address"].split(",")[0])}</span>
            <span class="catch">{e(catch[:120])}{"…" if len(catch) > 120 else ""}</span></td>
        <td><span class="chip t-{tier(total)}">{total if total is not None else "—"}</span></td>
        <td class="r num">{money(L.get("price"))}</td>
        <td class="r num">{L.get("beds","?")}/{L.get("baths","?")}</td>
        <td class="r num">{(h.get("geo") or {}).get("driveMinutesToAnchor","?")}</td>
        <td class="r num">{money((h.get("monthly") or {}).get("total"))}</td>
        <td class="r num">{money((h.get("offer") or {}).get("suggested"))}</td>
      </tr>"""

drive_rows = ""
for n in sorted(DRIVE, key=lambda x: x["minutes"]):
    edge = n["inRadius"] and n["minutes"] >= 8.5
    cls, txt = ("p-in", "in range") if (n["inRadius"] and not edge) else \
               ("p-edge", "tight in traffic") if edge else ("p-out", "too far")
    drive_rows += (f'<tr><td>{e(n["name"])}</td><td class="r">{n["minutes"]}</td>'
                   f'<td class="r">{n["miles"]}</td>'
                   f'<td><span class="pill {cls}">{txt}</span></td></tr>')

chk = ""
for s in CHECKLIST:
    items = "".join(
        f'<li class="s-{e(it.get("severity","note"))}"><i>{e((it.get("severity","note"))[:4].upper())}</i>'
        f'<span>{e(strip_tags(it["text"]))}</span></li>' for it in s["items"])
    chk += (f'<details class="chk"><summary><b>{e(s["title"])}</b>'
            f'<em>{len(s["items"])} checks</em></summary>'
            f'<p class="chk-intro">{e(strip_tags(s["intro"]))}</p><ul>{items}</ul></details>')

total_checks = sum(len(s["items"]) for s in CHECKLIST)

HTML = f"""<title>Home Search — Colorado Springs</title>
<style>{CSS}</style>

<header class="mast">
  <div class="mast-in">
    <div>
      <h1>Home Search</h1>
      <p>Colorado Springs · within {MAX_MIN} minutes of {e(ANCHOR['label'])}</p>
    </div>
    <div class="params">
      <span class="param">Under <b>$600k</b></span>
      <span class="param"><b>4</b> bed · <b>3</b> bath min</span>
      <span class="param"><b>{MAX_MIN} min</b> drive max</span>
      <span class="param"><b>{len(ranked)}</b> analysed</span>
    </div>
  </div>
</header>

<div class="wrap">

  <section>
    <div class="alert">
      <h2>Two things to do before touring any house</h2>
      <p>Either one can rule out a house on its own, and both change what we can afford to borrow —
      so they come <em>before</em> falling for a place, not after.</p>
      <ol>
        <li><strong>Get an insurance quote for that exact address.</strong> In the wildfire zones near
        the foothills, premiums run <strong>$4,500–$8,500 a year</strong> — $300–600 a month on top of
        the mortgage. Some insurers won't write these addresses at all, and the Zillow monthly estimate
        doesn't include any of this.</li>
        <li><strong>Pull the FEMA flood map.</strong> Monument Creek and Fountain Creek both run through
        our search area. Flood insurance adds $1,000–$5,000 a year, and a flood-zone home can appraise
        lower, which complicates the loan.</li>
      </ol>
    </div>
  </section>

  <section>
    <div class="sec-head"><span class="eyebrow">Where things stand</span></div>
    <h2 style="font-family:var(--display);font-size:1.22rem;margin:0 0 4px">Ranked shortlist</h2>
    <p class="lede">Scored 0–100 against what we learned from eight videos on this market — weighted
    heaviest toward foundation, wildfire insurability, water, and roof, because those are what cost
    real money here. A criterion we couldn't verify is left out of the score rather than counted as
    zero.</p>
    <div class="scroller">
      <table class="stand">
        <thead><tr><th>#</th><th>Home</th><th>Score</th><th class="r">Price</th>
          <th class="r">Bd/Ba</th><th class="r">Min</th><th class="r">Monthly</th><th class="r">Offer</th></tr></thead>
        <tbody>{stand_rows}</tbody>
      </table>
    </div>
  </section>

  <section>
    <div class="sec-head"><span class="eyebrow">The houses</span></div>
    <div class="homes">{"".join(card(h, i) for i, h in enumerate(ranked, 1))}</div>
  </section>

  <section>
    <div class="sec-head"><span class="eyebrow">The area</span></div>
    <h2 style="font-family:var(--display);font-size:1.22rem;margin:0 0 4px">What's actually within {MAX_MIN} minutes</h2>
    <p class="lede">Measured driving times from the anchor. These are free-flow with no traffic — at
    8am or 5pm add roughly 15–25% on this corridor. And a neighbourhood name is never a drive time:
    Rockrimmon alone spans about five minutes end to end, so every address gets routed on its own.</p>
    <div class="scroller">
      <table class="dt">
        <thead><tr><th>Neighbourhood</th><th class="r">Minutes</th><th class="r">Miles</th><th></th></tr></thead>
        <tbody>{drive_rows}</tbody>
      </table>
    </div>
  </section>

  <section>
    <div class="sec-head"><span class="eyebrow">On the tour</span></div>
    <h2 style="font-family:var(--display);font-size:1.22rem;margin:0 0 4px">Walk-the-house checklist</h2>
    <p class="lede">{total_checks} checks, built for a phone while you're standing in the house.
    Ordered by what costs the most if you miss it.</p>
    {chk}
  </section>

  <footer>
    Private family page — please don't share the link outside the family. Insurance figures are
    estimates, not quotes, unless a card says otherwise. Photos and full listings live on Zillow.
  </footer>
</div>
"""

# Escape every non-ASCII character to a numeric HTML entity. We don't control the <head> the host
# wraps this in, so we can't guarantee a charset declaration — and a mis-guessed charset turns every
# em dash and curly quote into mojibake. Entities render correctly under any encoding.
HTML = HTML.encode("ascii", "xmlcharrefreplace").decode("ascii")

out = ROOT / "build"
out.mkdir(exist_ok=True)
path = out / "home-search.html"
path.write_text(HTML, encoding="utf-8")
print(f"wrote {path.relative_to(ROOT)}  ({len(HTML):,} bytes, {len(ranked)} homes, {total_checks} checks)")
print("non-ascii bytes remaining:", sum(1 for ch in HTML if ord(ch) > 127))
