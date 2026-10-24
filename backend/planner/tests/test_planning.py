from datetime import datetime, timedelta, timezone

import pytest
from rest_framework.test import APIClient

from planner import service
from planner.alternatives import _shared_fraction
from planner.geo import haversine_mi
from planner.providers.open_meteo import HourlySeries, WeatherSample
from planner.route import Route


def straight_route(miles: float, mph: float, start=(40.0, -90.0)) -> Route:
    deg_per_mile = 1 / 69.055
    n = int(miles)
    coords = [(start[0] + i * deg_per_mile, start[1]) for i in range(n + 1)]
    cum = [0.0]
    for a, b in zip(coords, coords[1:]):
        cum.append(cum[-1] + haversine_mi(a, b))
    return Route(coords=coords, cum_miles=cum, cum_seconds=[m / mph * 3600 for m in cum], roads=["I 1"])


class TestCheckpoints:
    def test_spacing_eta_and_coverage(self):
        route = straight_route(100, mph=50)
        cps = service._checkpoints(route, 25, departure=0)
        assert [c["mile"] for c in cps] == [0, 25, 50, 75, round(route.distance_mi, 1)]
        assert cps[1]["eta"] == pytest.approx(30 * 60, rel=1e-3)
        covered = sum(c["covers"][1] - c["covers"][0] for c in cps)
        assert covered == pytest.approx(route.distance_mi, abs=0.05)

    def test_short_route_still_has_origin_and_destination(self):
        cps = service._checkpoints(straight_route(3, mph=30), 50, departure=0)
        assert len(cps) == 2
        assert cps[0]["mile"] == 0


class TestHourlySeries:
    series = HourlySeries(
        start=0, wind=[10, 20, 30], gust=[15, 25, 35], rain_in=[0.0, 0.2, 0.4], snow_in=[0, 0, 0], code=[0, 61, 63]
    )

    def test_wind_is_interpolated(self):
        assert self.series.at(1800).wind_mph == pytest.approx(15)

    def test_precip_uses_the_hour_containing_the_eta(self):
        assert self.series.at(1800).rain_in_hr == pytest.approx(0.2)
        assert self.series.at(3600).rain_in_hr == pytest.approx(0.2)
        assert self.series.at(3601).rain_in_hr == pytest.approx(0.4)

    def test_outside_forecast_window_is_none(self):
        assert self.series.at(-1) is None
        assert self.series.at(3 * 3600) is None


def test_overlap_detects_duplicate_routes():
    a = straight_route(50, mph=60)
    shifted = straight_route(50, mph=60, start=(40.0, -89.0))
    assert _shared_fraction(a.sample(1.0), a) == 1.0
    assert _shared_fraction(shifted.sample(1.0), a) == 0.0


@pytest.fixture
def stub_providers(monkeypatch):
    fast = straight_route(120, mph=60)
    slow = straight_route(120, mph=50, start=(40.0, -89.0))
    monkeypatch.setattr(service, "find_routes", lambda o, d, count: [fast, slow])

    def fake_weather(points, start, end, storm=None):
        class Series:
            def __init__(self, lon):
                self.lon = lon

            def at(self, epoch):
                windy = abs(self.lon + 90.0) < 0.01
                return WeatherSample(50 if windy else 5, 60, 0, 0, 3)

        from planner.providers.open_meteo import snap

        return {snap(p): Series(snap(p)[1]) for p in points}

    monkeypatch.setattr(service.weather_source, "fetch", fake_weather)


@pytest.mark.usefixtures("stub_providers")
class TestPlanApi:
    def payload(self, **overrides):
        body = {
            "origin": {"lat": 40.0, "lon": -90.0, "label": "A"},
            "destination": {"lat": 41.7, "lon": -90.0, "label": "B"},
            "departure": (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat(),
            "load_lbs": 35_000,
            "interval_mi": 10,
        }
        return {**body, **overrides}

    def test_heavy_load_in_gale_avoids_the_windy_route(self):
        res = APIClient().post("/api/plan", self.payload(), format="json")
        assert res.status_code == 200
        data = res.json()
        windy, calm = data["routes"]
        assert windy["summary"]["no_travel_miles"] == pytest.approx(windy["summary"]["distance_mi"], abs=0.1)
        assert calm["recommended"] and not windy["recommended"]
        assert len(windy["checkpoints"]) == 13

    def test_light_load_same_gale_is_severe_not_no_travel(self):
        data = APIClient().post("/api/plan", self.payload(load_lbs=20_000), format="json").json()
        assert data["routes"][0]["checkpoints"][3]["risk"] == "severe"

    @pytest.mark.parametrize(
        "override",
        [
            {"interval_mi": 15},
            {"load_lbs": -1},
            {"departure": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()},
            {"destination": {"lat": 40.0, "lon": -90.0}},
        ],
    )
    def test_rejects_invalid_input(self, override):
        assert APIClient().post("/api/plan", self.payload(**override), format="json").status_code == 400
