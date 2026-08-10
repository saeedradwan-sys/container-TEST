/// <reference types="@types/google.maps" />

import { MapView } from "@/components/Map";
import { STATUS_STYLES } from "@/components/StatusBadge";
import { cn } from "@/lib/utils";
import type { ContainerStatus } from "@shared/tracking";
import { STATUS_LABELS } from "@shared/tracking";
import { MapPinOff } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

export type MapContainer = {
  id: number;
  containerNumber: string;
  status: ContainerStatus;
  currentLatitude: number | null;
  currentLongitude: number | null;
  currentLocation: string | null;
  originCode: string;
  originCity: string;
  originLatitude: number | null;
  originLongitude: number | null;
  destinationCode: string;
  destinationCity: string;
  destinationLatitude: number | null;
  destinationLongitude: number | null;
  vesselName: string;
  progressPercent: number;
};

/** Builds the pin element for a container's last reported position. */
function vesselPin(status: ContainerStatus, label: string) {
  const color = STATUS_STYLES[status]?.marker ?? "#2b5fa8";
  const el = document.createElement("div");
  el.style.cssText = [
    "display:flex",
    "align-items:center",
    "gap:6px",
    "padding:4px 9px 4px 5px",
    "border-radius:999px",
    "background:#ffffff",
    `border:1.5px solid ${color}`,
    "box-shadow:0 2px 10px rgba(16,32,56,0.22)",
    "font:600 11px/1.1 'JetBrains Mono', ui-monospace, monospace",
    "color:#16233a",
    "white-space:nowrap",
    "transform:translateY(-2px)",
  ].join(";");
  const dot = document.createElement("span");
  dot.style.cssText = `width:9px;height:9px;border-radius:999px;background:${color};flex:none`;
  el.appendChild(dot);
  el.appendChild(document.createTextNode(label));
  return el;
}

/** Builds a small labelled marker for an origin or destination port. */
function portPin(code: string, kind: "origin" | "destination") {
  const el = document.createElement("div");
  const accent = kind === "origin" ? "#4a5a70" : "#16233a";
  el.style.cssText = [
    "display:flex",
    "align-items:center",
    "gap:5px",
    "padding:3px 8px",
    "border-radius:6px",
    `background:${accent}`,
    "color:#ffffff",
    "font:600 10px/1.2 'JetBrains Mono', ui-monospace, monospace",
    "letter-spacing:0.04em",
    "box-shadow:0 2px 8px rgba(16,32,56,0.28)",
    "white-space:nowrap",
  ].join(";");
  el.textContent = code;
  return el;
}

type RouteMapProps = {
  containers: MapContainer[];
  className?: string;
  /** Draws origin→destination legs. Disable for a position-only overview. */
  showRoutes?: boolean;
  initialZoom?: number;
  /** Fired when a position marker is clicked. */
  onSelect?: (containerNumber: string) => void;
};

/**
 * Renders container positions and ocean legs on top of the shared MapView.
 * Google Maps owns its own rendering, so overlays are managed imperatively and
 * rebuilt whenever the container set changes.
 */
