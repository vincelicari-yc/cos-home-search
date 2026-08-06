#!/usr/bin/env python3
"""
Geocode an address and compute driving time from the anchor (505 Popes Bluff Trail).

    ./tools/intake.py "1234 W Example St, Colorado Springs, CO"
    ./tools/intake.py --check-neighborhoods

Prints a JSON fragment ready to paste into the `geo` block of data/homes.json.
Uses Nominatim for geocoding and OSRM for routing -- both free, no API key, both
rate-limited, so it sleeps politely between calls.

Exit code 2 means the address is outside the 10-minute radius (a hard-parameter failure).
"""

import json
import pathlib
import subprocess
import sys
import time
import urllib.parse

ROOT = pathlib.Path(__file__).resolve().parent.parent
ANCHORS = json.loads((ROOT / "data" / "anchors.json").read_text())
ANCHOR = ANCHORS["primary"]
MAX_MIN = ANCHOR["maxDriveMinutes"]
UA = "cos-home-search/1.0 (vl@ywamchateau.com)"


def _get(url):
    """GET JSON via curl.

    Not urllib: macOS ships Python 3.9 linked against LibreSSL 2.8.3, which fails the TLS
    handshake against OSRM outright. curl on the same machine negotiates it fine, so we
    borrow curl's TLS stack and keep this script dependency-free.
    """
    out = subprocess.run(
        ["curl", "-sSL", "--fail", "--max-time", "30", "-A", UA, url],
        capture_output=True, text=True,
    )
    if out.returncode != 0:
        raise RuntimeError(f"curl failed ({out.returncode}): {out.stderr.strip()[:200]}")
    return json.loads(out.stdout)


def _geocode_census(address):
    """US Census geocoder. Far better than Nominatim on residential street addresses,
    which is exactly what we feed it, so it goes first."""
    q = urllib.parse.urlencode({
        "address": address, "benchmark": "Public_AR_Current", "format": "json",
    })
    d = _get(f"https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?{q}")
    matches = d.get("result", {}).get("addressMatches") or []
    if not matches:
        return None
    m = matches[0]
    return float(m["coordinates"]["y"]), float(m["coordinates"]["x"]), m["matchedAddress"]


def _geocode_nominatim(address):
    """OpenStreetMap fallback. Good on landmarks and businesses, weak on house numbers."""
    q = urllib.parse.urlencode(
        {"q": address, "format": "json", "limit": 1, "countrycodes": "us"}
    )
    hits = _get(f"https://nominatim.openstreetmap.org/search?{q}")
    if not hits:
        return None
    h = hits[0]
    return float(h["lat"]), float(h["lon"]), h["display_name"]


def geocode(address):
    """Address -> (lat, lon, display_name), or None if both services strike out.

    Returning None matters: a failed geocode must surface as an error, never as a
    silently-wrong coordinate that then produces a confident, meaningless drive time.
    """
    if "colorado springs" not in address.lower():
        address = f"{address}, Colorado Springs, CO"
    for name, fn in (("census", _geocode_census), ("nominatim", _geocode_nominatim)):
        try:
            hit = fn(address)
        except Exception as e:
            print(f"  ({name} errored: {e})", file=sys.stderr)
            continue
        if hit:
            print(f"  (via {name})", file=sys.stderr)
            return hit
        print(f"  ({name}: no match)", file=sys.stderr)
        time.sleep(1.1)
    return None


def drive_from_anchor(lat, lon):
    """(minutes, miles) by car from the anchor to this point."""
    coords = f"{ANCHOR['lon']},{ANCHOR['lat']};{lon},{lat}"
    d = _get(f"https://router.project-osrm.org/route/v1/driving/{coords}?overview=false")
    if d.get("code") != "Ok" or not d.get("routes"):
        return None
    r = d["routes"][0]
    return round(r["duration"] / 60, 1), round(r["distance"] / 1609.34, 1)


def check_neighborhoods():
    """Sanity-check the 10-minute isochrone against known neighborhoods."""
    print(f"Drive time from {ANCHOR['label']} (limit {MAX_MIN} min)\n")
    print(f"{'Neighborhood':<22} {'Min':>6} {'Mi':>6}  {'Verdict':<9} Expected")
    print("-" * 68)
    rows = []
    for n in ANCHORS["referenceNeighborhoods"]:
        res = drive_from_anchor(n["lat"], n["lon"])
        if not res:
            print(f"{n['name']:<22} {'--':>6} {'--':>6}  routing failed")
            continue
        mins, miles = res
        verdict = "IN" if mins <= MAX_MIN else "OUT"
        surprise = "  <-- differs" if (
            (verdict == "IN") != (n["expectation"] == "inside")
        ) and n["expectation"] != "edge" else ""
        print(f"{n['name']:<22} {mins:>6} {miles:>6}  {verdict:<9} {n['expectation']}{surprise}")
        rows.append({"name": n["name"], "minutes": mins, "miles": miles, "inRadius": verdict == "IN"})
        time.sleep(0.4)
    out = ROOT / "data" / "drivetimes.json"
    out.write_text(json.dumps({"anchor": ANCHOR["label"], "maxMinutes": MAX_MIN,
                               "neighborhoods": rows}, indent=2) + "\n")
    print(f"\nCached -> {out.relative_to(ROOT)}")


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return 1
    if sys.argv[1] == "--check-neighborhoods":
        check_neighborhoods()
        return 0

    address = " ".join(sys.argv[1:])
    print(f"Geocoding: {address}", file=sys.stderr)
    g = geocode(address)
    if not g:
        print(f"FAILED to geocode: {address}", file=sys.stderr)
        return 1
    lat, lon, display = g
    print(f"  -> {display}", file=sys.stderr)
    time.sleep(1.1)

    res = drive_from_anchor(lat, lon)
    if not res:
        print("FAILED to route", file=sys.stderr)
        return 1
    mins, miles = res

    from datetime import date
    print(json.dumps({
        "lat": round(lat, 6), "lon": round(lon, 6),
        "neighborhood": None,
        "driveMinutesToAnchor": mins,
        "driveMilesToAnchor": miles,
        "routedAt": date.today().isoformat(),
    }, indent=2))

    if mins > MAX_MIN:
        print(f"\n*** OUTSIDE RADIUS: {mins} min > {MAX_MIN} min limit. "
              f"Hard-parameter failure -> status: rejected ***", file=sys.stderr)
        return 2
    print(f"\nOK: {mins} min from anchor (limit {MAX_MIN}).", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
