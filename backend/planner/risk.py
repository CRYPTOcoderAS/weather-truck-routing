from __future__ import annotations

from dataclasses import dataclass, field
from enum import IntEnum


class Risk(IntEnum):
    LOW = 0
    MODERATE = 1
    HIGH = 2
    SEVERE = 3
    NO_TRAVEL = 4

    @property
    def key(self) -> str:
        return self.name.lower()

    @property
    def label(self) -> str:
        return self.name.replace("_", " ").title()


HEAVY_LOAD_LBS = 30_000
VERY_HEAVY_LOAD_LBS = 40_000


def classify_wind(mph: float) -> Risk:
    if mph >= 55:
        return Risk.NO_TRAVEL
    if mph >= 45:
        return Risk.SEVERE
    if mph >= 35:
        return Risk.HIGH
    if mph >= 25:
        return Risk.MODERATE
    return Risk.LOW


def classify_rain(in_per_hr: float) -> Risk:
    if in_per_hr > 1.00:
        return Risk.NO_TRAVEL
    if in_per_hr >= 0.50:
        return Risk.SEVERE
    if in_per_hr >= 0.25:
        return Risk.HIGH
    if in_per_hr >= 0.10:
        return Risk.MODERATE
    return Risk.LOW


def classify_snow(in_per_hr: float) -> Risk:
    if in_per_hr > 3.0:
        return Risk.NO_TRAVEL
    if in_per_hr >= 2.0:
        return Risk.SEVERE
    if in_per_hr >= 1.0:
        return Risk.HIGH
    if in_per_hr >= 0.5:
        return Risk.MODERATE
    return Risk.LOW


def apply_load_rules(wind_mph: float, wind_level: Risk, load_lbs: float) -> tuple[Risk, str | None]:
    if wind_mph >= 55:
        return Risk.NO_TRAVEL, "Wind ≥ 55 mph: No Travel for any load"
    if wind_mph >= 45 and load_lbs > HEAVY_LOAD_LBS:
        return Risk.NO_TRAVEL, f"{load_lbs:,.0f} lb load in 45–54 mph wind: No Travel"
    if wind_mph >= 35 and load_lbs > VERY_HEAVY_LOAD_LBS and wind_level < Risk.SEVERE:
        return Risk.SEVERE, f"{load_lbs:,.0f} lb load in 35–44 mph wind: Severe"
    return wind_level, None


_WIND_EDGES = (0.0, 25.0, 35.0, 45.0, 55.0, 75.0)
_RAIN_EDGES = (0.0, 0.10, 0.25, 0.50, 1.00, 2.00)
_SNOW_EDGES = (0.0, 0.5, 1.0, 2.0, 3.0, 5.0)


def _continuous(value: float, edges: tuple[float, ...], level: Risk) -> float:
    lo, hi = edges[level], edges[level + 1]
    frac = (value - lo) / (hi - lo)
    return level + min(max(frac, 0.0), 0.999)


@dataclass(frozen=True)
class Assessment:
    level: Risk
    index: float
    wind: Risk
    rain: Risk
    snow: Risk
    drivers: list[str] = field(default_factory=list)


def assess(wind_mph: float, rain_in_hr: float, snow_in_hr: float, load_lbs: float) -> Assessment:
    wind = classify_wind(wind_mph)
    rain = classify_rain(rain_in_hr)
    snow = classify_snow(snow_in_hr)
    wind_adjusted, load_note = apply_load_rules(wind_mph, wind, load_lbs)

    level = max(wind_adjusted, rain, snow)
    index = max(
        _continuous(wind_mph, _WIND_EDGES, wind),
        _continuous(rain_in_hr, _RAIN_EDGES, rain),
        _continuous(snow_in_hr, _SNOW_EDGES, snow),
        float(wind_adjusted),
    )

    drivers: list[str] = []
    if level > Risk.LOW:
        if load_note and wind_adjusted == level:
            drivers.append(load_note)
        elif wind == level:
            drivers.append(f"Wind {wind_mph:.0f} mph ({wind.label})")
        if rain == level:
            drivers.append(f"Rain {rain_in_hr:.2f} in/hr ({rain.label})")
        if snow == level:
            drivers.append(f"Snow {snow_in_hr:.2f} in/hr ({snow.label})")

    return Assessment(level=level, index=index, wind=wind, rain=rain, snow=snow, drivers=drivers)
