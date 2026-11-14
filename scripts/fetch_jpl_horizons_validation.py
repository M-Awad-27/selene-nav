"""
ALRAKIS // SELENE-NAV — NASA JPL Horizons API Validation Client
NASA Space Apps Challenge 2026 · Team Alrakis (Muhammad Awad) · Virtual Islamabad

Specification Section 3.1 & 9.1:
Queries the official NASA JPL Horizons On-Line Ephemeris System API to cross-verify
topocentric airless Sun and Earth positions against our client-side analytical ephemeris engine.
"""

import urllib.request
import urllib.parse
import json
import sys

HORIZONS_API_URL = "https://ssd.jpl.nasa.gov/api/horizons.api"

def fetch_horizons_vector(target_command: str, lon: float, lat: float, elev_km: float, start_time: str, stop_time: str, step: str = "1h") -> dict:
    """
    Queries NASA JPL Horizons API for airless topocentric azimuth/elevation.
    Target: '10' (Sun), '399' (Earth).
    Center: 'coord@301' (Selenographic surface coordinate).
    """
    site_coord = f"{lon:.4f},{lat:.4f},{elev_km:.3f}"
    params = {
        "format": "json",
        "COMMAND": f"'{target_command}'",
        "CENTER": "'coord@301'",
        "COORD_TYPE": "'GEODETIC'",
        "SITE_COORD": f"'{site_coord}'",
        "START_TIME": f"'{start_time}'",
        "STOP_TIME": f"'{stop_time}'",
        "STEP_SIZE": f"'{step}'",
        "QUANTITIES": "'4'",  # Apparent Azimuth & Elevation (airless)
        "CSV_FORMAT": "'YES'"
    }
    
    url = f"{HORIZONS_API_URL}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "ALRAKIS-SELENE-NAV/2.6 (Space Apps 2026 Virtual Islamabad; mawad27727@gmail.com)"}
    )
    
    try:
        with urllib.request.urlopen(req, timeout=15) as response:
            data = json.loads(response.read().decode("utf-8"))
            return data
    except Exception as e:
        print(f"[ERROR] Horizons API request failed: {e}", file=sys.stderr)
        return {"error": str(e)}

if __name__ == "__main__":
    print("[INIT] Testing NASA JPL Horizons query for Shackleton Rim (Lat -89.54, Lon 137.0)...")
    res = fetch_horizons_vector("10", 137.00, -89.54, 1.25, "2026-11-15 00:00", "2026-11-15 03:00")
    if "result" in res:
        print("[SUCCESS] Connected to JPL Horizons API.")
        lines = res["result"].splitlines()
        for l in lines[:25]:
            print("  ", l)
    else:
        print("[STATUS] Result:", res)
