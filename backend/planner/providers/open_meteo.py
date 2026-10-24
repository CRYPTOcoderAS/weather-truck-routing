from __future__ import annotations

import math
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from django.conf import settings
from django.core.cache import cache

from ..geo import LatLon, lerp
from . import UpstreamError, get_json

HOURLY_VARS = "wind_speed_10m,wind_gusts_10m,rain,showers,snowfall,weather_code"
MM_PER_IN = 25.4
CM_PER_IN = 2.54
FORECAST_DAYS = 16
BATCH_SIZE = 50
SNAP_DEG = 0.05
CACHE_SECONDS = 30 * 60


@dataclass(frozen=True)
class WeatherSample:
    wind_mph: float
    gust_mph: float
    rain_in_hr: float
    snow_in_hr: float
    weather_code: int


@dataclass
class HourlySeries:
    start: float
    wind: list
    gust: list
    rain_in: list
    snow_in: list
    code: list

    def at(self, epoch: float) -> WeatherSample | None:
        h = (epoch - self.start) / 3600
        last = len(self.wind) - 1
        if h < 0 or h > last:
            return None
        i0 = int(math.floor(h))
        i1 = min(i0 + 1, last)
        f = h - i0
        bucket = min(int(math.ceil(h)), last)
        values = (self.wind[i0], self.wind[i1], self.gust[i0], self.gust[i1], self.rain_in[bucket],
                  self.snow_in[bucket], self.code[bucket])
        if any(v is None for v in values):
            return None
        return WeatherSample(
            wind_mph=lerp(self.wind[i0], self.wind[i1], f),
            gust_mph=lerp(self.gust[i0], self.gust[i1], f),
            rain_in_hr=self.rain_in[bucket],
            snow_in_hr=self.snow_in[bucket],
            weather_code=int(self.code[bucket]),
        )


def snap(point: LatLon) -> LatLon:
    return (round(round(point[0] / SNAP_DEG) * SNAP_DEG, 4), round(round(point[1] / SNAP_DEG) * SNAP_DEG, 4))


def forecast_window() -> tuple[datetime, datetime]:
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    return today - timedelta(days=2), today + timedelta(days=FORECAST_DAYS) - timedelta(hours=1)


def fetch(points: list[LatLon], start: datetime, end: datetime) -> dict[LatLon, HourlySeries | None]:
    lo, hi = forecast_window()
    start, end = max(start, lo), min(end, hi)
    keys = list(dict.fromkeys(snap(p) for p in points))
    if start > end:
        return {k: None for k in keys}

    start_date, end_date = start.date().isoformat(), end.date().isoformat()
    def cache_key(k: LatLon) -> str:
        return f"om:{k[0]}:{k[1]}:{start_date}:{end_date}"

    cached = cache.get_many([cache_key(k) for k in keys])
    result = {k: cached[cache_key(k)] for k in keys if cache_key(k) in cached}
    missing = [k for k in keys if k not in result]

    batches = [missing[i : i + BATCH_SIZE] for i in range(0, len(missing), BATCH_SIZE)]
    with ThreadPoolExecutor(max_workers=3) as pool:
        for batch, series in zip(batches, pool.map(lambda b: _fetch_batch(b, start_date, end_date), batches)):
            result.update(zip(batch, series))
            cache.set_many({cache_key(k): s for k, s in zip(batch, series)}, CACHE_SECONDS)
    return result


def _fetch_batch(points: list[LatLon], start_date: str, end_date: str) -> list[HourlySeries]:
    params = {
        "latitude": ",".join(f"{p[0]:g}" for p in points),
        "longitude": ",".join(f"{p[1]:g}" for p in points),
        "hourly": HOURLY_VARS,
        "wind_speed_unit": "mph",
        "timezone": "GMT",
        "timeformat": "unixtime",
        "start_date": start_date,
        "end_date": end_date,
    }
    if settings.OPEN_METEO_API_KEY:
        params["apikey"] = settings.OPEN_METEO_API_KEY
    data = get_json("Weather (Open-Meteo)", f"{settings.OPEN_METEO_URL}/v1/forecast", params)
    locations = data if isinstance(data, list) else [data]
    if len(locations) != len(points):
        raise UpstreamError("Weather (Open-Meteo)", "unexpected number of locations in response")
    return [_parse(loc["hourly"]) for loc in locations]


def _parse(hourly: dict) -> HourlySeries:
    def add(a, b):
        return None if a is None or b is None else a + b

    return HourlySeries(
        start=hourly["time"][0],
        wind=hourly["wind_speed_10m"],
        gust=hourly["wind_gusts_10m"],
        rain_in=[None if v is None else v / MM_PER_IN for v in map(add, hourly["rain"], hourly["showers"])],
        snow_in=[None if v is None else v / CM_PER_IN for v in hourly["snowfall"]],
        code=hourly["weather_code"],
    )
