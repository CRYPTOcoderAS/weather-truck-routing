from __future__ import annotations

import math

EARTH_RADIUS_MI = 3958.7613
METERS_PER_MILE = 1609.344

LatLon = tuple[float, float]


def haversine_mi(a: LatLon, b: LatLon) -> float:
    lat1, lon1, lat2, lon2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((lat2 - lat1) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
    return 2 * EARTH_RADIUS_MI * math.asin(math.sqrt(h))


def bearing_deg(a: LatLon, b: LatLon) -> float:
    lat1, lon1, lat2, lon2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    y = math.sin(lon2 - lon1) * math.cos(lat2)
    x = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(lon2 - lon1)
    return (math.degrees(math.atan2(y, x)) + 360) % 360


def destination(origin: LatLon, bearing: float, distance_mi: float) -> LatLon:
    lat1, lon1 = map(math.radians, origin)
    brg = math.radians(bearing)
    d = distance_mi / EARTH_RADIUS_MI
    lat2 = math.asin(math.sin(lat1) * math.cos(d) + math.cos(lat1) * math.sin(d) * math.cos(brg))
    lon2 = lon1 + math.atan2(
        math.sin(brg) * math.sin(d) * math.cos(lat1), math.cos(d) - math.sin(lat1) * math.sin(lat2)
    )
    return math.degrees(lat2), (math.degrees(lon2) + 540) % 360 - 180


def lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def simplify(points: list[LatLon], tolerance_deg: float) -> list[int]:
    n = len(points)
    if n < 3:
        return list(range(n))
    keep = [False] * n
    keep[0] = keep[-1] = True
    stack = [(0, n - 1)]
    tol2 = tolerance_deg**2
    while stack:
        start, end = stack.pop()
        (ay, ax), (by, bx) = points[start], points[end]
        kx = math.cos(math.radians((ay + by) / 2))
        dx, dy = (bx - ax) * kx, by - ay
        seg2 = dx * dx + dy * dy
        best, best_i = -1.0, -1
        for i in range(start + 1, end):
            py, px = points[i]
            qx, qy = (px - ax) * kx, py - ay
            if seg2 == 0:
                d2 = qx * qx + qy * qy
            else:
                t = max(0.0, min(1.0, (qx * dx + qy * dy) / seg2))
                ex, ey = qx - t * dx, qy - t * dy
                d2 = ex * ex + ey * ey
            if d2 > best:
                best, best_i = d2, i
        if best > tol2:
            keep[best_i] = True
            stack.append((start, best_i))
            stack.append((best_i, end))
    return [i for i, k in enumerate(keep) if k]


def mercator_y(lat: float) -> float:
    return math.log(math.tan(math.pi / 4 + math.radians(lat) / 2))


def inverse_mercator_y(y: float) -> float:
    return math.degrees(2 * math.atan(math.exp(y)) - math.pi / 2)
