/* Home Search — Colorado Springs
 *
 * Static page, no build step. Loads data/*.json and renders. Ratings and comments go to a
 * Google Apps Script endpoint when one is configured in config.js; otherwise they fall back
 * to this device's localStorage so the page is still useful on day one.
 */
'use strict';

const API = (window.COS_CONFIG && window.COS_CONFIG.apiUrl || '').trim();
const LS = {
  who: 'cos.who',
  tourPrefix: 'cos.tour.',
  localRatings: 'cos.local.ratings',
  localComments: 'cos.local.comments',
};

const state = {
  homes: [],
  anchors: null,
  rubric: null,
  checklist: null,
  driveTimes: null,
  ratings: {},   // homeId -> { who: stars }
  comments: {},  // homeId -> [ {who, text, at} ]
  who: localStorage.getItem(LS.who) || '',
  shared: false, // true once the API answers
  map: null,
};

/* ---------------- utilities ---------------- */

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

/** Escape before interpolating into HTML. Comments are family-authored free text. */
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

const money = n => n == null ? '—' : '$' + Number(n).toLocaleString('en-US');

function relTime(iso) {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return mins + 'm ago';
  const h = Math.round(mins / 60);
  if (h < 24) return h + 'h ago';
  const d = Math.round(h / 24);
  return d < 30 ? d + 'd ago' : new Date(iso).toLocaleDateString();
}

async function loadJSON(path) {
  const r = await fetch(path, { cache: 'no-store' });
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  return r.json();
}

/* ---------------- scoring ----------------
 * Totals come from KNOWN criteria only, rescaled to 0-100, and we report how many were
 * known. An unresearched home must never look worse than one we dug into and found wanting.
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
  return {
    total: Math.round((got / weightKnown) * 100),
    known, of: list.length, rejected: false,
  };
}

const scoreClass = t => t == null ? 'score-none' : t >= 80 ? 'score-good' : t >= 65 ? 'score-ok' : 'score-bad';

/* ---------------- ratings backend ---------------- */

async function apiGet() {
  const r = await fetch(`${API}?action=list`, { method: 'GET' });
  if (!r.ok) throw new Error('list ' + r.status);
  return r.json();
}

/** text/plain dodges the CORS preflight that Apps Script handles poorly. */
async function apiPost(payload) {
  const r = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error('post ' + r.status);
  return r.json();
}

function loadLocal() {
  try { state.ratings  = JSON.parse(localStorage.getItem(LS.localRatings))  || {}; } catch { state.ratings = {}; }
  try { state.comments = JSON.parse(localStorage.getItem(LS.localComments)) || {}; } catch { state.comments = {}; }
}
const saveLocal = () => {
  localStorage.setItem(LS.localRatings, JSON.stringify(state.ratings));
  localStorage.setItem(LS.localComments, JSON.stringify(state.comments));
};

async function initRatings() {
  if (!API) { loadLocal(); showBanner('local'); return; }
  try {
    const d = await apiGet();
    state.ratings = d.ratings || {};
    state.comments = d.comments || {};
    state.shared = true;
  } catch (e) {
    console.warn('Shared ratings unreachable, falling back to this device.', e);
    loadLocal();
    showBanner('error');
  }
}

function showBanner(kind) {
  const el = $('#sync-banner');
  el.hidden = false;
  el.innerHTML = kind === 'local'
    ? `<strong>Ratings are saved to this device only.</strong> Everyone can rate and comment,
       but scores won't sync between people until shared ratings are switched on —
       see <code>tools/apps-script/SETUP.md</code> in the repo (about 5 minutes, one time).`
    : `<strong>Couldn't reach shared ratings.</strong> Your ratings are saving to this device
       for now and won't be visible to the rest of the family. Try reloading in a bit.`;
}

async function submitRating(homeId, stars) {
  if (!requireWho()) return;
  (state.ratings[homeId] = state.ratings[homeId] || {})[state.who] = stars;
  if (state.shared) {
    try { await apiPost({ action: 'rate', homeId, who: state.who, value: stars }); }
    catch (e) { console.warn('rate failed', e); }
  } else saveLocal();
  renderHomes();
}

async function submitComment(homeId, text) {
  if (!requireWho() || !text.trim()) return;
  const entry = { who: state.who, text: text.trim(), at: new Date().toISOString() };
  (state.comments[homeId] = state.comments[homeId] || []).push(entry);
  if (state.shared) {
    try { await apiPost({ action: 'comment', homeId, ...entry }); }
    catch (e) { console.warn('comment failed', e); }
  } else saveLocal();
  renderHomes();
}

/* ---------------- identity ---------------- */

