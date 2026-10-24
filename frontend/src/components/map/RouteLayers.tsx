import { memo, useMemo } from "react";
import { Polyline, Tooltip } from "react-leaflet";
import { formatDuration, formatMiles } from "../../lib/format";
import { riskSegments } from "../../lib/path";
import { ROUTE_COLOR, riskColor } from "../../lib/risk";
import type { RouteOption } from "../../types";

interface Props {
  routes: RouteOption[];
  selected: number;
  onSelect: (i: number) => void;
}

export const RouteLayers = memo(function RouteLayers({ routes, selected, onSelect }: Props) {
  const lines = useMemo(() => routes.map((r) => r.path.map((p) => [p[0], p[1]] as [number, number])), [routes]);
  const segments = useMemo(
    () => riskSegments(routes[selected].path, routes[selected].checkpoints),
    [routes, selected],
  );

  return (
    <>
      {routes.map((route, i) =>
        i === selected ? null : (
          <Polyline
            key={`${route.name}-${i}`}
            positions={lines[i]}
            pathOptions={{ color: ROUTE_COLOR[i], weight: 5, opacity: 0.55 }}
            eventHandlers={{ click: () => onSelect(i) }}
          >
            <Tooltip sticky>
              {route.name}: {formatMiles(route.summary.distance_mi)}, {formatDuration(route.summary.duration_min)}
              <br />
              Click to inspect
            </Tooltip>
          </Polyline>
        ),
      )}
      <Polyline
        key={`casing-${selected}`}
        positions={lines[selected]}
        pathOptions={{ color: ROUTE_COLOR[selected], weight: 11, opacity: 0.95 }}
        interactive={false}
      />
      {segments.map((seg, i) => (
        <Polyline
          key={`seg-${selected}-${i}`}
          positions={seg.positions}
          pathOptions={{ color: riskColor(seg.risk), weight: 5, opacity: 1 }}
          interactive={false}
        />
      ))}
    </>
  );
});
