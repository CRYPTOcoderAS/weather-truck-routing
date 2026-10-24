import math

import pytest

from planner.risk import Risk, apply_load_rules, assess, classify_rain, classify_snow, classify_wind

L, M, H, S, NT = Risk.LOW, Risk.MODERATE, Risk.HIGH, Risk.SEVERE, Risk.NO_TRAVEL


@pytest.mark.parametrize(
    "mph, expected",
    [(0, L), (24.9, L), (25, M), (34.9, M), (35, H), (44.9, H), (45, S), (54.9, S), (55, NT), (80, NT)],
)
def test_wind_bands(mph, expected):
    assert classify_wind(mph) == expected


@pytest.mark.parametrize(
    "inches, expected",
    [(0, L), (0.099, L), (0.10, M), (0.249, M), (0.25, H), (0.499, H), (0.50, S), (1.00, S), (1.001, NT)],
)
def test_rain_bands(inches, expected):
    assert classify_rain(inches) == expected


@pytest.mark.parametrize(
    "inches, expected",
    [(0, L), (0.49, L), (0.5, M), (0.99, M), (1.0, H), (1.99, H), (2.0, S), (3.0, S), (3.01, NT)],
)
def test_snow_bands(inches, expected):
    assert classify_snow(inches) == expected


class TestLoadRules:
    def test_55_mph_is_no_travel_for_any_load(self):
        assert apply_load_rules(55, S, 0)[0] == NT
        assert apply_load_rules(60, NT, 80_000)[0] == NT

    @pytest.mark.parametrize("load, expected", [(30_000, S), (30_001, NT), (45_000, NT)])
    def test_45_to_54_mph_over_30k_lb_is_no_travel(self, load, expected):
        assert apply_load_rules(50, classify_wind(50), load)[0] == expected

    @pytest.mark.parametrize("load, expected", [(40_000, H), (40_001, S), (80_000, S)])
    def test_35_to_44_mph_over_40k_lb_is_severe(self, load, expected):
        assert apply_load_rules(40, classify_wind(40), load)[0] == expected

    def test_light_wind_is_never_escalated(self):
        assert apply_load_rules(34.9, M, 80_000) == (M, None)


class TestAssess:
    def test_worst_condition_wins(self):
        a = assess(wind_mph=10, rain_in_hr=0.3, snow_in_hr=0.6, load_lbs=10_000)
        assert (a.level, a.wind, a.rain, a.snow) == (H, L, H, M)
        assert a.drivers == ["Rain 0.30 in/hr (High)"]

    def test_load_escalation_is_explained(self):
        a = assess(wind_mph=40, rain_in_hr=0, snow_in_hr=0, load_lbs=42_000)
        assert a.level == S
        assert "42,000 lb" in a.drivers[0]

    def test_calm_weather_has_no_drivers(self):
        assert assess(5, 0, 0, 80_000).drivers == []

    @pytest.mark.parametrize(
        "wind, rain, snow, load",
        [(0, 0, 0, 0), (30, 0, 0, 0), (40, 0.2, 0, 45_000), (50, 0, 2.5, 35_000), (20, 1.5, 0, 0), (70, 0, 0, 0)],
    )
    def test_heatmap_index_agrees_with_level(self, wind, rain, snow, load):
        a = assess(wind, rain, snow, load)
        assert math.floor(a.index) == a.level
