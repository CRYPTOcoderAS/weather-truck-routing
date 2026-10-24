import type { HeatLayer } from "../types";

type RGBA = [number, number, number, number];
interface Stop {
  at: number;
  color: RGBA;
}

export interface Scale {
  label: string;
  unit: string;
  stops: Stop[];
  ticks: { at: number; label: string }[];
}

const hex = (h: string, a: number): RGBA => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
  a,
];

export const SCALES: Record<HeatLayer, Scale> = {
  risk: {
    label: "Weather risk (for this load)",
    unit: "",
    stops: [
      { at: 0, color: hex("#2f9e5b", 40) },
      { at: 0.5, color: hex("#2f9e5b", 70) },
      { at: 1.5, color: hex("#e2b100", 150) },
      { at: 2.5, color: hex("#ef7a12", 180) },
      { at: 3.5, color: hex("#d62839", 200) },
      { at: 4.5, color: hex("#5b1f8f", 215) },
    ],
    ticks: [
      { at: 0.5, label: "Low" },
      { at: 1.5, label: "Mod" },
      { at: 2.5, label: "High" },
      { at: 3.5, label: "Severe" },
      { at: 4.5, label: "No travel" },
    ],
  },
  wind: {
    label: "Wind speed",
    unit: "mph",
    stops: [
      { at: 0, color: hex("#bfe3f5", 0) },
      { at: 10, color: hex("#8fd0ee", 60) },
      { at: 25, color: hex("#3b8fd9", 140) },
      { at: 35, color: hex("#6a4bd6", 175) },
      { at: 45, color: hex("#b0329e", 200) },
      { at: 55, color: hex("#6b0f3a", 220) },
    ],
    ticks: [
      { at: 0, label: "0" },
      { at: 25, label: "25" },
      { at: 35, label: "35" },
      { at: 45, label: "45" },
      { at: 55, label: "55+" },
    ],
  },
  rain: {
    label: "Rain",
    unit: "in/hr",
    stops: [
      { at: 0, color: hex("#9be7a5", 0) },
      { at: 0.02, color: hex("#9be7a5", 70) },
      { at: 0.1, color: hex("#35b65a", 140) },
      { at: 0.25, color: hex("#f0c419", 175) },
      { at: 0.5, color: hex("#e8590c", 200) },
      { at: 1.0, color: hex("#a61e4d", 220) },
    ],
    ticks: [
      { at: 0, label: "0" },
      { at: 0.1, label: ".10" },
      { at: 0.25, label: ".25" },
      { at: 0.5, label: ".50" },
      { at: 1.0, label: "1.0+" },
    ],
  },
  snow: {
    label: "Snowfall",
    unit: "in/hr",
    stops: [
      { at: 0, color: hex("#d6e6ff", 0) },
      { at: 0.1, color: hex("#c5dcff", 70) },
      { at: 0.5, color: hex("#74a7f2", 140) },
      { at: 1.0, color: hex("#3f63d1", 175) },
      { at: 2.0, color: hex("#6a3fc1", 200) },
      { at: 3.0, color: hex("#3b136b", 220) },
    ],
    ticks: [
      { at: 0, label: "0" },
      { at: 0.5, label: "0.5" },
      { at: 1, label: "1" },
      { at: 2, label: "2" },
      { at: 3, label: "3+" },
    ],
  },
};

export function colorAt(scale: Scale, value: number): RGBA {
  const { stops } = scale;
  if (value <= stops[0].at) return stops[0].color;
  for (let i = 1; i < stops.length; i++) {
    if (value <= stops[i].at) {
      const a = stops[i - 1];
      const b = stops[i];
      const t = (value - a.at) / (b.at - a.at);
      return [0, 1, 2, 3].map((k) => a.color[k] + (b.color[k] - a.color[k]) * t) as RGBA;
    }
  }
  return stops[stops.length - 1].color;
}

export function legendGradient(scale: Scale): string {
  const min = scale.stops[0].at;
  const max = scale.stops[scale.stops.length - 1].at;
  const parts = scale.stops.map(({ at, color }) => {
    const [r, g, b, a] = color;
    return `rgba(${r},${g},${b},${Math.max(a, 90) / 255}) ${((at - min) / (max - min)) * 100}%`;
  });
  return `linear-gradient(90deg, ${parts.join(", ")})`;
}

export function tickPosition(scale: Scale, at: number): number {
  const min = scale.stops[0].at;
  const max = scale.stops[scale.stops.length - 1].at;
  return ((at - min) / (max - min)) * 100;
}
