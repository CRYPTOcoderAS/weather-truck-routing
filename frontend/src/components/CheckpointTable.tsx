import { memo } from "react";
import { formatTime, localTimeZone } from "../lib/format";
import type { RouteOption } from "../types";
import { RiskBadge } from "./RiskBadge";

interface Props {
  route: RouteOption;
  focused: number | null;
  onFocus: (i: number) => void;
}

export const CheckpointTable = memo(function CheckpointTable({ route, focused, onFocus }: Props) {
  return (
    <section className="checkpoints">
      <h3>
        {route.name} checkpoints <span className="muted">({route.checkpoints.length}, times in {localTimeZone})</span>
      </h3>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Mile</th>
              <th>ETA</th>
              <th title="Sustained wind (gust)">Wind mph</th>
              <th title="Rain rate">Rain in/h</th>
              <th title="Snowfall rate">Snow in/h</th>
              <th>Risk</th>
            </tr>
          </thead>
          <tbody>
            {route.checkpoints.map((cp, i) => (
              <tr
                key={cp.mile}
                className={focused === i ? "focused" : ""}
                onClick={() => onFocus(i)}
                title={cp.drivers.join("\n") || undefined}
              >
                <td>{cp.mile.toFixed(0)}</td>
                <td>{formatTime(cp.eta)}</td>
                {cp.weather ? (
                  <>
                    <td>
                      {cp.weather.wind_mph.toFixed(0)} <span className="muted">({cp.weather.gust_mph.toFixed(0)})</span>
                    </td>
                    <td>{cp.weather.rain_in_hr.toFixed(2)}</td>
                    <td>{cp.weather.snow_in_hr.toFixed(2)}</td>
                  </>
                ) : (
                  <td colSpan={3} className="muted">beyond forecast</td>
                )}
                <td><RiskBadge risk={cp.risk} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
});
