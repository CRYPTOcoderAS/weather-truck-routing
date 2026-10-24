import type { DemoStorm, HeatmapGrid, Place, PlanRequest, PlanResponse } from "../types";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(errorMessage(body) ?? `Request failed (${res.status})`);
  return body as T;
}

function errorMessage(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const parts: string[] = [];
  const walk = (value: unknown) => {
    if (typeof value === "string") parts.push(value);
    else if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === "object") Object.values(value).forEach(walk);
  };
  walk(body);
  return parts.length ? parts.join(" ") : null;
}

export function geocode(q: string, signal: AbortSignal) {
  return request<Place[]>(`/api/geocode?q=${encodeURIComponent(q)}`, { signal });
}

export function planTrip(body: PlanRequest) {
  return request<PlanResponse>("/api/plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function fetchHeatmap(
  bounds: PlanResponse["bounds"],
  start: string,
  loadLbs: number,
  storm: DemoStorm | null,
  signal: AbortSignal,
) {
  const [south, west, north, east] = bounds;
  const params = new URLSearchParams({
    south: String(south),
    west: String(west),
    north: String(north),
    east: String(east),
    start,
    load_lbs: String(loadLbs),
  });
  if (storm) {
    params.set("storm_lat", String(storm.lat));
    params.set("storm_lon", String(storm.lon));
    params.set("storm_t", String(storm.t));
  }
  return request<HeatmapGrid>(`/api/heatmap?${params}`, { signal });
}
