import { useState } from "react";
import { nextHourLocalInput } from "../lib/format";
import type { Place, PlanRequest } from "../types";
import { PlaceInput } from "./PlaceInput";

const INTERVALS = [10, 25, 50] as const;
const LOAD_PRESETS = [20_000, 35_000, 45_000, 80_000];

const EXAMPLES: { label: string; origin: Place; destination: Place }[] = [
  {
    label: "Chicago → St. Louis",
    origin: { label: "Chicago, Illinois, US", lat: 41.8781, lon: -87.6298 },
    destination: { label: "St. Louis, Missouri, US", lat: 38.627, lon: -90.1994 },
  },
  {
    label: "Denver → Salt Lake City",
    origin: { label: "Denver, Colorado, US", lat: 39.7392, lon: -104.9903 },
    destination: { label: "Salt Lake City, Utah, US", lat: 40.7608, lon: -111.891 },
  },
  {
    label: "Dallas → Atlanta",
    origin: { label: "Dallas, Texas, US", lat: 32.7767, lon: -96.797 },
    destination: { label: "Atlanta, Georgia, US", lat: 33.749, lon: -84.388 },
  },
];

interface Props {
  loading: boolean;
  onSubmit: (req: PlanRequest) => void;
}

export function TripForm({ loading, onSubmit }: Props) {
  const [origin, setOrigin] = useState<Place | null>(null);
  const [destination, setDestination] = useState<Place | null>(null);
  const [departure, setDeparture] = useState(nextHourLocalInput);
  const [load, setLoad] = useState(42_000);
  const [interval, setIntervalMi] = useState<PlanRequest["interval_mi"]>(25);
  const [demoStorm, setDemoStorm] = useState(false);

  const ready = origin && destination && departure && load >= 0;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!origin || !destination) return;
    onSubmit({
      origin,
      destination,
      departure: new Date(departure).toISOString(),
      load_lbs: load,
      interval_mi: interval,
      demo_storm: demoStorm,
    });
  };

  return (
    <form className="trip-form" onSubmit={submit}>
      <div className="trip-form__places">
        <PlaceInput label="Origin" placeholder="City or address" value={origin} onChange={setOrigin} />
        <button
          type="button"
          className="swap"
          title="Swap origin and destination"
          aria-label="Swap origin and destination"
          onClick={() => {
            setOrigin(destination);
            setDestination(origin);
          }}
        >
          ⇅
        </button>
        <PlaceInput label="Destination" placeholder="City or address" value={destination} onChange={setDestination} />
      </div>

      <div className="examples">
        <span>Try:</span>
        {EXAMPLES.map((ex) => (
          <button
            key={ex.label}
            type="button"
            className="link"
            onClick={() => {
              setOrigin(ex.origin);
              setDestination(ex.destination);
            }}
          >
            {ex.label}
          </button>
        ))}
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="departure">Departure</label>
          <input
            id="departure"
            type="datetime-local"
            value={departure}
            onChange={(e) => setDeparture(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="load">Load weight (lb)</label>
          <input
            id="load"
            type="number"
            min={0}
            max={200000}
            step={500}
            value={Number.isNaN(load) ? "" : load}
            onChange={(e) => setLoad(e.target.valueAsNumber)}
            required
          />
        </div>
      </div>
      <div className="chips" aria-label="Load presets">
        {LOAD_PRESETS.map((lb) => (
          <button key={lb} type="button" className={`chip ${load === lb ? "on" : ""}`} onClick={() => setLoad(lb)}>
            {lb / 1000}k lb
          </button>
        ))}
      </div>

      <div className="field">
        <span className="label">Weather checkpoint every</span>
        <div className="segmented" role="radiogroup" aria-label="Checkpoint interval">
          {INTERVALS.map((mi) => (
            <button
              key={mi}
              type="button"
              role="radio"
              aria-checked={interval === mi}
              className={interval === mi ? "on" : ""}
              onClick={() => setIntervalMi(mi)}
            >
              {mi} mi
            </button>
          ))}
        </div>
      </div>

      <label className="toggle">
        <input type="checkbox" checked={demoStorm} onChange={(e) => setDemoStorm(e.target.checked)} />
        <span>
          <strong>Demo storm</strong> — replace the live forecast with a synthetic storm on the fastest route, to see
          the risk rules at work
        </span>
      </label>

      <button className="primary" type="submit" disabled={!ready || loading}>
        {loading ? "Planning routes…" : "Plan safest route"}
      </button>
    </form>
  );
}
