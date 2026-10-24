import type { Checkpoint, PathPoint, RiskKey } from "../types";

export interface RiskSegment {
  risk: RiskKey | null;
  positions: [number, number][];
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function lowerIndex(path: PathPoint[], field: 2 | 3, value: number): number {
  let lo = 0;
  let hi = path.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (path[mid][field] <= value) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

function pointAt(path: PathPoint[], field: 2 | 3, value: number): [number, number] {
  const i = lowerIndex(path, field, value);
  const a = path[i];
  const b = path[Math.min(i + 1, path.length - 1)];
  const span = b[field] - a[field];
  const t = span > 0 ? Math.min(Math.max((value - a[field]) / span, 0), 1) : 0;
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
}

export function positionAtTime(path: PathPoint[], elapsed: number): [number, number] {
  return pointAt(path, 2, Math.min(Math.max(elapsed, 0), path[path.length - 1][2]));
}

export function riskSegments(path: PathPoint[], checkpoints: Checkpoint[]): RiskSegment[] {
  const segments: RiskSegment[] = [];
  for (const cp of checkpoints) {
    const [from, to] = cp.covers;
    if (to <= from) continue;
    const positions: [number, number][] = [pointAt(path, 3, from)];
    for (let i = lowerIndex(path, 3, from) + 1; i < path.length && path[i][3] < to; i++) {
      positions.push([path[i][0], path[i][1]]);
    }
    positions.push(pointAt(path, 3, to));
    const prev = segments[segments.length - 1];
    if (prev && prev.risk === cp.risk) prev.positions.push(...positions.slice(1));
    else segments.push({ risk: cp.risk, positions });
  }
  return segments;
}
