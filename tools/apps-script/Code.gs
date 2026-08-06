/**
 * Shared ratings + comments backend for the family home-search page.
 *
 * Paste this into a Google Apps Script project bound to a Google Sheet, deploy it as a
 * web app, and put the /exec URL into docs/config.js. Setup walkthrough:
 * tools/apps-script/SETUP.md
 *
 * Two tabs get created automatically on first use:
 *   Ratings   homeId | who | stars | updatedAt
 *   Comments  homeId | who | text  | at
 *
 * One rating per person per home — re-rating overwrites your previous star count rather
 * than piling up duplicate rows, so the average stays honest.
 */

const RATINGS = 'Ratings';
const COMMENTS = 'Comments';

function sheet_(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(headers);
    sh.setFrozenRows(1);
  }
  return sh;
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/** GET ?action=list -> { ratings: {homeId:{who:stars}}, comments: {homeId:[{who,text,at}]} } */
function doGet(e) {
  try {
    const rSh = sheet_(RATINGS, ['homeId', 'who', 'stars', 'updatedAt']);
    const cSh = sheet_(COMMENTS, ['homeId', 'who', 'text', 'at']);

    const ratings = {};
    const rRows = rSh.getLastRow() > 1
      ? rSh.getRange(2, 1, rSh.getLastRow() - 1, 3).getValues() : [];
    rRows.forEach(function (row) {
      const id = String(row[0]).trim(), who = String(row[1]).trim();
      const stars = Number(row[2]);
      if (!id || !who || !stars) return;
      if (!ratings[id]) ratings[id] = {};
      ratings[id][who] = stars;
    });

    const comments = {};
    const cRows = cSh.getLastRow() > 1
      ? cSh.getRange(2, 1, cSh.getLastRow() - 1, 4).getValues() : [];
    cRows.forEach(function (row) {
      const id = String(row[0]).trim();
      if (!id) return;
      if (!comments[id]) comments[id] = [];
      comments[id].push({
        who: String(row[1]),
        text: String(row[2]),
        at: row[3] instanceof Date ? row[3].toISOString() : String(row[3]),
      });
    });

    return json_({ ok: true, ratings: ratings, comments: comments });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

/**
 * POST body (text/plain to skip the CORS preflight Apps Script handles badly):
 *   { action: 'rate',    homeId, who, value }
 *   { action: 'comment', homeId, who, text, at }
 */
function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000); // serialize writes so two people rating at once can't clobber a row
    const body = JSON.parse((e.postData && e.postData.contents) || '{}');
    const homeId = String(body.homeId || '').trim();
    const who = String(body.who || '').trim().slice(0, 40);
    if (!homeId || !who) return json_({ ok: false, error: 'homeId and who are required' });

    if (body.action === 'rate') {
      const stars = Math.max(1, Math.min(5, Number(body.value) || 0));
      if (!stars) return json_({ ok: false, error: 'value must be 1-5' });
      const sh = sheet_(RATINGS, ['homeId', 'who', 'stars', 'updatedAt']);
      const rows = sh.getLastRow() > 1
        ? sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues() : [];
      const now = new Date();
      for (var i = 0; i < rows.length; i++) {
        if (String(rows[i][0]).trim() === homeId && String(rows[i][1]).trim() === who) {
          sh.getRange(i + 2, 3, 1, 2).setValues([[stars, now]]); // update in place
          return json_({ ok: true, updated: true });
        }
      }
      sh.appendRow([homeId, who, stars, now]);
      return json_({ ok: true, created: true });
    }

    if (body.action === 'comment') {
      const text = String(body.text || '').trim().slice(0, 2000);
      if (!text) return json_({ ok: false, error: 'text is required' });
      const sh = sheet_(COMMENTS, ['homeId', 'who', 'text', 'at']);
      sh.appendRow([homeId, who, text, body.at ? new Date(body.at) : new Date()]);
      return json_({ ok: true, created: true });
    }

    return json_({ ok: false, error: 'unknown action: ' + body.action });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (ignored) {}
  }
}
