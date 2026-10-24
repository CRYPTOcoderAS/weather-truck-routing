import { RISK_LABEL, riskColor } from "../lib/risk";
import type { RiskKey } from "../types";

export function RiskBadge({ risk }: { risk: RiskKey | null }) {
  return (
    <span className={`risk-badge risk-${risk ?? "unknown"}`} style={{ background: riskColor(risk) }}>
      {risk ? RISK_LABEL[risk] : "No data"}
    </span>
  );
}
