import { useEffect, useMemo, useState } from "react";
import { MapContainer, Pane, TileLayer, useMap } from "react-leaflet";
import type { HeatLayer, HeatmapGrid, PlanResponse } from "../types";
import { ForecastControl } from "./map/ForecastControl";
import { CheckpointMarkers } from "./map/CheckpointMarkers";
import { HeatmapLayer } from "./map/HeatmapLayer";
import { RouteLayers } from "./map/RouteLayers";
import { EndpointMarkers, TruckMarkers } from "./map/TripMarkers";

const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas";
const HOURS_PER_SECOND = 3;
const MAX_HOUR = 48;

export interface HeatmapState {
  status: "idle" | "loading" | "ready" | "error";
  grid?: HeatmapGrid;
  error?: string;
}

interface Props {
  plan: PlanResponse | null;
  labels: [string, string];
  selected: number;
  focused: number | null;
  heatmap: HeatmapState;
  onSelect: (i: number) => void;
  onFocus: (i: number) => void;
}

function FitBounds({ bounds }: { bounds: PlanResponse["bounds"] }) {
  const map = useMap();
  useEffect(() => {
    const [s, w, n, e] = bounds;
    map.fitBounds([[s, w], [n, e]], { padding: [48, 48] });
  }, [map, bounds]);
  return null;
}

export function MapPanel({ plan, labels, selected, focused, heatmap, onSelect, onFocus }: Props) {
  const [hour, setHour] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [layer, setLayer] = useState<HeatLayer>("risk");
  const [showHeat, setShowHeat] = useState(true);

  useEffect(() => {
    setHour(0);
    setPlaying(false);
  }, [plan]);

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.max(0, now - last) / 1000;
      last = now;
      setHour((h) => (h + dt * HOURS_PER_SECOND > MAX_HOUR ? 0 : h + dt * HOURS_PER_SECOND));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing]);

  const corridors = useMemo(
    () => plan?.routes.map((r) => r.path.map((p) => [p[0], p[1]] as [number, number])) ?? [],
    [plan],
  );

  return (
    <div className="map-panel">
      <MapContainer center={[39.5, -96]} zoom={4} preferCanvas className="map">
        <TileLayer
          url={`${ESRI}/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}`}
          attribution='Tiles &copy; Esri · Routing: <a href="https://project-osrm.org/">OSRM</a> / &copy; OpenStreetMap · Weather: <a href="https://open-meteo.com/">Open-Meteo</a>'
          maxZoom={16}
        />
        <Pane name="labels" style={{ zIndex: 360, pointerEvents: "none" }}>
          <TileLayer url={`${ESRI}/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}`} maxZoom={16} />
        </Pane>
        {plan && (
          <>
            <FitBounds bounds={plan.bounds} />
            {showHeat && heatmap.status === "ready" && heatmap.grid && (
              <HeatmapLayer grid={heatmap.grid} corridors={corridors} layer={layer} hour={hour} opacity={0.85} />
            )}
            <RouteLayers routes={plan.routes} selected={selected} onSelect={onSelect} />
            <CheckpointMarkers route={plan.routes[selected]} focused={focused} onFocus={onFocus} />
            <EndpointMarkers routes={plan.routes} labels={labels} />
            <TruckMarkers routes={plan.routes} selected={selected} hour={hour} />
          </>
        )}
      </MapContainer>

      {plan ? (
        heatmap.status !== "idle" && (
          <ForecastControl
            hour={hour}
            maxHour={MAX_HOUR}
            start={plan.routes[0].summary.departure}
            playing={playing}
            layer={layer}
            visible={showHeat}
            status={heatmap.status}
            error={heatmap.error}
            onHour={setHour}
            onPlay={setPlaying}
            onLayer={setLayer}
            onVisible={setShowHeat}
          />
        )
      ) : (
        <div className="map-empty">
          <strong>Plan a trip to compare routes</strong>
          <span>Three route options, weather at each checkpoint at the truck's ETA, and a 48-hour risk heatmap.</span>
        </div>
      )}
    </div>
  );
}
