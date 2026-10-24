from __future__ import annotations

import math
from datetime import datetime, timedelta

from . import geo
from . import weather as weather_source
from .providers import open_meteo
from .risk import assess

HOURS = 48
MAX_CELLS = 180
PAD_FRACTION = 0.1
PAD_MIN_MILES = 65


def corridor_grid(
    south: float,
    west: float,
    north: float,
    east: float,
    start: datetime,
    load_lbs: float,
    storm: weather_source.DemoStorm | None = None,
) -> dict:
    min_pad_deg = PAD_MIN_MILES / 69.0
    pad_lat = max((north - south) * PAD_FRACTION, min_pad_deg)
    pad_lon = max((east - west) * PAD_FRACTION, min_pad_deg / math.cos(math.radians((north + south) / 2)))
    south, north = max(south - pad_lat, -80.0), min(north + pad_lat, 80.0)
    west, east = west - pad_lon, east + pad_lon

    y_south, y_north = geo.mercator_y(south), geo.mercator_y(north)
    aspect = math.radians(east - west) / (y_north - y_south)
    cols = min(max(round(math.sqrt(MAX_CELLS * aspect)), 4), 30)
    rows = min(max(MAX_CELLS // cols, 4), 30)

    lats = [geo.inverse_mercator_y(y_north - (r + 0.5) * (y_north - y_south) / rows) for r in range(rows)]
    lons = [west + (c + 0.5) * (east - west) / cols for c in range(cols)]
    cells = [(lat, lon) for lat in lats for lon in lons]

    weather = weather_source.fetch(cells, start - timedelta(hours=1), start + timedelta(hours=HOURS + 1), storm)
    series = [weather.get(open_meteo.snap(c)) for c in cells]

    frames: dict[str, list] = {"risk": [], "wind": [], "rain": [], "snow": []}
    t0 = start.timestamp()
    for h in range(HOURS + 1):
        samples = [s.at(t0 + h * 3600) if s else None for s in series]

        def column(fn):
            return [None if x is None else fn(x) for x in samples]

        frames["risk"].append(column(lambda x: round(assess(x.wind_mph, x.rain_in_hr, x.snow_in_hr, load_lbs).index, 2)))
        frames["wind"].append(column(lambda x: round(x.wind_mph)))
        frames["rain"].append(column(lambda x: round(x.rain_in_hr, 2)))
        frames["snow"].append(column(lambda x: round(x.snow_in_hr, 2)))

    return {
        "bounds": [south, west, north, east],
        "rows": rows,
        "cols": cols,
        "start": t0,
        "hours": HOURS,
        "frames": frames,
    }
