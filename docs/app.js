/* Home Search — Colorado Springs
 *
 * Read-only static page. No backend, no accounts, nothing to break. Loads data/*.json and
 * renders. Vince sends Claude a Zillow URL; Claude scrapes it, scores it against criteria/,
 * writes the analysis into data/homes.json, and redeploys. The family just reads.
 */
'use strict';

const state = {
  homes: [], anchors: null, rubric: null, checklist: null, driveTimes: null, map: null,
};

/* ---------------- utilities ---------------- */

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

/** Strip transcript provenance tags — [T04], [BASE] — from family-facing text.
 *  They stay in the JSON so any claim traces back to the video that made it. */
const stripTags = s => String(s == null ? '' : s)
  .replace(/\s*\[(?:T\d{2}|BASE)\]/g, '')
  .replace(/\s+([.,;:!?])/g, '$1')
  .trim();

const money  = n => n == null ? '—' : '$' + Number(n).toLocaleString('en-US');
const money0 = n => n == null ? '—' : '$' + Math.round(Number(n)).toLocaleString('en-US');

async function loadJSON(path) {
  const r = await fetch(path, { cache: 'no-store' });
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  return r.json();
}

/* ---------------- scoring ----------------
 * Totals use KNOWN criteria only, rescaled to 0-100, and we report how many were known.
 * An unresearched home must never look worse than one we dug into and found wanting.
 */
function computeScore(home) {
  if (home.status === 'rejected') return { total: null, known: 0, of: 0, rejected: true };
  const list = state.rubric.criteria;
  let got = 0, weightKnown = 0, known = 0;
  for (const c of list) {
    const s = home.scores && home.scores[c.id];
    if (!s || s.score == null) continue;
    got += (s.score / 5) * c.weight;
    weightKnown += c.weight;
    known++;
  }
  if (!weightKnown) return { total: null, known: 0, of: list.length, rejected: false };
  return { total: Math.round((got / weightKnown) * 100), known, of: list.length, rejected: false };
}

const scoreClass = t => t == null ? 'score-none'
  : t >= 80 ? 'score-good' : t >= 65 ? 'score-ok' : 'score-bad';

/* ---------------- home cards ---------------- */

function visibleHomes() {
  const f = $('#filter').value;
  let list = state.homes.slice();
  if (f === 'live') list = list.filter(h => !['rejected', 'passed', 'archived'].includes(h.status));
  else if (f === 'toured')   list = list.filter(h => h.status === 'toured');
  else if (f === 'rejected') list = list.filter(h => h.status === 'rejected');

  const s = $('#sort').value;
  const price = h => h.listing && h.listing.price;
  list.sort((a, b) => {
    if (s === 'price-asc')  return (price(a) ?? 1e12) - (price(b) ?? 1e12);
    if (s === 'price-desc') return (price(b) ?? -1) - (price(a) ?? -1);
    if (s === 'drive') return ((a.geo && a.geo.driveMinutesToAnchor) ?? 99)
                            - ((b.geo && b.geo.driveMinutesToAnchor) ?? 99);
    if (s === 'newest') return String(b.addedAt || '').localeCompare(String(a.addedAt || ''));
    return (computeScore(b).total ?? -1) - (computeScore(a).total ?? -1);
  });
  return list;
}

function scoreBreakdown(h) {
  const rows = state.rubric.criteria.map(c => {
    const s = (h.scores || {})[c.id];
    const known = s && s.score != null;
    const pct = known ? (s.score / 5) * 100 : 0;
    return `<div class="crit ${known ? '' : 'crit-unknown'}">
      <div class="crit-top">
        <span class="crit-name">${esc(c.label)}</span>
        <span class="crit-val">${known ? s.score + '/5' : 'needs check'}</span>
      </div>
      <div class="crit-bar"><div class="crit-fill" style="width:${pct}%"></div></div>
      ${known && s.why ? `<p class="crit-why">${esc(stripTags(s.why))}</p>` : ''}
    </div>`;
  }).join('');
  return `<div class="crits">${rows}</div>`;
}

