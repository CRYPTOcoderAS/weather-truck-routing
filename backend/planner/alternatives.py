from __future__ import annotations

import logging
from concurrent.futures import ThreadPoolExecutor

from . import geo
from .providers import UpstreamError, osrm
from .route import Route

log = logging.getLogger(__name__)

MAX_SHARED_FRACTION = 0.80
MAX_DURATION_RATIO = 1.5
MAX_REVISIT_FRACTION = 0.03
CELL_DEG = 0.02

VIA_CANDIDATES = [(0.5, 0.15), (0.5, -0.15), (0.5, 0.3), (0.5, -0.3), (0.33, 0.2), (0.67, -0.2), (0.33, -0.2), (0.67, 0.2)]


def find_routes(origin: geo.LatLon, destination: geo.LatLon, count: int = 3) -> list[Route]:
    primary = sorted(osrm.fetch_routes([origin, destination], alternatives=count), key=lambda r: r.duration_s)
    chosen: list[Route] = []
    for route in primary:
        _accept(route, chosen)

    straight = geo.haversine_mi(origin, destination)
    bearing = geo.bearing_deg(origin, destination)
    vias = [_via_point(origin, bearing, straight, along, side) for along, side in VIA_CANDIDATES]

    for i in range(0, len(vias), 4):
        if len(chosen) >= count:
            break
        with ThreadPoolExecutor(max_workers=2) as pool:
            candidates = list(pool.map(lambda v: _route_via(origin, v, destination), vias[i : i + 4]))
        for candidate in sorted(filter(None, candidates), key=lambda r: r.duration_s):
            if len(chosen) < count:
                _accept(candidate, chosen)
    return chosen


def _via_point(origin: geo.LatLon, bearing: float, straight_mi: float, along: float, side: float) -> geo.LatLon:
    on_line = geo.destination(origin, bearing, straight_mi * along)
    return geo.destination(on_line, bearing + (90 if side > 0 else -90), straight_mi * abs(side))


def _route_via(origin: geo.LatLon, via: geo.LatLon, destination: geo.LatLon) -> Route | None:
    try:
        return osrm.fetch_routes([origin, via, destination])[0]
    except UpstreamError as exc:
        log.info("via route skipped: %s", exc)
        return None


def _accept(candidate: Route, chosen: list[Route]) -> bool:
    if chosen and candidate.duration_s > MAX_DURATION_RATIO * chosen[0].duration_s:
        return False
    samples = candidate.sample(1.0)
    if _revisit_fraction(samples) > MAX_REVISIT_FRACTION:
        return False
    if any(_shared_fraction(samples, other) > MAX_SHARED_FRACTION for other in chosen):
        return False
    chosen.append(candidate)
    return True


def _cell(p: geo.LatLon) -> tuple[int, int]:
    return int(p[0] // CELL_DEG), int(p[1] // CELL_DEG)


def _shared_fraction(samples: list[geo.LatLon], other: Route) -> float:
    covered: set[tuple[int, int]] = set()
    for p in other.sample(0.5):
        cy, cx = _cell(p)
        covered.update((cy + dy, cx + dx) for dy in (-1, 0, 1) for dx in (-1, 0, 1))
    return sum(_cell(p) in covered for p in samples) / len(samples)


def _revisit_fraction(samples: list[geo.LatLon]) -> float:
    first_seen: dict[tuple[int, int], int] = {}
    revisits = 0
    for i, p in enumerate(samples):
        j = first_seen.setdefault(_cell(p), i)
        if i - j > 4:
            revisits += 1
    return revisits / len(samples)
