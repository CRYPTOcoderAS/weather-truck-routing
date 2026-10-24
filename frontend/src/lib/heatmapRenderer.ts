import L from "leaflet";
import type { HeatLayer, HeatmapGrid } from "../types";
import { SCALES, colorAt } from "./colorScale";

const TARGET_PX = 720;
const CORRIDOR_MILES = 35;
const EARTH_RADIUS_MI = 3958.76;

const mercY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));

const CanvasOverlay = (L.ImageOverlay as unknown as { extend: (props: object) => new (...args: unknown[]) => L.ImageOverlay }).extend({
  _initImage(this: { _image: HTMLElement; _url: unknown; _zoomAnimated: boolean }) {
    const el = (this._image = this._url as HTMLCanvasElement);
    L.DomUtil.addClass(el, "leaflet-image-layer");
    if (this._zoomAnimated) L.DomUtil.addClass(el, "leaflet-zoom-animated");
    el.onselectstart = L.Util.falseFn as () => boolean;
    el.onmousemove = L.Util.falseFn as () => void;
  },
});

export class HeatmapRenderer {
  readonly canvas = document.createElement("canvas");
  private readonly cells = document.createElement("canvas");
  private readonly mask = document.createElement("canvas");
  private readonly image: ImageData;

  constructor(
    private readonly grid: HeatmapGrid,
    routes: [number, number][][],
  ) {
    const { rows, cols } = grid;
    const scale = Math.ceil(TARGET_PX / Math.max(rows, cols));
    this.cells.width = cols;
    this.cells.height = rows;
    this.canvas.width = this.mask.width = cols * scale;
    this.canvas.height = this.mask.height = rows * scale;
    this.image = new ImageData(cols, rows);
    this.drawCorridorMask(routes);
  }

  overlay(opacity: number, pane: string): L.ImageOverlay {
    const [s, w, n, e] = this.grid.bounds;
    return new CanvasOverlay(this.canvas, L.latLngBounds([s, w], [n, e]), { opacity, pane, interactive: false });
  }

  draw(layer: HeatLayer, hour: number) {
    const frames = this.grid.frames[layer];
    hour = Math.min(Math.max(hour, 0), this.grid.hours);
    const h0 = Math.floor(hour);
    const h1 = Math.min(h0 + 1, this.grid.hours);
    const f = hour - h0;
    const a = frames[h0];
    const b = frames[h1];
    const scale = SCALES[layer];
    const data = this.image.data;

    for (let i = 0; i < a.length; i++) {
      const v0 = a[i];
      const v1 = b[i] ?? v0;
      const o = i * 4;
      if (v0 === null || v1 === null) {
        data[o + 3] = 0;
        continue;
      }
      const c = colorAt(scale, v0 + (v1 - v0) * f);
      data[o] = c[0];
      data[o + 1] = c[1];
      data[o + 2] = c[2];
      data[o + 3] = c[3];
    }
    this.cells.getContext("2d")!.putImageData(this.image, 0, 0);

    const ctx = this.canvas.getContext("2d")!;
    ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(this.cells, 0, 0, this.canvas.width, this.canvas.height);
    ctx.globalCompositeOperation = "destination-in";
    ctx.drawImage(this.mask, 0, 0);
    ctx.globalCompositeOperation = "source-over";
  }

  private drawCorridorMask(routes: [number, number][][]) {
    const [s, w, n, e] = this.grid.bounds;
    const { width, height } = this.mask;
    const yN = mercY(n);
    const yS = mercY(s);
    const toPx = ([lat, lon]: [number, number]): [number, number] => [
      ((lon - w) / (e - w)) * width,
      ((yN - mercY(lat)) / (yN - yS)) * height,
    ];
    const midLat = ((s + n) / 2) * (Math.PI / 180);
    const pxPerMile = height / (yN - yS) / Math.cos(midLat) / EARTH_RADIUS_MI;
    const core = 2 * CORRIDOR_MILES * pxPerMile;

    const ctx = this.mask.getContext("2d")!;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#000";
    const passes: [number, number][] = [
      [1.6, 0.2],
      [1.4, 0.25],
      [1.2, 0.35],
      [1.0, 1],
    ];
    for (const [widthFactor, alpha] of passes) {
      ctx.globalAlpha = alpha;
      ctx.lineWidth = core * widthFactor;
      for (const route of routes) {
        ctx.beginPath();
        route.forEach((p, i) => (i ? ctx.lineTo(...toPx(p)) : ctx.moveTo(...toPx(p))));
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }
}
