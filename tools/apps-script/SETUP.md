# Turning on shared family ratings

The page works without this — ratings just save to whoever's device made them, and a banner
says so. This makes ratings and comments **shared across the whole family**, which is what you
asked for. About 5 minutes, one time.

Why Google Apps Script: GitHub Pages can only serve static files, so live shared ratings need
*something* server-side. Apps Script is free forever, needs no new account (you already have
`vl@ywamchateau.com`), and the data lands in a spreadsheet you can read and edit directly —
which is a real advantage when someone fat-fingers a rating.

## Steps

1. **Create the sheet.** Go to [sheets.new](https://sheets.new) and name it something like
   `COS Home Search — Family Ratings`. Leave it empty; the script builds its own tabs.

2. **Open the script editor.** In that sheet: **Extensions → Apps Script**.

3. **Paste the code.** Delete whatever is in `Code.gs`, then paste the full contents of
   [`Code.gs`](Code.gs) from this folder. Save (⌘S).

4. **Deploy.** Click **Deploy → New deployment**.
   - Click the gear next to "Select type" and choose **Web app**
   - Description: `home search ratings`
   - **Execute as: Me**
   - **Who has access: Anyone** ← this matters. "Anyone with Google account" will break it,
     because family members hitting the page aren't authenticating.
   - Click **Deploy**

5. **Authorize.** Google will warn that the script needs permission. Click
   **Review permissions → [your account] → Advanced → Go to (unsafe) → Allow**.
   The "unsafe" wording is just Google's boilerplate for scripts it hasn't reviewed —
   it's your own script, and you can read every line of it in `Code.gs`.

6. **Copy the Web app URL.** It ends in `/exec`. It'll look like:
   ```
   https://script.google.com/macros/s/AKfycb…long-id…/exec
   ```

7. **Give it to Claude**, or paste it yourself into [`docs/config.js`](../../docs/config.js):
   ```js
   window.COS_CONFIG = {
     apiUrl: "https://script.google.com/macros/s/AKfycb…/exec",
   };
   ```

8. **Publish:** `./deploy.sh "enable shared ratings"`

Reload the page and the yellow banner should be gone. Rate something, then open the page on
your phone — the rating should already be there.

## Checking it works

Paste the `/exec` URL with `?action=list` on the end into a browser. You should see:

```json
{"ok":true,"ratings":{},"comments":{}}
```

If you get an HTML error page instead, the deployment access setting is almost certainly
"Anyone with Google account" rather than **Anyone**.

## Things worth knowing

- **One rating per person per home.** Re-rating overwrites your old star count instead of
  stacking duplicate rows, so averages stay honest.
- **Identity is just a first name** typed once per device and kept in that browser. There are
  no passwords. Anyone with the page URL could type any name — fine for a family, not a
  security boundary. That's also why we keep last names off it.
- **The URL is the only thing protecting this.** Treat the `/exec` URL like a house key: it's
  unguessable, but anyone holding it can post. Don't put it anywhere public.
- **Editing by hand is fine.** Open the sheet and fix or delete rows whenever you want; the
  page reflects it on the next load.
- **After changing `Code.gs`**, you must **Deploy → Manage deployments → edit → Deploy** again.
  Saving alone does not update the live web app — this trips everyone up once.
