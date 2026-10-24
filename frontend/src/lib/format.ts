const timeFmt = new Intl.DateTimeFormat(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" });
const tzName =
  new Intl.DateTimeFormat(undefined, { timeZoneName: "short" })
    .formatToParts(new Date())
    .find((p) => p.type === "timeZoneName")?.value ?? "local";

export const localTimeZone = tzName;

export function formatTime(epochSeconds: number): string {
  return timeFmt.format(new Date(epochSeconds * 1000));
}

export function formatDuration(minutes: number): string {
  const total = Math.round(minutes);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}

export function formatMiles(miles: number): string {
  return `${miles.toLocaleString(undefined, { maximumFractionDigits: miles < 10 ? 1 : 0 })} mi`;
}

export function nextHourLocalInput(): string {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const WMO: [number, string][] = [
  [0, "Clear"],
  [3, "Cloudy"],
  [48, "Fog"],
  [57, "Drizzle"],
  [67, "Rain"],
  [77, "Snow"],
  [82, "Rain showers"],
  [86, "Snow showers"],
  [99, "Thunderstorm"],
];

export function describeWeather(code: number): string {
  return WMO.find(([max]) => code <= max)?.[1] ?? "—";
}