function monthlyBlock(m) {
  if (!m) return '';
  const row = (label, v, cls = '') => v == null || v === 0
    ? '' : `<tr class="${cls}"><td>${esc(label)}</td><td class="num">${money0(v)}</td></tr>`;
  return `
    <table class="mo">
      <tbody>
        ${row('Principal & interest', m.principalInterest)}
        ${row('Property tax', m.propertyTax)}
        ${row(m.insuranceIsQuote ? 'Insurance (real quote)' : 'Insurance (estimate only)',
              m.insuranceEstimate, m.insuranceIsQuote ? '' : 'mo-est')}
        ${row('HOA', m.hoa)}
        ${row('Metro district', m.metroDistrict)}
      </tbody>
      <tfoot><tr><td><strong>Real monthly</strong></td>
        <td class="num"><strong>${money0(m.total)}</strong></td></tr></tfoot>
    </table>
    ${m.note ? `<p class="mo-note">${esc(stripTags(m.note))}</p>` : ''}`;
}

function offerBlock(o) {
  if (!o) return '';
  return `
    <div class="offer">
      <div class="offer-head">
        <span class="offer-label">Suggested offer</span>
        <span class="offer-num">${money(o.suggested)}</span>
      </div>
      ${o.rationale ? `<p class="offer-why">${esc(stripTags(o.rationale))}</p>` : ''}
      ${(o.asks || []).length ? `<ul class="offer-asks">${
        o.asks.map(a => `<li>${esc(stripTags(a))}</li>`).join('')}</ul>` : ''}
      ${o.reserveNeeded ? `<p class="offer-why"><strong>Hold back ${money(o.reserveNeeded)}</strong>
        for the repairs above.</p>` : ''}
    </div>`;
}

function priceHistoryBlock(ph) {
  if (!ph || !ph.length) return '';
  return `<table class="ph"><thead><tr><th>Date</th><th>Event</th><th class="num">Price</th></tr></thead>
    <tbody>${ph.map(e => `<tr><td>${esc(e.date)}</td><td>${esc(e.event)}</td>
      <td class="num">${money(e.price)}</td></tr>`).join('')}</tbody></table>`;
}

