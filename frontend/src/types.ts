export type RiskKey = "low" | "moderate" | "high" | "severe" | "no_travel";

export interface Place {
  label: string;
  lat: number;
  lon: number;
}

export interface Weather {
  wind_mph: number;
  gust_mph: number;
  rain_in_hr: number;
  snow_in_hr: number;
  code: number;
}

export interface Checkpoint {
  mile: number;
  lat: number;
  lon: number;
  eta: number;
  covers: [number, number];
  weather: Weather | null;
  risk: RiskKey | null;
  risk_level?: number;
  drivers: string[];
}

export interface RouteSummary {
  distance_mi: number;
  duration_min: number;
  departure: number;
  arrival: number;
  miles_by_level: Record<RiskKey, number>;
  no_travel_miles: number;
  severe_miles: number;
  high_miles: number;
  unknown_miles: number;
  avg_risk: number;
  max_risk: RiskKey | null;
  worst_mile: number | null;
  roads: string[];
  checkpoint_count: number;
}

export type PathPoint = [number, number, number, number];

export interface RouteOption {
  name: string;
  path: PathPoint[];
  checkpoints: Checkpoint[];
  summary: RouteSummary;
  recommended: boolean;
  rank: number;
}

export interface DemoStorm {
  lat: number;
  lon: number;
  t: number;
}

export interface PlanResponse {
  routes: RouteOption[];
  recommendation: { index: number; ranking: number[]; reasons: string[]; warnings: string[] };
  bounds: [number, number, number, number];
  demo_storm: DemoStorm | null;
}

export type HeatLayer = "risk" | "wind" | "rain" | "snow";

export interface HeatmapGrid {
  bounds: [number, number, number, number];
  rows: number;
  cols: number;
  start: number;
  hours: number;
  frames: Record<HeatLayer, (number | null)[][]>;
}

export interface PlanRequest {
  origin: Place;
  destination: Place;
  departure: string;
  load_lbs: number;
  interval_mi: 10 | 25 | 50;
  demo_storm: boolean;
}
