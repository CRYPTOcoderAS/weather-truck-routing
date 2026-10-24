import { memo } from "react";
import { formatDuration, formatMiles, formatTime } from "../lib/format";
import { RISK_LABEL, RISK_ORDER, ROUTE_COLOR, riskColor } from "../lib/risk";
import type { PlanResponse, RouteOption } from "../types";
import { RiskBadge } from "./RiskBadge";

function RiskStrip({ route }: { route: RouteOption }) {
  const total = route.summary.distance_mi || 1;
  return (
    <svg className="risk-strip" viewBox="0 0 100 8" preserveAspectRatio="none" role="img"
      aria-label={`Risk along ${route.name}`}>
      {route.checkpoints.map((cp) => (
        <rect
          key={cp.mile}
          x={(cp.covers[0] / total) * 100}
          width={((cp.covers[1] - cp.covers[0]) / total) * 100 + 0.05}
          y={0}
          height={8}
          fill={riskColor(cp.risk)}
        />
      ))}
    </svg>
  );
}

function RouteCard({ route, color, selected, onSelect }: {
  route: RouteOption;
  color: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const s = route.summary;
  const exposure = RISK_ORDER.filter((k) => k !== "low" && s.miles_by_level[k] > 0);
  return (
    <button type="button" className={`route-card ${selected ? "selected" : ""}`} onClick={onSelect}
      aria-pressed={selected} style={{ "--route": color } as React.CSSProperties}>
      <div className="route-card__head">
        <span className="route-card__swatch" />
        <strong>{route.name}</strong>
        {route.recommended && <span className="tag-recommended">Recommended</span>}
        <span className="route-card__rank">#{route.rank}</span>
      </div>
      {s.roads.length > 0 && <div className="route-card__via">via {s.roads.join(" → ")}</div>}
      <dl className="route-card__stats">
        <div><dt>Distance</dt><dd>{formatMiles(s.distance_mi)}</dd></div>
        <div><dt>Drive time</dt><dd>{formatDuration(s.duration_min)}</dd></div>
        <div><dt>Arrive</dt><dd>{formatTime(s.arrival)}</dd></div>
        <div><dt>Avg risk</dt><dd>{s.avg_risk.toFixed(2)}</dd></div>
      </dl>
      <RiskStrip route={route} />
      <div className="route-card__exposure">
        {exposure.length === 0 ? (
          <span className="muted">All {formatMiles(s.distance_mi)} Low risk</span>
        ) : (
          exposure.map((k) => (
            <span key={k} className="exposure-chip">
              <i style={{ background: riskColor(k) }} />
              {formatMiles(s.miles_by_level[k])} {RISK_LABEL[k]}
            </span>
          ))
        )}
        {s.unknown_miles > 0 && <span className="exposure-chip muted">{formatMiles(s.unknown_miles)} no forecast</span>}
      </div>
    </button>
  );
}

interface Props {
  plan: PlanResponse;
  selected: number;
  onSelect: (i: number) => void;
}

export const RouteCards = memo(function RouteCards({ plan, selected, onSelect }: Props) {
  const best = plan.routes[plan.recommendation.index];
  return (
    <section className="results">
      <div className={`recommendation ${best.summary.no_travel_miles > 0 ? "danger" : ""}`}>
        <div className="recommendation__title">
          <span>Recommended</span>
          <strong>{best.name}</strong>
          <RiskBadge risk={best.summary.max_risk} />
        </div>
        <ul>
          {plan.recommendation.reasons.map((r) => <li key={r}>{r}</li>)}
        </ul>
        {plan.recommendation.warnings.map((w) => <p key={w} className="warning">⚠ {w}</p>)}
        {plan.demo_storm && <p className="demo-note">Showing the synthetic demo storm, not the live forecast.</p>}
      </div>

      <div className="route-cards">
        {plan.routes.map((route, i) => (
          <RouteCard key={route.name} route={route} color={ROUTE_COLOR[i]} selected={i === selected}
            onSelect={() => onSelect(i)} />
        ))}
      </div>
      {plan.routes.length < 3 && (
        <p className="muted small">Only {plan.routes.length} distinct route(s) exist between these points.</p>
      )}
    </section>
  );
});