function homeCard(h) {
  const sc = computeScore(h);
  const L = h.listing || {}, G = h.geo || {};
  const photo = (h.photos && h.photos[0]) || null;

  const scoreBox = sc.rejected
    ? `<div class="score score-bad"><span class="score-n">✕</span><span class="score-l">out</span></div>`
    : `<div class="score ${scoreClass(sc.total)}">
         <span class="score-n">${sc.total ?? '—'}</span>
         <span class="score-l">${sc.total == null ? 'no data' : 'score'}</span></div>`;

  const facts = [
    L.beds != null && `<span class="fact"><strong>${L.beds}</strong> bd</span>`,
    L.baths != null && `<span class="fact"><strong>${L.baths}</strong> ba</span>`,
    L.sqft != null && `<span class="fact"><strong>${Number(L.sqft).toLocaleString()}</strong> sqft</span>`,
    L.price != null && `<span class="fact"><strong>${money(L.price)}</strong></span>`,
    L.pricePerSqft != null && `<span class="fact">${money(L.pricePerSqft)}/sqft</span>`,
    L.yearBuilt != null && `<span class="fact">built <strong>${L.yearBuilt}</strong></span>`,
    G.driveMinutesToAnchor != null && `<span class="fact"><strong>${G.driveMinutesToAnchor}</strong> min to YWAM</span>`,
    L.daysOnMarket != null && `<span class="fact"><strong>${L.daysOnMarket}</strong> days listed</span>`,
    L.lotSqft != null && `<span class="fact">lot ${Number(L.lotSqft).toLocaleString()} sqft</span>`,
  ].filter(Boolean).join('');

  const flags = Object.values(h.flags || {})
    .filter(f => f && f.text)
    .map(f => `<div class="flag flag-${esc(f.severity || 'note')}">${esc(stripTags(f.text))}</div>`)
    .join('');

  const links = [
    L.zillowUrl && `<a class="btn btn-ghost" href="${esc(L.zillowUrl)}" target="_blank" rel="noopener noreferrer">Zillow</a>`,
    L.redfinUrl && `<a class="btn btn-ghost" href="${esc(L.redfinUrl)}" target="_blank" rel="noopener noreferrer">Redfin</a>`,
    `<a class="btn btn-ghost" href="https://www.google.com/maps/dir/?api=1&origin=${state.anchors.primary.lat},${state.anchors.primary.lon}&destination=${encodeURIComponent(h.address)}" target="_blank" rel="noopener noreferrer">Directions</a>`,
  ].filter(Boolean).join('');

  // Key listing details worth surfacing without opening Zillow
  const detail = (k, v) => v == null || v === '' ? '' :
    `<div class="dt"><span class="dt-k">${esc(k)}</span><span class="dt-v">${esc(v)}</span></div>`;
  const details = [
    detail('Flood zone', L.floodZone),
    detail('Foundation', L.foundationRepair),
    detail('Roof', L.roofMaterial),
    detail('Basement', L.basement),
    detail('Heating / cooling', [L.heating, L.cooling].filter(Boolean).join(' · ') || null),
    detail('Water', L.water),
    detail('Annual tax', L.annualTax != null ? money(L.annualTax) : null),
    detail('HOA', L.hoaMonthly ? money(L.hoaMonthly) + '/mo'
      + (L.secondHoaMonthly ? ` + second HOA ${money(L.secondHoaMonthly)}/mo` : '')
      : (L.hoaMonthly === 0 ? 'None' : null)),
    detail('Metro district', L.metroDistrict == null ? null : (L.metroDistrict ? money(L.metroDistrict) + '/mo' : 'None')),
    detail('Loan types', L.listingTerms),
    detail('Neighborhood', G.neighborhood),
    detail('District', h.schools && h.schools.district),
    detail('MLS', L.mlsNumber),
  ].filter(Boolean).join('');

  return `
  <article class="home ${sc.rejected ? 'is-rejected' : ''}">
    ${photo ? `<img class="home-photo" src="${esc(photo.url)}" alt="${esc(photo.caption || h.address)}" loading="lazy" referrerpolicy="no-referrer">` : ''}
    <div class="home-body">
      <div class="home-top">
        <div>
          <h3 class="home-addr">${esc(h.address)}</h3>
          <div class="home-hood">${esc(G.neighborhood || '')}${
            h.status && !['active', 'rejected'].includes(h.status) ? ' · ' + esc(h.status) : ''}</div>
        </div>
        ${scoreBox}
      </div>

      ${h.rejectedReason ? `<div class="flag flag-critical" style="margin-top:10px">${esc(stripTags(h.rejectedReason))}</div>` : ''}
      ${h.verdict ? `<p class="verdict">${esc(stripTags(h.verdict))}</p>` : ''}
      <div class="facts">${facts}</div>
      ${flags ? `<div class="flags">${flags}</div>` : ''}

      ${!sc.rejected && sc.total != null && sc.known < sc.of
        ? `<p class="confidence">Score based on ${sc.known} of ${sc.of} criteria — ${sc.of - sc.known} still need verification.</p>` : ''}
      ${!sc.rejected && sc.total == null ? `<p class="confidence">Not scored yet.</p>` : ''}

      ${h.monthly ? `<details class="drop"><summary>What it really costs per month</summary>
        ${monthlyBlock(h.monthly)}</details>` : ''}
      ${h.offer ? `<details class="drop" open><summary>Offer strategy</summary>
        ${offerBlock(h.offer)}</details>` : ''}
      ${!sc.rejected && sc.total != null ? `<details class="drop"><summary>Score breakdown</summary>
        ${scoreBreakdown(h)}</details>` : ''}
      ${details ? `<details class="drop"><summary>Listing details</summary>
        <div class="dts">${details}</div></details>` : ''}
      ${(h.priceHistory || []).length ? `<details class="drop"><summary>Price history</summary>
        ${priceHistoryBlock(h.priceHistory)}</details>` : ''}
      ${(h.openQuestions || []).length ? `<details class="drop"><summary>Open questions (${h.openQuestions.length})</summary>
        <ul class="oq">${h.openQuestions.map(q => `<li>${esc(stripTags(q))}</li>`).join('')}</ul></details>` : ''}

      <div class="home-links">${links}</div>
    </div>
  </article>`;
}

