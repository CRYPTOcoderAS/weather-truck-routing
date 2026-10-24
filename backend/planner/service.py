from __future__ import annotations

from datetime import datetime, timedelta, timezone

from . import geo, recommend, weather as weather_source
from .alternatives import find_routes
from .providers import open_meteo
from .risk import Risk, assess
from .route import Route

ROUTE_NAMES = ("Route A", "Route B", "Route C")
DISPLAY_TOLERANCE_DEG = 0.0004


def plan_trip(
    origin: geo.LatLon,
    destination: geo.LatLon,
    departure: datetime,
    load_lbs: float,
    interval_mi: int,
    demo_storm: bool = False,
) -> dict:
    routes = find_routes(origin, destination, count=3)
    dep = departure.timestamp()

    storm = None
    if demo_storm:
        (lat, lon), elapsed = routes[0].at_mile(routes[0].distance_mi / 2)
        storm = weather_source.DemoStorm(lat=round(lat, 4), lon=round(lon, 4), t=round(dep + elapsed))

    checkpoints = [_checkpoints(r, interval_mi, dep) for r in routes]
    last_eta = max(cp[-1]["eta"] for cp in checkpoints)
    weather = weather_source.fetch(
        [(c["lat"], c["lon"]) for cps in checkpoints for c in cps],
        departure - timedelta(hours=1),
        datetime.fromtimestamp(last_eta, timezone.utc) + timedelta(hours=1),
        storm,
    )

    results = []
    for name, route, cps in zip(ROUTE_NAMES, routes, checkpoints):
        for c in cps:
            series = weather.get(open_meteo.snap((c["lat"], c["lon"])))
            c.update(_score(series.at(c["eta"]) if series else None, load_lbs))
        results.append({"name": name, **_serialize(route, cps), "summary": _summarize(route, cps)})

    recommendation = recommend.explain([r["summary"] for r in results], [r["name"] for r in results])
    for i, r in enumerate(results):
        r["recommended"] = i == recommendation["index"]
        r["rank"] = recommendation["ranking"].index(i) + 1

    lats = [p[0] for r in routes for p in r.coords]
    lons = [p[1] for r in routes for p in r.coords]
    return {
        "routes": results,
        "recommendation": recommendation,
        "bounds": [min(lats), min(lons), max(lats), max(lons)],
        "demo_storm": vars(storm) if storm else None,
    }


def _checkpoints(route: Route, interval_mi: int, departure: float) -> list[dict]:
    miles = [float(m) for m in range(0, max(1, int(route.distance_mi)), interval_mi)]
    if route.distance_mi - miles[-1] > 0.05:
        miles.append(route.distance_mi)
    out = []
    for i, m in enumerate(miles):
        (lat, lon), elapsed = route.at_mile(m)
        start = (miles[i - 1] + m) / 2 if i > 0 else 0.0
        end = (m + miles[i + 1]) / 2 if i < len(miles) - 1 else route.distance_mi
        out.append(
            {
                "mile": round(m, 1),
                "lat": round(lat, 5),
                "lon": round(lon, 5),
                "eta": departure + elapsed,
                "covers": [round(start, 2), round(end, 2)],
            }
        )
    return out


def _score(sample: open_meteo.WeatherSample | None, load_lbs: float) -> dict:
    if sample is None:
        return {"weather": None, "risk": None, "drivers": ["No forecast available for this ETA"]}
    a = assess(sample.wind_mph, sample.rain_in_hr, sample.snow_in_hr, load_lbs)
    return {
        "weather": {
            "wind_mph": round(sample.wind_mph, 1),
            "gust_mph": round(sample.gust_mph, 1),
            "rain_in_hr": round(sample.rain_in_hr, 3),
            "snow_in_hr": round(sample.snow_in_hr, 3),
            "code": sample.weather_code,
        },
        "risk": a.level.key,
        "risk_level": int(a.level),
        "drivers": a.drivers,
    }


def _summarize(route: Route, cps: list[dict]) -> dict:
    miles_by_level = {r.key: 0.0 for r in Risk}
    unknown = 0.0
    weighted = 0.0
    worst = None
    for c in cps:
        covered = c["covers"][1] - c["covers"][0]
        if c["risk"] is None:
            unknown += covered
            continue
        miles_by_level[c["risk"]] += covered
        weighted += c["risk_level"] * covered
        if worst is None or c["risk_level"] > worst["risk_level"]:
            worst = c
    scored = route.distance_mi - unknown
    return {
        "distance_mi": round(route.distance_mi, 1),
        "duration_min": round(route.duration_s / 60, 1),
        "departure": cps[0]["eta"],
        "arrival": cps[-1]["eta"],
        "miles_by_level": {k: round(v, 1) for k, v in miles_by_level.items()},
        "no_travel_miles": round(miles_by_level["no_travel"], 1),
        "severe_miles": round(miles_by_level["severe"], 1),
        "high_miles": round(miles_by_level["high"], 1),
        "unknown_miles": round(unknown, 1),
        "avg_risk": round(weighted / scored, 3) if scored > 0 else 0.0,
        "max_risk": worst["risk"] if worst else None,
        "worst_mile": worst["mile"] if worst else None,
        "roads": route.roads,
        "checkpoint_count": len(cps),
    }


def _serialize(route: Route, cps: list[dict]) -> dict:
    keep = geo.simplify(route.coords, DISPLAY_TOLERANCE_DEG)
    path = [
        [round(route.coords[i][0], 5), round(route.coords[i][1], 5), round(route.cum_seconds[i]), round(route.cum_miles[i], 2)]
        for i in keep
    ]
    return {"path": path, "checkpoints": cps}
