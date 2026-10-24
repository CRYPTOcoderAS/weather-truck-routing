import { useCallback, useEffect, useState } from "react";
import { CheckpointTable } from "./components/CheckpointTable";
import { MapPanel, type HeatmapState } from "./components/MapPanel";
import { RouteCards } from "./components/RouteCards";
import { TripForm } from "./components/TripForm";
import { fetchHeatmap, planTrip } from "./lib/api";
import { RISK_COLOR, RISK_LABEL, RISK_ORDER } from "./lib/risk";
import type { PlanRequest, PlanResponse } from "./types";

export default function App() {
  const [request, setRequest] = useState<PlanRequest | null>(null);
  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState(0);
  const [focused, setFocused] = useState<number | null>(null);
  const [heatmap, setHeatmap] = useState<HeatmapState>({ status: "idle" });

  const submit = useCallback(async (req: PlanRequest) => {
    setLoading(true);
    setError(null);
    try {
      const result = await planTrip(req);
      setRequest(req);
      setPlan(result);
      setSelected(result.recommendation.index);
      setFocused(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!plan || !request) return;
    const ctrl = new AbortController();
    setHeatmap({ status: "loading" });
    fetchHeatmap(plan.bounds, request.departure, request.load_lbs, plan.demo_storm, ctrl.signal)
      .then((grid) => setHeatmap({ status: "ready", grid }))
      .catch((e: Error) => {
        if (e.name !== "AbortError") setHeatmap({ status: "error", error: e.message });
      });
    return () => ctrl.abort();
  }, [plan, request]);

  const selectRoute = useCallback((i: number) => {
    setSelected(i);
    setFocused(null);
  }, []);

  return (
    <div className="app">
      <aside className="sidebar">
        <header className="brand">
          <div className="brand__logo" aria-hidden>
            <svg viewBox="0 0 32 32"><path d="M6 22c4-1 6-8 10-8s5 6 10 4" fill="none" stroke="#f5b301" strokeWidth="3" strokeLinecap="round" /><circle cx="6" cy="22" r="2.6" fill="#fff" /><circle cx="26" cy="18" r="2.6" fill="#fff" /></svg>
          </div>
          <div>
            <h1>StormLane</h1>
            <p>Weather-aware truck routing</p>
          </div>
        </header>

        <TripForm loading={loading} onSubmit={submit} />
        {error && <div className="error-box" role="alert">{error}</div>}

        {plan && (
          <>
            <RouteCards plan={plan} selected={selected} onSelect={selectRoute} />
            <CheckpointTable route={plan.routes[selected]} focused={focused} onFocus={setFocused} />
          </>
        )}

        <footer className="rules">
          <details>
            <summary>Risk rules</summary>
            <ul className="risk-key">
              {RISK_ORDER.map((k) => (
                <li key={k}><i style={{ background: RISK_COLOR[k] }} />{RISK_LABEL[k]}</li>
              ))}
            </ul>
            <table>
              <thead><tr><th /><th>Mod</th><th>High</th><th>Severe</th><th>No travel</th></tr></thead>
              <tbody>
                <tr><th>Wind mph</th><td>25–34</td><td>35–44</td><td>45–54</td><td>≥55</td></tr>
                <tr><th>Rain in/h</th><td>.10–.25</td><td>.25–.50</td><td>.50–1.0</td><td>&gt;1.0</td></tr>
                <tr><th>Snow in/h</th><td>0.5–1</td><td>1–2</td><td>2–3</td><td>&gt;3</td></tr>
              </tbody>
            </table>
            <p>Load: 45–54 mph with &gt;30,000 lb → No Travel; 35–44 mph with &gt;40,000 lb → Severe.</p>
            <p>
              Ranking: fewest No Travel, then Severe, then High miles, then lowest average risk, then shortest
              time.
            </p>
          </details>
        </footer>
      </aside>

      <main className="main">
        <MapPanel
          plan={plan}
          labels={[request?.origin.label ?? "Origin", request?.destination.label ?? "Destination"]}
          selected={selected}
          focused={focused}
          heatmap={heatmap}
          onSelect={selectRoute}
          onFocus={setFocused}
        />
      </main>
    </div>
  );
}