function renderHomes() {
  const list = visibleHomes();
  const el = $('#homes-list');
  $('#count-homes').textContent = state.homes.filter(h => h.status !== 'rejected').length;

  if (!state.homes.length) {
    el.innerHTML = `
      <div class="empty">
        <div class="empty-mark">🏡</div>
        <h3>No homes analysed yet</h3>
        <p>Send Vince a Zillow or Redfin link. It comes back here with a score, the real monthly
        cost, a suggested offer, and everything worth checking — measured against what we learned
        from the videos.</p>
      </div>`;
    return;
  }
  if (!list.length) {
    el.innerHTML = `<div class="empty"><div class="empty-mark">🔍</div>
      <h3>Nothing matches this filter</h3><p>Try “Everything” in the Show dropdown.</p></div>`;
    return;
  }
  el.innerHTML = list.map(homeCard).join('');
}

/* ---------------- map ---------------- */

function renderMap() {
  if (state.map) { state.map.invalidateSize(); return; }
  const A = state.anchors.primary;
  const map = L.map('map', { scrollWheelZoom: false }).setView([A.lat, A.lon], 12);
  state.map = map;

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap', maxZoom: 19,
  }).addTo(map);

  const pin = (color, r = 8) => L.divIcon({
    className: '', iconSize: [r * 2, r * 2], iconAnchor: [r, r],
    html: `<div style="width:${r * 2}px;height:${r * 2}px;border-radius:50%;background:${color};
           border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.45)"></div>`,
  });

  L.marker([A.lat, A.lon], { icon: pin('#2b6cb0', 10), zIndexOffset: 1000 })
    .addTo(map).bindPopup(`<b>${esc(A.label)}</b><br>${esc(A.address)}<br><i>The anchor — everything is measured from here.</i>`);

  for (const s of state.anchors.secondary || []) {
    L.circleMarker([s.lat, s.lon], { radius: 5, color: '#2b6cb0', weight: 1.5, fillOpacity: .35 })
      .addTo(map).bindPopup(`<b>${esc(s.label)}</b><br>${esc(s.note || '')}`);
  }

  for (const n of (state.driveTimes && state.driveTimes.neighborhoods) || []) {
    const ref = (state.anchors.referenceNeighborhoods || []).find(x => x.name === n.name);
    if (!ref) continue;
    L.circleMarker([ref.lat, ref.lon], {
      radius: 6, weight: 1.5,
      color: n.inRadius ? '#7a9e86' : '#b0a9a1',
      fillColor: n.inRadius ? '#7a9e86' : '#b0a9a1', fillOpacity: .55,
    }).addTo(map).bindPopup(
      `<b>${esc(n.name)}</b><br>${n.minutes} min · ${n.miles} mi<br>` +
      (n.inRadius ? 'Inside the 10-minute radius' : '<b>Too far</b> — outside 10 minutes'));
  }

  const pts = [[A.lat, A.lon]];
  for (const h of state.homes) {
    if (!h.geo || h.geo.lat == null) continue;
    const sc = computeScore(h);
    const color = sc.rejected ? '#b3392f'
      : sc.total == null ? '#8a8279'
      : sc.total >= 80 ? '#2f7d51' : sc.total >= 65 ? '#a67c12' : '#b3392f';
    L.marker([h.geo.lat, h.geo.lon], { icon: pin(color, 9) }).addTo(map).bindPopup(
      `<b>${esc(h.address)}</b><br>${money(h.listing && h.listing.price)} · ` +
      `${(h.listing && h.listing.beds) ?? '?'}bd/${(h.listing && h.listing.baths) ?? '?'}ba<br>` +
      `${h.geo.driveMinutesToAnchor ?? '?'} min from YWAM<br>` +
      (sc.rejected ? `<b>Rejected:</b> ${esc(stripTags(h.rejectedReason || ''))}`
                   : `Score: <b>${sc.total ?? 'not scored'}</b>`));
    pts.push([h.geo.lat, h.geo.lon]);
  }
  if (pts.length > 1) map.fitBounds(pts, { padding: [45, 45] });
}

/* ---------------- tour checklist ---------------- */

const LS_TOUR = 'cos.tour.';
const tourKey = homeId => LS_TOUR + (homeId || '_general');
function tourState(homeId) {
  try { return JSON.parse(localStorage.getItem(tourKey(homeId))) || {}; } catch { return {}; }
}

