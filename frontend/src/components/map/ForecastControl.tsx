import { SCALES, legendGradient, tickPosition } from "../../lib/colorScale";
import { formatTime } from "../../lib/format";
import type { HeatLayer } from "../../types";

const LAYERS: { key: HeatLayer; label: string }[] = [
  { key: "risk", label: "Risk" },
  { key: "wind", label: "Wind" },
  { key: "rain", label: "Rain" },
  { key: "snow", label: "Snow" },
];

interface Props {
  hour: number;
  maxHour: number;
  start: number;
  playing: boolean;
  layer: HeatLayer;
  visible: boolean;
  status: "loading" | "ready" | "error";
  error?: string;
  onHour: (h: number) => void;
  onPlay: (p: boolean) => void;
  onLayer: (l: HeatLayer) => void;
  onVisible: (v: boolean) => void;
}

export function ForecastControl(props: Props) {
  const { hour, maxHour, start, playing, layer, visible, status } = props;
  const scale = SCALES[layer];
  return (
    <div className="forecast">
      <div className="forecast__row">
        <button
          type="button"
          className="play"
          onClick={() => props.onPlay(!playing)}
          aria-label={playing ? "Pause" : "Play forecast"}
          disabled={status !== "ready"}
        >
          {playing ? "❚❚" : "▶"}
        </button>
        <input
          className="forecast__slider"
          type="range"
          min={0}
          max={maxHour}
          step={0.25}
          value={hour}
          onChange={(e) => {
            props.onPlay(false);
            props.onHour(e.target.valueAsNumber);
          }}
          aria-label="Hours after departure"
          disabled={status !== "ready"}
        />
        <div className="forecast__time">
          <strong>+{Math.floor(hour)}h</strong>
          <span>{formatTime(start + Math.floor(hour * 4) * 900)}</span>
        </div>
      </div>
      <div className="forecast__row forecast__row--meta">
        <div className="segmented small" role="radiogroup" aria-label="Heatmap layer">
          {LAYERS.map((l) => (
            <button
              key={l.key}
              type="button"
              role="radio"
              aria-checked={layer === l.key}
              className={layer === l.key ? "on" : ""}
              onClick={() => props.onLayer(l.key)}
            >
              {l.label}
            </button>
          ))}
        </div>
        <label className="toggle compact">
          <input type="checkbox" checked={visible} onChange={(e) => props.onVisible(e.target.checked)} />
          <span>Heatmap</span>
        </label>
        <div className="legend" aria-label={`${scale.label} legend`}>
          <div className="legend__bar" style={{ background: legendGradient(scale) }} />
          <div className="legend__ticks">
            {scale.ticks.map((t) => (
              <span key={t.label} style={{ left: `${tickPosition(scale, t.at)}%` }}>
                {t.label}
              </span>
            ))}
          </div>
          <div className="legend__label">
            {scale.label}
            {scale.unit && ` (${scale.unit})`}
          </div>
        </div>
      </div>
      {status === "loading" && <div className="forecast__status">Loading 48-hour corridor forecast…</div>}
      {status === "error" && <div className="forecast__status error">Heatmap unavailable: {props.error}</div>}
    </div>
  );
}
