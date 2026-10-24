from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Criterion:
    field: str
    label: str
    precision: int
    unit: str


CRITERIA = (
    Criterion("no_travel_miles", "No Travel miles", 0, "mi"),
    Criterion("severe_miles", "Severe miles", 0, "mi"),
    Criterion("high_miles", "High miles", 0, "mi"),
    Criterion("avg_risk", "average risk", 2, ""),
    Criterion("duration_min", "travel time", 0, "min"),
)


def sort_key(summary: dict) -> tuple:
    return tuple(round(summary[c.field], c.precision) for c in CRITERIA)


def rank(summaries: list[dict]) -> list[int]:
    return sorted(range(len(summaries)), key=lambda i: sort_key(summaries[i]))


def deciding_criterion(best: dict, other: dict) -> Criterion | None:
    for c in CRITERIA:
        if round(best[c.field], c.precision) != round(other[c.field], c.precision):
            return c
    return None


def explain(summaries: list[dict], names: list[str]) -> dict:
    order = rank(summaries)
    best_i = order[0]
    best = summaries[best_i]

    reasons = []
    for i in order[1:]:
        c = deciding_criterion(best, summaries[i])
        if c is None:
            reasons.append(f"Ties with {names[i]} on every criterion.")
        elif c.field == "duration_min":
            reasons.append(
                f"Same weather exposure as {names[i]} but faster "
                f"({_fmt_min(best[c.field])} vs {_fmt_min(summaries[i][c.field])})."
            )
        elif c.field == "avg_risk":
            reasons.append(
                f"Lower average risk than {names[i]} ({best['avg_risk']:.2f} vs {summaries[i]['avg_risk']:.2f})."
            )
        else:
            reasons.append(
                f"Fewer {c.label} than {names[i]} ({_fmt(best[c.field], c)} vs {_fmt(summaries[i][c.field], c)})."
            )

    warnings = []
    if best["no_travel_miles"] > 0:
        warnings.append(
            "Every route crosses No Travel conditions at this departure time. Delay the trip or reduce the load."
        )
    elif best["severe_miles"] > 0:
        warnings.append(f"The safest route still has {best['severe_miles']:.0f} Severe miles.")
    if best["unknown_miles"] > 0:
        warnings.append(f"{best['unknown_miles']:.0f} miles are beyond the forecast horizon and were not scored.")

    return {"index": best_i, "ranking": order, "reasons": reasons, "warnings": warnings}


def _fmt(value: float, c: Criterion) -> str:
    return f"{value:.{c.precision}f} {c.unit}".strip()


def _fmt_min(minutes: float) -> str:
    h, m = divmod(round(minutes), 60)
    return f"{h}h {m:02d}m"
