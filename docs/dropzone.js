/* Drop zone — collect listing links to hand to Claude.
 *
 * The page is static, so it cannot scrape Zillow or score a house itself: Zillow blocks browser
 * requests, and scoring needs the stealth proxy plus judgement against criteria/. What this does
 * is capture the link, parse the address out of the URL, and queue it.
 *
 * Two modes, detected automatically:
 *   local  — served by tools/serve.py, so POST /api/queue writes straight to data/queue.json
 *            and Claude picks it up with no copy-paste at all.
 *   shared — the published page or Artifact. Queue lives in this browser, and one button copies
 *            a ready-to-send request.
 *
 * Shared by docs/index.html and the inlined artifact build, so keep it dependency-free.
 */
'use strict';

window.COSDrop = (function () {

  const LS_KEY = 'cos.queue';

  /* Multi-word city names we might actually see, longest first, so "Colorado Springs" wins over
   * "Springs". Without this the street/city split in a Zillow slug is ambiguous. */
  const CITIES = [
    'Colorado Springs', 'Manitou Springs', 'Woodland Park', 'Black Forest', 'Green Mountain Falls',
    'Cripple Creek', 'Security Widefield', 'Fort Carson', 'Air Force Academy',
    'Monument', 'Fountain', 'Falcon', 'Peyton', 'Calhan', 'Elbert', 'Larkspur', 'Palmer Lake',
  ];

  function titleCase(s) {
    return s.replace(/\S+/g, w =>
      /^(?:[NSEW]|NE|NW|SE|SW)$/i.test(w) ? w.toUpperCase()
        : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  }

  /** Turn a slug like "1443-Acacia-Dr-Colorado-Springs-CO-80907" into a real address.
   *  cityHint / stateHint come from Redfin URLs, which carry them as their own path segments. */
  function addressFromSlug(slug, cityHint, stateHint) {
    let words = decodeURIComponent(slug).replace(/_/g, '-').split('-').filter(Boolean);
    let zip = null, state = stateHint || null;

    if (/^\d{5}$/.test(words[words.length - 1])) zip = words.pop();
    if (words.length && /^[A-Za-z]{2}$/.test(words[words.length - 1])
        && !/^(?:st|dr|rd|ln|ct|pl|cir|ave|way|pt|tr)$/i.test(words[words.length - 1])) {
      state = words.pop().toUpperCase();
    }

    let city = cityHint || null;
    if (!city) {
      const tail = words.join(' ').toLowerCase();
      for (const c of CITIES) {
        if (tail.endsWith(c.toLowerCase())) {
          city = c;
          words = words.slice(0, words.length - c.split(' ').length);
          break;
        }
      }
      // Fall back to assuming the last two words are the city rather than guessing wrong.
      if (!city && words.length > 3) {
        city = titleCase(words.slice(-2).join(' '));
        words = words.slice(0, -2);
      }
    }

    const street = titleCase(words.join(' '));
    if (!street) return null;
    return [street, city, [state, zip].filter(Boolean).join(' ')].filter(Boolean).join(', ').trim();
  }

  /** Recognise a listing URL and pull out what we can. Returns null if it isn't one. */
  function parseListing(raw) {
    const text = String(raw || '').trim();
    if (!text) return null;

    const m = text.match(/https?:\/\/[^\s"'<>]+/);
    if (!m) {
      // Not a URL. If it looks like a street address, accept it as an address-only entry.
      if (/\d+\s+\S+/.test(text) && text.length < 120) {
        const addr = titleCase(text.replace(/\s+/g, ' '))
          .replace(/\b([A-Za-z]{2})\b(?=[,\s]+\d{5}\b)/, (m0, s) => s.toUpperCase());
        return { url: null, address: addr, site: 'address' };
      }
      return null;
    }

    let u;
    try { u = new URL(m[0]); } catch { return null; }
    const host = u.hostname.replace(/^www\./, '').toLowerCase();
    const seg = u.pathname.split('/').filter(Boolean);

    if (host.endsWith('zillow.com')) {
      const i = seg.indexOf('homedetails');
      const slug = i >= 0 ? seg[i + 1] : null;
      const zpid = (u.pathname.match(/(\d+)_zpid/) || [])[1] || null;
      return {
        url: u.href, site: 'Zillow', id: zpid,
        address: slug ? addressFromSlug(slug) : null,
        isListing: Boolean(slug || zpid),
      };
    }

    if (host.endsWith('redfin.com')) {
      // /CO/Colorado-Springs/1443-Acacia-Dr-80907/home/12345678
      const hi = seg.indexOf('home');
      const state = seg[0] && /^[A-Za-z]{2}$/.test(seg[0]) ? seg[0].toUpperCase() : null;
      const city = seg[1] ? titleCase(seg[1].replace(/-/g, ' ')) : null;
      const slug = hi > 0 ? seg[hi - 1] : seg[2] || null;
      const address = slug ? addressFromSlug(slug, city, state) : null;
      return { url: u.href, site: 'Redfin', id: seg[hi + 1] || null, address, isListing: Boolean(slug) };
    }

    return { url: u.href, site: host, id: null, address: null, isListing: false };
  }

  /* ---------------- queue storage ---------------- */

  let mode = 'shared';   // becomes 'local' if tools/serve.py answers
  let queue = [];

  function loadLocalStorage() {
    try { queue = JSON.parse(localStorage.getItem(LS_KEY)) || []; } catch { queue = []; }
  }
  function saveLocalStorage() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(queue)); } catch { /* private mode */ }
  }

  async function detectServer() {
    try {
      const r = await fetch('api/queue', { cache: 'no-store' });
      if (!r.ok) throw new Error('no endpoint');
      const d = await r.json();
      mode = 'local';
      queue = d.pending || [];
      return true;
    } catch {
      mode = 'shared';
      loadLocalStorage();
      return false;
    }
  }

  async function add(entry) {
    if (queue.some(q => (q.url && q.url === entry.url) || (!entry.url && q.address === entry.address))) {
      return { duplicate: true };
    }
    if (mode === 'local') {
      try {
        const r = await fetch('api/queue', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: entry.url, address: entry.address, source: entry.site }),
        });
        const d = await r.json();
        if (d.pending) queue = d.pending;
        return d;
      } catch { mode = 'shared'; loadLocalStorage(); }
    }
    queue.push({ ...entry, addedAt: new Date().toISOString() });
    saveLocalStorage();
    return { ok: true };
  }

  async function remove(idx) {
    queue.splice(idx, 1);
    if (mode === 'local') {
      // Simplest correct thing: clear and replay, so the file always matches the UI.
      try {
        await fetch('api/queue/clear', { method: 'POST' });
        for (const q of queue.slice()) {
          await fetch('api/queue', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: q.url, address: q.address, source: q.source || q.site }),
          });
        }
      } catch { /* fall through to local copy */ }
    } else saveLocalStorage();
  }

  function requestText() {
    const lines = queue.map((q, i) =>
      `${i + 1}. ${q.address || '(address in the link)'}` + (q.url ? `\n   ${q.url}` : ''));
    return 'Please analyse these homes for the Colorado Springs search:\n\n' + lines.join('\n\n');
  }

  /* ---------------- UI ---------------- */

  function init(root) {
    if (!root) return;
    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    root.innerHTML = `
      <div class="dz" id="dz" tabindex="0" role="button"
           aria-label="Drop a Zillow or Redfin link here to add a house">
        <div class="dz-icon" aria-hidden="true">&#8681;</div>
        <p class="dz-main">Drag a <strong>Zillow</strong> or <strong>Redfin</strong> link here</p>
        <p class="dz-sub">…or click and paste one. You can also paste a plain address.</p>
      </div>
      <p class="dz-mode" id="dz-mode"></p>
      <div id="dz-queue"></div>`;

    const zone = root.querySelector('#dz');
    const modeEl = root.querySelector('#dz-mode');
    const listEl = root.querySelector('#dz-queue');
    let flash = null;

    function renderMode() {
      modeEl.innerHTML = mode === 'local'
        ? `<span class="dz-badge dz-badge-live">Connected</span> Dropped houses are saved straight
           to <code>data/queue.json</code> — just tell Claude “process the queue”.`
        : `<span class="dz-badge">Shared page</span> This page can't score a house on its own —
           Zillow blocks browsers. Queue them up here, then copy the request and send it to Claude.`;
    }

    function render() {
      renderMode();
      if (!queue.length) {
        listEl.innerHTML = flash ? `<p class="dz-flash">${esc(flash)}</p>` : '';
        return;
      }
      listEl.innerHTML = `
        ${flash ? `<p class="dz-flash">${esc(flash)}</p>` : ''}
        <div class="dz-head">
          <h4>Waiting to be analysed <span class="dz-count">${queue.length}</span></h4>
          <div class="dz-actions">
            <button type="button" class="btn" id="dz-copy">Copy request for Claude</button>
            <button type="button" class="btn btn-ghost" id="dz-clear">Clear</button>
          </div>
        </div>
        <ol class="dz-list">${queue.map((q, i) => `
          <li>
            <div>
              <span class="dz-addr">${esc(q.address || 'Address will come from the link')}</span>
              ${q.url ? `<a class="dz-url" href="${esc(q.url)}" target="_blank"
                    rel="noopener noreferrer">${esc((q.source || q.site || 'link'))} link</a>` : ''}
            </div>
            <button type="button" class="dz-x" data-i="${i}" aria-label="Remove">&times;</button>
          </li>`).join('')}</ol>`;

      listEl.querySelectorAll('.dz-x').forEach(b => b.addEventListener('click', async () => {
        await remove(Number(b.dataset.i));
        flash = null;
        render();
      }));
      const copy = listEl.querySelector('#dz-copy');
      copy.addEventListener('click', async () => {
        const text = requestText();
        try {
          await navigator.clipboard.writeText(text);
          copy.textContent = 'Copied ✓';
        } catch {
          // Clipboard API needs a secure context; fall back to a selectable box.
          const ta = document.createElement('textarea');
          ta.className = 'dz-fallback';
          ta.value = text;
          ta.rows = Math.min(12, queue.length * 3 + 2);
          listEl.appendChild(ta);
          ta.select();
          copy.textContent = 'Select and copy ↑';
        }
        setTimeout(() => { copy.textContent = 'Copy request for Claude'; }, 2600);
      });
      listEl.querySelector('#dz-clear').addEventListener('click', async () => {
        queue = [];
        if (mode === 'local') { try { await fetch('api/queue/clear', { method: 'POST' }); } catch {} }
        else saveLocalStorage();
        flash = null;
        render();
      });
    }

    async function accept(raw) {
      const parsed = parseListing(raw);
      if (!parsed) {
        flash = "That didn't look like a listing link or an address.";
        zone.classList.add('dz-bad');
        setTimeout(() => zone.classList.remove('dz-bad'), 900);
        return render();
      }
      if (parsed.isListing === false && parsed.site !== 'address') {
        flash = `That's a ${parsed.site} link, not a Zillow or Redfin listing — queued anyway so Claude can look.`;
      } else {
        flash = null;
      }
      const res = await add(parsed);
      if (res.duplicate) flash = 'Already in the queue.';
      else if (!flash) {
        flash = parsed.address
          ? `Added ${parsed.address}.`
          : 'Added — Claude will pull the address from the link.';
      }
      zone.classList.add('dz-ok');
      setTimeout(() => zone.classList.remove('dz-ok'), 900);
      render();
    }

    ['dragenter', 'dragover'].forEach(ev => zone.addEventListener(ev, e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      zone.classList.add('dz-over');
    }));
    ['dragleave', 'dragend'].forEach(ev => zone.addEventListener(ev, () => zone.classList.remove('dz-over')));
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.classList.remove('dz-over');
      const dt = e.dataTransfer;
      accept(dt.getData('text/uri-list') || dt.getData('text/plain') || dt.getData('text'));
    });

    // Click to focus, then paste. Also accepts a paste anywhere while the zone has focus.
    zone.addEventListener('click', () => zone.focus());
    zone.addEventListener('paste', e => {
      e.preventDefault();
      accept((e.clipboardData || window.clipboardData).getData('text'));
    });
    zone.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); zone.focus(); }
    });

    detectServer().then(render);
  }

  return { init, parseListing, addressFromSlug, requestText, _queue: () => queue };
})();
