from __future__ import annotations

from bisect import bisect_right
from dataclasses import dataclass

from .geo import LatLon, lerp


@dataclass
class Route:
    coords: list[LatLon]
    cum_miles: list[float]
    cum_seconds: list[float]
    roads: list[str]

    @property
    def distance_mi(self) -> float:
        return self.cum_miles[-1]

    @property
    def duration_s(self) -> float:
        return self.cum_seconds[-1]

    def at_mile(self, mile: float) -> tuple[LatLon, float]:
        mile = min(max(mile, 0.0), self.distance_mi)
        i = bisect_right(self.cum_miles, mile) - 1
        if i >= len(self.coords) - 1:
            return self.coords[-1], self.cum_seconds[-1]
        span = self.cum_miles[i + 1] - self.cum_miles[i]
        t = 0.0 if span == 0 else (mile - self.cum_miles[i]) / span
        a, b = self.coords[i], self.coords[i + 1]
        point = (lerp(a[0], b[0], t), lerp(a[1], b[1], t))
        return point, lerp(self.cum_seconds[i], self.cum_seconds[i + 1], t)

    def sample(self, step_mi: float) -> list[LatLon]:
        n = max(1, int(self.distance_mi // step_mi))
        return [self.at_mile(k * step_mi)[0] for k in range(n + 1)] + [self.coords[-1]]
