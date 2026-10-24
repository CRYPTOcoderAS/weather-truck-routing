from __future__ import annotations

import math
from datetime import datetime

from .. import geo
from .open_meteo import HourlySeries, snap

SPEED_MPH = 30.0
HEADING_DEG = 70.0
PEAK_WIND_MPH = 60.0
WIND_SIGMA_MI = 55.0
PEAK_RAIN_IN = 0.9
PEAK_SNOW_IN = 2.6
PRECIP_SIGMA_MI = 40.0
BASE_WIND_MPH = 8.0


def storm_centre(anchor: geo.LatLon, anchor_t: float, epoch: float) -> geo.LatLon:
    miles = SPEED_MPH * (epoch - anchor_t) / 3600
    return geo.destination(anchor, HEADING_DEG if miles >= 0 else HEADING_DEG + 180, abs(miles))


def fetch(points: list[geo.LatLon], start: datetime, end: datetime, anchor: geo.LatLon, anchor_t: float):
    t0 = math.floor(start.timestamp() / 3600) * 3600
    hours = int(math.ceil((end.timestamp() - t0) / 3600)) + 1
    centres = [storm_centre(anchor, anchor_t, t0 + h * 3600) for h in range(hours)]
    return {key: _series(key, t0, centres) for key in dict.fromkeys(snap(p) for p in points)}


def _series(point: geo.LatLon, t0: float, centres: list[geo.LatLon]) -> HourlySeries:
    wind, gust, rain, snow, code = [], [], [], [], []
    for c in centres:
        d = geo.haversine_mi(point, c)
        w = BASE_WIND_MPH + (PEAK_WIND_MPH - BASE_WIND_MPH) * math.exp(-(d**2) / (2 * WIND_SIGMA_MI**2))
        precip = math.exp(-(d**2) / (2 * PRECIP_SIGMA_MI**2))
        snow_share = 1 / (1 + math.exp(-(point[0] - c[0]) / 0.25))
        r, s = PEAK_RAIN_IN * precip * (1 - snow_share), PEAK_SNOW_IN * precip * snow_share
        wind.append(w)
        gust.append(w * 1.4)
        rain.append(r)
        snow.append(s)
        code.append(75 if s >= 1 else 71 if s >= 0.1 else 65 if r >= 0.3 else 61 if r >= 0.02 else 3)
    return HourlySeries(start=t0, wind=wind, gust=gust, rain_in=rain, snow_in=snow, code=code)
