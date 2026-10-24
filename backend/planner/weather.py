from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from .geo import LatLon
from .providers import open_meteo, synthetic


@dataclass(frozen=True)
class DemoStorm:
    lat: float
    lon: float
    t: float


def fetch(points: list[LatLon], start: datetime, end: datetime, storm: DemoStorm | None = None):
    if storm:
        return synthetic.fetch(points, start, end, (storm.lat, storm.lon), storm.t)
    return open_meteo.fetch(points, start, end)