function renderChecklist() {
  const homeId = $('#tour-home').value;
  const done = tourState(homeId);
  let total = 0, checked = 0;

  $('#checklist').innerHTML = state.checklist.sections.map(sec => {
    const items = sec.items.map((it, i) => {
      const key = `${sec.id}.${i}`;
      const on = !!done[key];
      total++; if (on) checked++;
      return `<li><label class="check sev-${esc(it.severity)} ${on ? 'done' : ''}">
        <input type="checkbox" data-key="${esc(key)}" ${on ? 'checked' : ''}>
        <span>${esc(stripTags(it.text))}</span></label></li>`;
    }).join('');
    const secDone = sec.items.filter((_, i) => done[`${sec.id}.${i}`]).length;
    return `<details class="section" ${secDone < sec.items.length ? 'open' : ''}>
      <summary>${esc(sec.title)} <span class="section-count">${secDone}/${sec.items.length}</span></summary>
      <p class="section-intro">${esc(stripTags(sec.intro))}</p>
      <ul class="check-list">${items}</ul></details>`;
  }).join('');

  const pct = total ? Math.round((checked / total) * 100) : 0;
  $('#tour-progress').innerHTML =
    `${checked} of ${total} checked${homeId ? ` · ${esc(homeId)}` : ' · general'}
     <div class="bar"><div class="bar-fill" style="width:${pct}%"></div></div>`;

  $$('#checklist input[type=checkbox]').forEach(cb => cb.addEventListener('change', () => {
    const st = tourState(homeId);
    st[cb.dataset.key] = cb.checked;
    localStorage.setItem(tourKey(homeId), JSON.stringify(st));
    renderChecklist();
  }));
}

function initTourPicker() {
  const sel = $('#tour-home');
  sel.innerHTML = `<option value="">— general / no home selected —</option>` +
    state.homes.filter(h => h.status !== 'rejected')
      .map(h => `<option value="${esc(h.id)}">${esc(h.address)}</option>`).join('');
  sel.addEventListener('change', renderChecklist);
}

/* ---------------- area tab ---------------- */

function renderArea() {
  const rows = (state.driveTimes && state.driveTimes.neighborhoods) || [];
  if (!rows.length) { $('#area-table').innerHTML = '<p class="muted">No drive-time data yet.</p>'; return; }
  $('#area-table').innerHTML = `
    <table class="area-tbl">
      <thead><tr><th>Neighborhood</th><th class="num">Minutes</th><th class="num">Miles</th><th></th></tr></thead>
      <tbody>${rows.slice().sort((a, b) => a.minutes - b.minutes).map(n => {
        const edge = n.inRadius && n.minutes >= 8.5;
        return `<tr>
          <td>${esc(n.name)}</td>
          <td class="num">${n.minutes}</td>
          <td class="num">${n.miles}</td>
          <td><span class="tag ${n.inRadius ? (edge ? 'tag-edge' : 'tag-in') : 'tag-out'}">${
            n.inRadius ? (edge ? 'tight in traffic' : 'in range') : 'too far'}</span></td>
        </tr>`;
      }).join('')}</tbody>
    </table>`;
}

/* ---------------- tabs ---------------- */

function initTabs() {
  $$('.tab').forEach(t => t.addEventListener('click', () => {
    $$('.tab').forEach(x => x.classList.toggle('is-active', x === t));
    $$('.panel').forEach(p => p.classList.toggle('is-active', p.id === 'panel-' + t.dataset.tab));
    if (t.dataset.tab === 'map') renderMap();
  }));
}

/* ---------------- boot ---------------- */

(async function boot() {
  try {
    const [homesDoc, anchors, rubric, checklist] = await Promise.all([
      loadJSON('data/homes.json'),
      loadJSON('data/anchors.json'),
      loadJSON('data/rubric.json'),
      loadJSON('data/checklist.json'),
    ]);
    state.homes = homesDoc.homes || [];
    state.anchors = anchors;
    state.rubric = rubric;
    state.checklist = checklist;
    state.driveTimes = await loadJSON('data/drivetimes.json').catch(() => null);
  } catch (e) {
    document.querySelector('.wrap').insertAdjacentHTML('afterbegin',
      `<div class="banner banner-warn"><strong>Couldn't load the data files.</strong> ${esc(e.message)}</div>`);
    return;
  }

  initTabs();
  initTourPicker();
  $('#sort').addEventListener('change', renderHomes);
  $('#filter').addEventListener('change', renderHomes);
  $('#built').textContent = new Date().toLocaleDateString();

  renderHomes();
  renderChecklist();
  renderArea();
})();
