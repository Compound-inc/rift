"use client";

import "mapbox-gl/dist/mapbox-gl.css";
import Map from "react-map-gl/mapbox";
import { useEffect, useMemo, useRef } from "react";
import type { MapRef } from "react-map-gl/mapbox";
import { Marker } from "react-map-gl/mapbox";

type Hotspot = {
  id: string;
  name: string;
  longitude: number;
  latitude: number;
  value: number; // intensity (e.g., AI questions count)
};

type MapboxMexicoGlobeProps = {
  height?: number;
  hotspots?: Hotspot[];
  cloud?: boolean; // broaden points into a cloud for heatmap
};

export default function MapboxMexicoGlobe({ height = 600, hotspots = [], cloud = true }: MapboxMexicoGlobeProps) {
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const mapRef = useRef<MapRef | null>(null);

  // Deterministic PRNG to create stable cloud point offsets per hotspot id
  const makeRng = (seedStr: string) => {
    let h = 2166136261;
    for (let i = 0; i < seedStr.length; i++) h = Math.imul(h ^ seedStr.charCodeAt(i), 16777619);
    return () => {
      h += 0x6D2B79F5;
      let t = Math.imul(h ^ (h >>> 15), 1 | h);
      t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  const hotspotsGeoJson = useMemo(() => {
    const features: any[] = [];
    for (const h of hotspots) {
      if (!cloud) {
        features.push({
          type: "Feature",
          properties: { id: h.id, name: h.name, value: h.value },
          geometry: { type: "Point", coordinates: [h.longitude, h.latitude] },
        });
        continue;
      }

      const sampleCount = Math.max(6, Math.min(40, Math.round(h.value / 5)));
      const rng = makeRng(h.id + h.name);

      // Broaden radius in km based on value
      const radiusKm = 20 + (h.value / 100) * 230; // 20km .. ~250km
      const latDeg = radiusKm / 111; // 1 deg lat ~ 111km
      const lonDeg = radiusKm / (111 * Math.max(0.2, Math.cos((h.latitude * Math.PI) / 180)));
      const perPointValue = Math.max(1, h.value / sampleCount);

      for (let i = 0; i < sampleCount; i++) {
        // Sample uniformly in disc with sqrt for area-uniform
        const u = rng();
        const v = rng();
        const r = Math.sqrt(u);
        const theta = v * 2 * Math.PI;
        const dLat = latDeg * r * Math.sin(theta);
        const dLon = lonDeg * r * Math.cos(theta);
        features.push({
          type: "Feature",
          properties: {
            id: `${h.id}-${i}`,
            name: h.name,
            value: perPointValue,
          },
          geometry: { type: "Point", coordinates: [h.longitude + dLon, h.latitude + dLat] },
        });
      }

      // Add a central anchor point to keep the cloud centered precisely on the city
      features.push({
        type: "Feature",
        properties: {
          id: `${h.id}-center`,
          name: h.name,
          value: perPointValue * 6,
        },
        geometry: { type: "Point", coordinates: [h.longitude, h.latitude] },
      });
    }

    return { type: "FeatureCollection", features } as const;
  }, [hotspots, cloud]);

  if (!mapboxToken) {
    return (
      <div className="text-sm text-muted-foreground">
        Map unavailable. Set <code>NEXT_PUBLIC_MAPBOX_TOKEN</code> in your environment.
      </div>
    );
  }

  // Keep heatmap data in sync if hotspots change
  useEffect(() => {
    const map = mapRef.current?.getMap?.();
    if (!map) return;
    const src: any = map.getSource && map.getSource("hotspots");
    if (src && src.setData) {
      src.setData(hotspotsGeoJson as any);
    }
  }, [hotspotsGeoJson]);

  return (
    <div style={{ width: "100%", height }}>
      <Map
        ref={mapRef}
        initialViewState={{
          longitude: -102.5528, // Mexico center
          latitude: 23.6345,
          zoom: 3,
          bearing: 0,
          pitch: 30,
        }}
        mapStyle="mapbox://styles/mapbox/light-v11"
        projection="globe"
        mapboxAccessToken={mapboxToken}
        style={{ width: "100%", height: "100%", borderRadius: "0.5rem" }}
        onLoad={(e) => {
          const map: any = e.target;
          if (!map.getSource("hotspots")) {
            map.addSource("hotspots", {
              type: "geojson",
              data: hotspotsGeoJson,
            });

            map.addLayer({
              id: "hotspots-heat",
              type: "heatmap",
              source: "hotspots",
              maxzoom: 22,
              paint: {
                "heatmap-weight": ["interpolate", ["linear"], ["get", "value"], 0, 0.0, 100, 1.0],
                "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 2, 0.4, 9, 1.5, 14, 2.0, 20, 2.4],
                "heatmap-color": [
                  "interpolate",
                  ["linear"],
                  ["heatmap-density"],
                  0.0, "rgba(0,0,0,0)",
                  0.1, "#e3f2fd",
                  0.2, "#bbdefb",
                  0.3, "#90caf9",
                  0.4, "#64b5f6",
                  0.5, "#42a5f5",
                  0.6, "#2196f3",
                  0.7, "#1e88e5",
                  0.8, "#1976d2",
                  0.9, "#1565c0",
                  1.0, "#0d47a1"
                ],
                "heatmap-radius": [
                  "interpolate",
                  ["linear"],
                  ["zoom"],
                  2, 24,
                  6, 48,
                  10, 96,
                  14, 160,
                  18, 240,
                  22, 320
                ],
                "heatmap-opacity": ["interpolate", ["linear"], ["zoom"], 2, 0.7, 10, 0.62, 16, 0.58, 22, 0.55],
              },
            });
          }
        }}
      >
      </Map>
    </div>
  );
}


