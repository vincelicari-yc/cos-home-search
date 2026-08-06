#!/usr/bin/env python3
"""
Local preview server for the home-search site, with a drop-queue endpoint.

    ./serve.sh            -> http://localhost:8765

Serves docs/ statically, exactly like `python3 -m http.server` did, PLUS:

    POST /api/queue   {"url": "...", "address": "..."}   appends to data/queue.json
    GET  /api/queue                                      returns the queue
    POST /api/queue/clear                                 empties it

That endpoint is why this exists instead of http.server. The published page has no backend, so
dropping a link there can only copy a request to the clipboard. When the page is served from
here, the same drop zone detects the endpoint and writes the house straight into
data/queue.json, which Claude reads on the next turn. Same UI, no copy-paste.

Only ever bound to localhost. Nothing here is exposed to the network.
"""

import json
import pathlib
import sys
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = pathlib.Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"
QUEUE = ROOT / "data" / "queue.json"
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8765


def read_queue():
    if not QUEUE.exists():
        return {"pending": []}
    try:
        return json.loads(QUEUE.read_text())
    except Exception:
        return {"pending": []}


def write_queue(q):
    QUEUE.write_text(json.dumps(q, indent=2, ensure_ascii=False) + "\n")


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(DOCS), **kw)

    def log_message(self, fmt, *args):
        # Quiet the per-asset noise; only surface queue activity.
        if "/api/queue" in (self.path or ""):
            sys.stderr.write("  %s %s\n" % (self.command, self.path))

    def _json(self, obj, code=200):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path.split("?")[0] == "/api/queue":
            return self._json(read_queue())
        return super().do_GET()

    def do_POST(self):
        path = self.path.split("?")[0]
        if path not in ("/api/queue", "/api/queue/clear"):
            self.send_error(404)
            return

        if path == "/api/queue/clear":
            write_queue({"pending": []})
            print("  queue cleared")
            return self._json({"ok": True, "pending": []})

        try:
            n = int(self.headers.get("Content-Length") or 0)
            body = json.loads(self.rfile.read(n) or b"{}")
        except Exception as exc:
            return self._json({"ok": False, "error": f"bad JSON: {exc}"}, 400)

        url = str(body.get("url") or "").strip()
        if not url.startswith(("http://", "https://")):
            return self._json({"ok": False, "error": "not a URL"}, 400)

        q = read_queue()
        if any(p.get("url") == url for p in q["pending"]):
            return self._json({"ok": True, "duplicate": True, "pending": q["pending"]})

        q["pending"].append({
            "url": url,
            "address": str(body.get("address") or "").strip() or None,
            "source": str(body.get("source") or "").strip() or None,
            "addedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        })
        write_queue(q)
        print(f"  QUEUED  {body.get('address') or url}")
        return self._json({"ok": True, "pending": q["pending"]})


if __name__ == "__main__":
    if not DOCS.exists():
        sys.exit(f"docs/ not found at {DOCS}")
    print(f"Serving {DOCS.relative_to(ROOT)} at http://localhost:{PORT}")
    print(f"Drop-queue endpoint live — dropped links land in {QUEUE.relative_to(ROOT)}")
    print("ctrl-C to stop\n")
    try:
        ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
    except KeyboardInterrupt:
        print("\nstopped")
