import L from "leaflet";
import { memo, useMemo } from "react";
import { Marker, Tooltip } from "react-leaflet";
import { positionAtTime } from "../../lib/path";
import { ROUTE_COLOR } from "../../lib/risk";
import type { RouteOption } from "../../types";

const truckIcon = (letter: string, color: string, selected: boolean) =>
  L.divIcon({
    className: "",
    html: `<div class="truck-marker${selected ? " selected" : ""}" style="--c:${color}">${letter}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });

const endpointIcon = (kind: "origin" | "destination") =>
  L.divIcon({
    className: "",
    html: `<div class="endpoint-marker ${kind}"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });

export function TruckMarkers({ routes, selected, hour }: { routes: RouteOption[]; selected: number; hour: number }) {
  const icons = useMemo(
    () => routes.map((r, i) => truckIcon(r.name.slice(-1), ROUTE_COLOR[i], i === selected)),
    [routes, selected],
  );
  return (
    <>
      {routes.map((route, i) => (
        <Marker
          key={route.name}
          position={positionAtTime(route.path, hour * 3600)}
          icon={icons[i]}
          zIndexOffset={i === selected ? 1000 : 0}
          interactive={false}
          keyboard={false}
        />
      ))}
    </>
  );
}

export const EndpointMarkers = memo(function EndpointMarkers({ routes, labels }: {
  routes: RouteOption[];
  labels: [string, string];
}) {
  const first = routes[0].path[0];
  const last = routes[0].path[routes[0].path.length - 1];
  return (
    <>
      <Marker position={[first[0], first[1]]} icon={endpointIcon("origin")} keyboard={false}>
        <Tooltip direction="top" offset={[0, -8]}>{labels[0]}</Tooltip>
      </Marker>
      <Marker position={[last[0], last[1]]} icon={endpointIcon("destination")} keyboard={false}>
        <Tooltip direction="top" offset={[0, -8]}>{labels[1]}</Tooltip>
      </Marker>
    </>
  );
});