function renderWho() {
  $('#who-label').textContent = state.who || 'Sign in';
}

function requireWho() {
  if (state.who) return true;
  $('#who-dialog').showModal();
  return false;
}

function initWho() {
  const dlg = $('#who-dialog'), input = $('#who-input');
  $('#who-btn').addEventListener('click', () => { input.value = state.who; dlg.showModal(); });
  dlg.addEventListener('close', () => {
    if (dlg.returnValue !== 'save') return;
    const v = input.value.trim().slice(0, 20);
    if (!v) return;
    state.who = v;
    localStorage.setItem(LS.who, v);
    renderWho();
    renderHomes();
  });
  renderWho();
}

/* ---------------- homes ---------------- */

function visibleHomes() {
  const f = $('#filter').value;
  let list = state.homes.slice();
  if (f === 'live')     list = list.filter(h => !['rejected', 'passed', 'archived'].includes(h.status));
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

function homeCard(h) {
  const sc = computeScore(h);
  const L = h.listing || {}, G = h.geo || {};
  const ratings = state.ratings[h.id] || {};
  const vals = Object.values(ratings).filter(v => typeof v === 'number');
  const avg = vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  const mine = ratings[state.who] || 0;
  const comments = (state.comments[h.id] || []).slice().sort((a, b) => String(a.at).localeCompare(String(b.at)));
  const photo = (h.photos && h.photos[0]) || null;

  const scoreBox = sc.rejected
    ? `<div class="score score-bad"><span class="score-n">✕</span><span class="score-l">out</span></div>`
    : `<div class="score ${scoreClass(sc.total)}">
         <span class="score-n">${sc.total ?? '—'}</span><span class="score-l">${sc.total == null ? 'no data' : 'score'}</span>
       </div>`;

  const facts = [
    L.beds != null && `<span class="fact"><strong>${L.beds}</strong> bd</span>`,
    L.baths != null && `<span class="fact"><strong>${L.baths}</strong> ba</span>`,
    L.sqft != null && `<span class="fact"><strong>${Number(L.sqft).toLocaleString()}</strong> sqft</span>`,
    L.price != null && `<span class="fact"><strong>${money(L.price)}</strong></span>`,
    L.yearBuilt != null && `<span class="fact">built <strong>${L.yearBuilt}</strong></span>`,
    G.driveMinutesToAnchor != null && `<span class="fact"><strong>${G.driveMinutesToAnchor}</strong> min to YWAM</span>`,
    L.hoaMonthly ? `<span class="fact">HOA <strong>${money(L.hoaMonthly)}</strong>/mo</span>` : '',
  ].filter(Boolean).join('');

  const flags = Object.values(h.flags || {})
    .filter(f => f && f.text)
    .map(f => `<div class="flag flag-${esc(f.severity || 'note')}">${esc(f.text)}</div>`).join('');

  const links = [
    L.zillowUrl && `<a class="btn btn-ghost" href="${esc(L.zillowUrl)}" target="_blank" rel="noopener noreferrer">Zillow</a>`,
    L.redfinUrl && `<a class="btn btn-ghost" href="${esc(L.redfinUrl)}" target="_blank" rel="noopener noreferrer">Redfin</a>`,
    `<a class="btn btn-ghost" href="https://www.google.com/maps/dir/?api=1&origin=${state.anchors.primary.lat},${state.anchors.primary.lon}&destination=${encodeURIComponent(h.address)}" target="_blank" rel="noopener noreferrer">Directions</a>`,
  ].filter(Boolean).join('');

  return `
  <article class="home ${sc.rejected ? 'is-rejected' : ''}">
    ${photo ? `<img class="home-photo" src="${esc(photo.url)}" alt="${esc(photo.caption || h.address)}" loading="lazy">` : ''}
    <div class="home-body">
      <div class="home-top">
        <div>
          <h3 class="home-addr">${esc(h.address)}</h3>
          <div class="home-hood">${esc(G.neighborhood || '')}${h.status && h.status !== 'active' ? ' · ' + esc(h.status) : ''}</div>
        </div>
        ${scoreBox}
      </div>

      ${h.rejectedReason ? `<div class="flag flag-critical" style="margin-top:10px">${esc(h.rejectedReason)}</div>` : ''}
      <div class="facts">${facts}</div>
      ${flags ? `<div class="flags">${flags}</div>` : ''}
      ${!sc.rejected && sc.total != null && sc.known < sc.of
        ? `<p class="confidence">Based on ${sc.known} of ${sc.of} criteria — ${sc.of - sc.known} still need verification.</p>` : ''}
      ${!sc.rejected && sc.total == null
        ? `<p class="confidence">Not scored yet.</p>` : ''}
      ${(h.openQuestions || []).length
        ? `<p class="confidence">Open questions: ${esc(h.openQuestions.join(' · '))}</p>` : ''}

      <div class="home-links">${links}</div>

      <div class="rate">
        <div class="rate-head">
          <h4>Family rating</h4>
          <span class="rate-avg">${avg ? `${avg.toFixed(1)} ★ · ${vals.length} vote${vals.length > 1 ? 's' : ''}` : 'no votes yet'}</span>
        </div>
        <div class="stars" data-home="${esc(h.id)}" role="group" aria-label="Your rating">
          ${[1, 2, 3, 4, 5].map(n => `<button class="star ${n <= mine ? 'on' : ''}" data-stars="${n}"
              type="button" title="${n} star${n > 1 ? 's' : ''}" aria-label="${n} of 5">★</button>`).join('')}
        </div>
        ${vals.length ? `<div class="votes">${Object.entries(ratings)
          .map(([w, v]) => `<span class="vote">${esc(w)} ${v}★</span>`).join('')}</div>` : ''}

        ${comments.length ? `<div class="comments">${comments.map(c => `
          <div class="comment">
            <span class="comment-who">${esc(c.who)}</span><span class="comment-when">${esc(relTime(c.at))}</span>
            <p class="comment-text">${esc(c.text)}</p>
          </div>`).join('')}</div>` : ''}

        <form class="comment-form" data-home="${esc(h.id)}">
          <textarea placeholder="Add a note for the family…" rows="1" maxlength="600"></textarea>
          <button class="btn" type="submit">Post</button>
        </form>
      </div>
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
        <h3>No homes added yet</h3>
        <p>Send Vince a Zillow or Redfin link — or a screenshot plus the address — and it'll
        show up here scored against everything we've learned, with drive time from YWAM
        already checked.</p>
      </div>`;
    return;
  }
  if (!list.length) {
    el.innerHTML = `<div class="empty"><div class="empty-mark">🔍</div>
      <h3>Nothing matches this filter</h3><p>Try “Everything” in the Show dropdown.</p></div>`;
    return;
  }
  el.innerHTML = list.map(homeCard).join('');

  $$('.stars .star').forEach(b => b.addEventListener('click', () =>
    submitRating(b.parentElement.dataset.home, Number(b.dataset.stars))));

  $$('.comment-form').forEach(f => f.addEventListener('submit', e => {
    e.preventDefault();
    const ta = $('textarea', f);
    submitComment(f.dataset.home, ta.value);
    ta.value = '';
  }));
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

  // Neighborhood reference dots — shows the family the shape of the search area.
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
      (sc.rejected ? `<b>Rejected:</b> ${esc(h.rejectedReason || '')}` : `Score: <b>${sc.total ?? 'not scored'}</b>`));
    pts.push([h.geo.lat, h.geo.lon]);
  }
  if (pts.length > 1) map.fitBounds(pts, { padding: [45, 45] });
}

