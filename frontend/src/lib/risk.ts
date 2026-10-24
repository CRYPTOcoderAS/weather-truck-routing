import type { RiskKey } from "../types";

export const RISK_ORDER: RiskKey[] = ["low", "moderate", "high", "severe", "no_travel"];

export const RISK_LABEL: Record<RiskKey, string> = {
  low: "Low",
  moderate: "Moderate",
  high: "High",
  severe: "Severe",
  no_travel: "No Travel",
};

export const RISK_COLOR: Record<RiskKey, string> = {
  low: "#2f9e5b",
  moderate: "#e2b100",
  high: "#ef7a12",
  severe: "#d62839",
  no_travel: "#5b1f8f",
};

export const UNKNOWN_COLOR = "#9aa5b1";

export const ROUTE_COLOR = ["#2563eb", "#0d9488", "#c026d3"];

export const riskColor = (risk: RiskKey | null) => (risk ? RISK_COLOR[risk] : UNKNOWN_COLOR);