export function RouteMap({
  containers,
  className,
  showRoutes = true,
  initialZoom = 3,
  onSelect,
}: RouteMapProps) {
  const mapRef = useRef<google.maps.Map | null>(null);
  const overlaysRef = useRef<
    Array<google.maps.Polyline | google.maps.marker.AdvancedMarkerElement>
  >([]);
  const infoRef = useRef<google.maps.InfoWindow | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const draw = useCallback(() => {
    const map = mapRef.current;
    if (!map || !window.google) return;

    for (const overlay of overlaysRef.current) {
      if ("setMap" in overlay) overlay.setMap(null);
      else overlay.map = null;
    }
    overlaysRef.current = [];

    const bounds = new window.google.maps.LatLngBounds();
    let hasPoint = false;

    for (const item of containers) {
      const origin =
        item.originLatitude !== null && item.originLongitude !== null
          ? { lat: item.originLatitude, lng: item.originLongitude }
          : null;
      const destination =
        item.destinationLatitude !== null && item.destinationLongitude !== null
          ? { lat: item.destinationLatitude, lng: item.destinationLongitude }
          : null;
      const current =
        item.currentLatitude !== null && item.currentLongitude !== null
          ? { lat: item.currentLatitude, lng: item.currentLongitude }
          : null;
      const accent = STATUS_STYLES[item.status]?.marker ?? "#2b5fa8";

      if (showRoutes && origin && destination) {
        // Travelled leg is solid; the remaining leg is dashed.
        const travelled = new window.google.maps.Polyline({
          map,
          path: current ? [origin, current] : [origin, destination],
          geodesic: true,
          strokeColor: accent,
          strokeOpacity: 0.9,
          strokeWeight: 2.5,
        });
        overlaysRef.current.push(travelled);

        if (current) {
          const remaining = new window.google.maps.Polyline({
            map,
            path: [current, destination],
            geodesic: true,
            strokeOpacity: 0,
            icons: [
              {
                icon: {
                  path: "M 0,-1 0,1",
                  strokeOpacity: 0.55,
                  strokeColor: accent,
                  strokeWeight: 2,
                  scale: 3,
                },
                offset: "0",
                repeat: "14px",
              },
            ],
          });
          overlaysRef.current.push(remaining);
        }
      }

      if (origin) {
        overlaysRef.current.push(
          new window.google.maps.marker.AdvancedMarkerElement({
            map,
            position: origin,
            content: portPin(item.originCode, "origin"),
            title: `${item.originCity} (origin)`,
            zIndex: 1,
          }),
        );
        bounds.extend(origin);
        hasPoint = true;
      }

      if (destination) {
        overlaysRef.current.push(
          new window.google.maps.marker.AdvancedMarkerElement({
            map,
            position: destination,
            content: portPin(item.destinationCode, "destination"),
            title: `${item.destinationCity} (destination)`,
            zIndex: 2,
          }),
        );
        bounds.extend(destination);
        hasPoint = true;
      }

      if (current) {
        const marker = new window.google.maps.marker.AdvancedMarkerElement({
          map,
          position: current,
          content: vesselPin(item.status, item.containerNumber),
          title: `${item.containerNumber} — ${STATUS_LABELS[item.status]}`,
          zIndex: 3,
        });
        marker.addListener("click", () => {
          if (!infoRef.current) {
            infoRef.current = new window.google.maps.InfoWindow();
          }
          infoRef.current.setContent(
            `<div style="font:400 12px/1.5 Inter,system-ui,sans-serif;color:#16233a;max-width:230px">
               <div style="font-weight:600;font-family:'JetBrains Mono',monospace">${item.containerNumber}</div>
               <div style="margin-top:2px">${STATUS_LABELS[item.status]} · ${item.progressPercent}% complete</div>
               <div style="margin-top:4px;color:#5b6982">${item.vesselName}</div>
               <div style="margin-top:2px;color:#5b6982">${item.currentLocation ?? ""}</div>
             </div>`,
          );
          infoRef.current.open({ map, anchor: marker });
          onSelect?.(item.containerNumber);
        });
        overlaysRef.current.push(marker);
        bounds.extend(current);
        hasPoint = true;
      }
    }

    if (hasPoint) {
      map.fitBounds(bounds, { top: 56, right: 56, bottom: 56, left: 56 });
    }
  }, [containers, showRoutes, onSelect]);

  useEffect(() => {
    draw();
  }, [draw]);

  if (loadError) {
    return (
      <div
        className={cn(
          "flex h-[520px] w-full flex-col items-center justify-center gap-3 bg-muted/40 px-6 text-center",
          className,
        )}
      >
        <MapPinOff className="h-6 w-6 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium">Map could not be loaded</p>
          <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
            The mapping service did not respond. Container positions are still listed
            below and on the container detail pages.
          </p>
        </div>
      </div>
    );
  }

  return (
    <MapView
      className={cn("h-[520px] w-full", className)}
      initialZoom={initialZoom}
      initialCenter={{ lat: 20, lng: 60 }}
      onError={error => setLoadError(error.message)}
      onMapReady={map => {
        mapRef.current = map;
        draw();
      }}
    />
  );
}

export default RouteMap;
