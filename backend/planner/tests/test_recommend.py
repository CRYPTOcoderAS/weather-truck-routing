from planner.recommend import explain, rank


def summary(no_travel=0.0, severe=0.0, high=0.0, avg=0.0, minutes=300.0, unknown=0.0):
    return {
        "no_travel_miles": no_travel,
        "severe_miles": severe,
        "high_miles": high,
        "avg_risk": avg,
        "duration_min": minutes,
        "unknown_miles": unknown,
    }


def test_fewest_severe_miles_beats_everything_below_it():
    routes = [summary(severe=10, minutes=200), summary(severe=0, high=90, avg=2, minutes=500)]
    assert rank(routes) == [1, 0]


def test_high_miles_break_severe_ties():
    routes = [summary(severe=5, high=40), summary(severe=5, high=10, minutes=999)]
    assert rank(routes) == [1, 0]


def test_average_risk_breaks_high_ties():
    routes = [summary(high=10, avg=0.8), summary(high=10, avg=0.4, minutes=999)]
    assert rank(routes) == [1, 0]


def test_travel_time_is_the_last_resort():
    routes = [summary(minutes=320), summary(minutes=300), summary(minutes=310)]
    assert rank(routes) == [1, 2, 0]


def test_no_travel_ranks_below_any_severe_exposure():
    routes = [summary(no_travel=5), summary(severe=200)]
    assert rank(routes) == [1, 0]


def test_tiny_differences_do_not_decide():
    routes = [summary(severe=0.3, minutes=300), summary(severe=0.0, minutes=330)]
    assert rank(routes) == [0, 1]


def test_explanation_names_the_deciding_criterion():
    result = explain([summary(severe=25), summary(severe=0, minutes=400)], ["Route A", "Route B"])
    assert result["index"] == 1
    assert result["reasons"] == ["Fewer Severe miles than Route A (0 mi vs 25 mi)."]
    assert result["warnings"] == []


def test_warns_when_every_route_is_no_travel():
    result = explain([summary(no_travel=10), summary(no_travel=20)], ["Route A", "Route B"])
    assert "No Travel" in result["warnings"][0]
