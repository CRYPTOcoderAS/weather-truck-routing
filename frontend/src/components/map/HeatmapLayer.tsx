import type L from "leaflet";
import { useEffect, useMemo, useRef } from "react";
import { useMap } from "react-leaflet";
import { HeatmapRenderer } from "../../lib/heatmapRenderer";
import type { HeatLayer, HeatmapGrid } from "../../types";

interface Props {
  grid: HeatmapGrid;
  corridors: [number, number][][];
  layer: HeatLayer;
  hour: number;
  opacity: number;
}

const PANE = "heatmap";

export function HeatmapLayer({ grid, corridors, layer, hour, opacity }: Props) {
  const map = useMap();
  const renderer = useMemo(() => new HeatmapRenderer(grid, corridors), [grid, corridors]);
  const overlay = useRef<L.ImageOverlay | null>(null);

  useEffect(() => {
    if (!map.getPane(PANE)) {
      const pane = map.createPane(PANE);
      pane.style.zIndex = "350";
      pane.style.pointerEvents = "none";
    }
    overlay.current = renderer.overlay(opacity, PANE).addTo(map);
    return () => {
      overlay.current?.remove();
      overlay.current = null;
    };
  }, [map, renderer]);

  useEffect(() => {
    overlay.current?.setOpacity(opacity);
  }, [opacity]);

  useEffect(() => {
    renderer.draw(layer, hour);
  }, [renderer, layer, hour]);

  return null;
}
