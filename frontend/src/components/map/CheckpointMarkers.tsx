import type L from "leaflet";
import { memo, useEffect, useRef } from "react";
import { CircleMarker, Popup, useMap } from "react-leaflet";
import { describeWeather, formatTime } from "../../lib/format";
import { riskColor } from "../../lib/risk";
import type { RouteOption } from "../../types";
import { RiskBadge } from "../RiskBadge";

interface Props {
  route: RouteOption;
  focused: number | null;
  onFocus: (i: number) => void;
}

export const CheckpointMarkers = memo(function CheckpointMarkers({ route, focused, onFocus }: Props) {
  const map = useMap();
  const refs = useRef<(L.CircleMarker | null)[]>([]);

  useEffect(() => {
    if (focused === null) return;
    const cp = route.checkpoints[focused];
    if (!cp) return;
    map.flyTo([cp.lat, cp.lon], Math.max(map.getZoom(), 8), { duration: 0.6 });
    map.once("moveend", () => refs.current[focused]?.openPopup());
  }, [focused, route, map]);

  return (
    <>
      {route.checkpoints.map((cp, i) => (
        <CircleMarker
          key={`${route.name}-${cp.mile}`}
          ref={(m) => {
            refs.current[i] = m;
          }}
          center={[cp.lat, cp.lon]}
          radius={i === focused ? 9 : 6}
          pathOptions={{ color: "#fff", weight: 2, fillColor: riskColor(cp.risk), fillOpacity: 1 }}
          eventHandlers={{ click: () => onFocus(i) }}
        >
          <Popup>
            <div className="cp-popup">
              <div className="cp-popup__head">
                <strong>
                  {route.name} · mile {cp.mile.toFixed(0)}
                </strong>
                <RiskBadge risk={cp.risk} />
              </div>
              <div className="muted">ETA {formatTime(cp.eta)}</div>
              {cp.weather ? (
                <table>
                  <tbody>
                    <tr><th>Conditions</th><td>{describeWeather(cp.weather.code)}</td></tr>
                    <tr><th>Wind</th><td>{cp.weather.wind_mph.toFixed(0)} mph (gusts {cp.weather.gust_mph.toFixed(0)})</td></tr>
                    <tr><th>Rain</th><td>{cp.weather.rain_in_hr.toFixed(2)} in/hr</td></tr>
                    <tr><th>Snow</th><td>{cp.weather.snow_in_hr.toFixed(2)} in/hr</td></tr>
                  </tbody>
                </table>
              ) : null}
              {cp.drivers.length > 0 && (
                <ul className="cp-popup__drivers">
                  {cp.drivers.map((d) => <li key={d}>{d}</li>)}
                </ul>
              )}
              <div className="muted small">
                Covers miles {cp.covers[0].toFixed(0)}–{cp.covers[1].toFixed(0)}
              </div>
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </>
  );
});
