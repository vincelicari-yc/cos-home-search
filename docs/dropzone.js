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

  /** Pull every house out of a pasted blob. Handles one URL, several URLs, a bare address, or a
   *  whole listing copy-pasted off Zillow with the link buried in it. */
  function parseMany(raw) {
    const text = String(raw || '').trim();
    if (!text) return [];

    const urls = text.match(/https?:\/\/[^\s"'<>)\]]+/g) || [];
    if (urls.length) {
      const seen = new Set();
      return urls
        .map(u => u.replace(/[.,;)]+$/, ''))
        .filter(u => !seen.has(u) && seen.add(u))
        .map(u => parseListing(u))
        .filter(Boolean);
    }

    // No links at all. Look for something that reads like a street address, line by line, so a
    // pasted listing body still gives us something to work with.
    for (const line of text.split(/[\n\r]+/).map(s => s.trim()).filter(Boolean)) {
      const m = line.match(/\d{1,6}\s+[A-Za-z0-9'.\- ]{3,60}?(?:,\s*[A-Za-z .'-]{2,30})?(?:,?\s*[A-Z]{2})?\s*\d{5}?/);
      const cand = (m && m[0].trim()) || (/^\d+\s+\S+/.test(line) ? line : null);
      if (cand) {
        const one = parseListing(cand);
        if (one) return [one];
      }
    }
    const fallback = parseListing(text.split(/[\n\r]+/)[0]);
    return fallback ? [fallback] : [];
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
      <div class="dzbox">
        <label class="dz-step" for="dz-input">Paste the house here</label>
        <textarea id="dz-input" class="dz-ta" rows="3" spellcheck="false"
          placeholder="Paste a Zillow or Redfin link — or the address, or the whole listing. More than one is fine, one per line."></textarea>

        <div class="dz-or"><span>or</span></div>

        <div class="dz" id="dz" tabindex="0" role="button"
             aria-label="Drag a listing link here to fill the box above">
          <span class="dz-dragtext">Drag a link onto here <span class="dz-icon" aria-hidden="true">&#8681;</span></span>
        </div>

        <button type="button" class="btn dz-go" id="dz-send">Send to Claude</button>
      </div>
      <p class="dz-mode" id="dz-mode"></p>
      <div id="dz-queue"></div>`;

    const zone = root.querySelector('#dz');
    const modeEl = root.querySelector('#dz-mode');
    const listEl = root.querySelector('#dz-queue');
    let flash = null;

    function renderMode() {
      modeEl.innerHTML = mode === 'local'
        ? `<span class="dz-badge dz-badge-live">Connected to Claude</span>
           Paste a link and hit <strong>Send</strong> — that's all. The score appears above on its
           own once Claude has looked at it.`
        : `<span class="dz-badge">Sharing mode</span> Hit <strong>Send</strong> to add it to the
           list, then <strong>Copy request for Claude</strong> and paste that into your chat with
           Claude. This page has no server behind it, so it can't reach Claude by itself.`;
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
          <h4>${mode === 'local' ? 'Sent to Claude' : 'Ready to send'}
            <span class="dz-count">${queue.length}</span></h4>
          <div class="dz-actions">
            ${mode === 'local' ? '' :
              '<button type="button" class="btn" id="dz-copy">Copy request for Claude</button>'}
            <button type="button" class="btn btn-ghost" id="dz-clear">Clear</button>
          </div>
        </div>
        <ol class="dz-list">${queue.map((q, i) => {
          const st = q.status || 'queued';
          const label = { queued: 'Waiting for Claude', analysing: 'Analysing now',
                          done: 'Done', failed: 'Failed' }[st] || st;
          return `
          <li class="dz-st-${esc(st)}">
            <div>
              <span class="dz-addr">${esc(q.address || 'Address will come from the link')}</span>
              <span class="dz-meta">
                <span class="dz-chip dz-chip-${esc(st)}">${esc(label)}</span>
                ${q.url ? `<a class="dz-url" href="${esc(q.url)}" target="_blank"
                      rel="noopener noreferrer">${esc(q.source || q.site || 'link')} link</a>` : ''}
              </span>
              ${q.note ? `<span class="dz-note">${esc(q.note)}</span>` : ''}
            </div>
            <button type="button" class="dz-x" data-i="${i}" aria-label="Remove">&times;</button>
          </li>`; }).join('')}</ol>`;

      listEl.querySelectorAll('.dz-x').forEach(b => b.addEventListener('click', async () => {
        await remove(Number(b.dataset.i));
        flash = null;
        render();
      }));
      const copy = listEl.querySelector('#dz-copy');
      if (copy) copy.addEventListener('click', async () => {
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
      const found = parseMany(raw);
      if (!found.length) {
        flash = "Couldn't find a listing link or an address in that. Paste the Zillow URL, or just the street address.";
        zone.classList.add('dz-bad');
        setTimeout(() => zone.classList.remove('dz-bad'), 1000);
        render();
        return 0;
      }

      let added = 0, dupes = 0;
      for (const entry of found) {
        const res = await add(entry);
        if (res && res.duplicate) dupes++; else added++;
      }

      const names = found.map(f => f.address).filter(Boolean);
      if (!added) {
        flash = dupes === 1 ? 'Already sent — it\'s in the list below.'
                            : `All ${dupes} of those were already sent.`;
      } else if (mode === 'local') {
        flash = added === 1
          ? `Sent. ${names[0] || 'That house'} is with Claude now — nothing else to do.`
          : `Sent ${added} houses to Claude — nothing else to do.`;
      } else {
        flash = added === 1
          ? `Added ${names[0] || 'that house'}. Now hit “Copy request for Claude” and paste it into your chat.`
          : `Added ${added} houses. Now hit “Copy request for Claude” and paste it into your chat.`;
      }
      zone.classList.add('dz-ok');
      setTimeout(() => zone.classList.remove('dz-ok'), 900);
      render();
      startPolling();
      return added;
    }

    const input = root.querySelector('#dz-input');
    const sendBtn = root.querySelector('#dz-send');

    async function send() {
      const v = input.value.trim();
      if (!v) { input.focus(); return; }
      sendBtn.disabled = true;
      const label = sendBtn.textContent;
      sendBtn.textContent = 'Sending…';
      const n = await accept(v);
      if (n > 0) input.value = '';
      sendBtn.disabled = false;
      sendBtn.textContent = label;
      startPolling();
    }
    sendBtn.addEventListener('click', send);
    // Cmd/Ctrl-Enter sends without reaching for the mouse.
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(); }
    });

    /* While something is queued or mid-analysis, poll so the page reflects progress on its own.
     * Also watches the homes fingerprint, so the moment a new analysis lands the card list
     * refreshes without a manual reload. */
    let poller = null, lastHomes = null;
    function outstanding() {
      return queue.some(q => !q.status || q.status === 'queued' || q.status === 'analysing');
    }
    function startPolling() {
      if (mode !== 'local' || poller) return;
      poller = setInterval(async () => {
        try {
          const d = await fetch('api/queue', { cache: 'no-store' }).then(r => r.json());
          const changed = JSON.stringify(d.pending) !== JSON.stringify(queue);
          queue = d.pending || [];
          const fp = d.homes && `${d.homes.count}:${d.homes.mtime}`;
          if (fp && lastHomes && fp !== lastHomes && window.COSApp && window.COSApp.reload) {
            window.COSApp.reload();
          }
          if (fp) lastHomes = fp;
          if (changed) render();
          if (!outstanding()) { clearInterval(poller); poller = null; }
        } catch { clearInterval(poller); poller = null; }
      }, 4000);
    }

    ['dragenter', 'dragover'].forEach(ev => zone.addEventListener(ev, e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      zone.classList.add('dz-over');
    }));
    ['dragleave', 'dragend'].forEach(ev => zone.addEventListener(ev, () => zone.classList.remove('dz-over')));
    /* A drop FILLS the box rather than sending immediately, so you always see what's about to
     * go and can add more before hitting Send. */
    function fill(text) {
      const v = String(text || '').trim();
      if (!v) return;
      input.value = input.value.trim() ? input.value.trim() + '\n' + v : v;
      input.focus();
      zone.classList.add('dz-ok');
      setTimeout(() => zone.classList.remove('dz-ok'), 700);
      flash = 'Dropped in — hit Send to Claude when you\'re ready.';
      render();
    }
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.classList.remove('dz-over');
      const dt = e.dataTransfer;
      fill(dt.getData('text/uri-list') || dt.getData('text/plain') || dt.getData('text'));
    });
    zone.addEventListener('click', () => input.focus());
    zone.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.focus(); }
    });

    detectServer().then(() => { render(); if (outstanding()) startPolling(); });
  }

  return { init, parseListing, parseMany, addressFromSlug, requestText, _queue: () => queue };
})();
