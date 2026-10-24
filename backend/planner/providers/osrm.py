from __future__ import annotations

from collections import defaultdict

from django.conf import settings

from ..geo import METERS_PER_MILE, LatLon
from ..route import Route
from . import UpstreamError, get_json


def fetch_routes(waypoints: list[LatLon], alternatives: int = 0) -> list[Route]:
    coords = ";".join(f"{lon:.6f},{lat:.6f}" for lat, lon in waypoints)
    params = {
        "overview": "full",
        "geometries": "geojson",
        "annotations": "distance,duration",
        "steps": "true",
        "alternatives": str(alternatives) if alternatives and len(waypoints) == 2 else "false",
    }
    data = get_json("Routing (OSRM)", f"{settings.OSRM_URL}/route/v1/driving/{coords}", params)
    if data.get("code") != "Ok":
        raise UpstreamError("Routing (OSRM)", data.get("message") or data.get("code", "no route found"))
    return [_parse(r) for r in data["routes"]]


def _parse(raw: dict) -> Route:
    coords = [(lat, lon) for lon, lat in raw["geometry"]["coordinates"]]
    seg_m: list[float] = []
    seg_s: list[float] = []
    for leg in raw["legs"]:
        seg_m += leg["annotation"]["distance"]
        seg_s += leg["annotation"]["duration"]
    if len(seg_m) != len(coords) - 1:
        raise UpstreamError("Routing (OSRM)", "geometry and annotations disagree")

    max_mps = settings.TRUCK_MAX_SPEED_MPH * METERS_PER_MILE / 3600
    cum_mi, cum_s = [0.0], [0.0]
    for m, s in zip(seg_m, seg_s):
        cum_mi.append(cum_mi[-1] + m / METERS_PER_MILE)
        cum_s.append(cum_s[-1] + max(s, m / max_mps))
    return Route(coords=coords, cum_miles=cum_mi, cum_seconds=cum_s, roads=_main_roads(raw["legs"]))


def _main_roads(legs: list[dict], limit: int = 3) -> list[str]:
    steps = [s for leg in legs for s in leg.get("steps", [])]
    use_refs = any(s.get("ref") for s in steps)
    total: dict[str, float] = defaultdict(float)
    first_seen: dict[str, int] = {}
    for step in steps:
        name = ((step.get("ref") if use_refs else step.get("name")) or "").split(";")[0].strip()
        if not name:
            continue
        total[name] += step["distance"]
        first_seen.setdefault(name, len(first_seen))
    top = sorted(total, key=total.get, reverse=True)[:limit]
    return sorted(top, key=first_seen.get)