/* ---------------- tour checklist ---------------- */

const tourKey = homeId => LS.tourPrefix + (homeId || '_general');

function tourState(homeId) {
  try { return JSON.parse(localStorage.getItem(tourKey(homeId))) || {}; } catch { return {}; }
}

function renderChecklist() {
  const homeId = $('#tour-home').value;
  const done = tourState(homeId);
  const secs = state.checklist.sections;
  let total = 0, checked = 0;

  $('#checklist').innerHTML = secs.map(sec => {
    const items = sec.items.map((it, i) => {
      const key = `${sec.id}.${i}`;
      const on = !!done[key];
      total++; if (on) checked++;
      return `<li><label class="check sev-${esc(it.severity)} ${on ? 'done' : ''}">
        <input type="checkbox" data-key="${esc(key)}" ${on ? 'checked' : ''}>
        <span>${esc(it.text)}</span></label></li>`;
    }).join('');
    const secDone = sec.items.filter((_, i) => done[`${sec.id}.${i}`]).length;
    return `<details class="section" ${secDone < sec.items.length ? 'open' : ''}>
      <summary>${esc(sec.title)} <span class="section-count">${secDone}/${sec.items.length}</span></summary>
      <p class="section-intro">${esc(sec.intro)}</p>
      <ul class="check-list">${items}</ul>
    </details>`;
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

  await initRatings();

  initWho();
  initTabs();
  initTourPicker();
  $('#sort').addEventListener('change', renderHomes);
  $('#filter').addEventListener('change', renderHomes);
  $('#built').textContent = new Date().toLocaleDateString();

  renderHomes();
  renderChecklist();
  renderArea();
})();
