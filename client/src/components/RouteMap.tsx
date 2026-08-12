import { MapView } from "@/components/Map";
import { STATUS_STYLES } from "@/components/StatusBadge";
import { cn } from "@/lib/utils";
import type { ContainerStatus } from "@shared/tracking";
import { STATUS_LABELS } from "@shared/tracking";
import { Anchor, Crosshair, MapPin, Ship } from "lucide-react";
import { useMemo } from "react";

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

type Point = { x: number; y: number };
type PortPoint = Point & { code: string; city: string; kind: "origin" | "destination" };

type RouteMapProps = {
  containers: MapContainer[];
  className?: string;
  showRoutes?: boolean;
  initialZoom?: number;
  onSelect?: (containerNumber: string) => void;
};

const WIDTH = 1200;
const HEIGHT = 600;

/** Equirectangular projection: longitude/latitude → the map's SVG coordinate system. */
function project(latitude: number | null, longitude: number | null): Point | null {
  if (latitude === null || longitude === null || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }
  return {
    x: ((Math.max(-180, Math.min(180, longitude)) + 180) / 360) * WIDTH,
    y: ((90 - Math.max(-85, Math.min(85, latitude))) / 175) * HEIGHT,
  };
}

function routePath(from: Point, to: Point, bend = 22) {
  const middleX = (from.x + to.x) / 2;
  const middleY = (from.y + to.y) / 2;
  const distance = Math.max(80, Math.hypot(to.x - from.x, to.y - from.y));
  const curve = Math.min(90, Math.max(bend, distance * 0.12));
  return `M ${from.x.toFixed(1)} ${from.y.toFixed(1)} Q ${middleX.toFixed(1)} ${(middleY - curve).toFixed(1)} ${to.x.toFixed(1)} ${to.y.toFixed(1)}`;
}

function portKey(point: PortPoint) {
  return `${point.code}-${point.kind}-${Math.round(point.x)}-${Math.round(point.y)}`;
}

export function getMapRenderSummary(containers: MapContainer[]) {
  return {
    positions: containers.filter(
      item => project(item.currentLatitude, item.currentLongitude) !== null,
    ).length,
    routes: containers.filter(
      item =>
        project(item.originLatitude, item.originLongitude) !== null &&
        project(item.destinationLatitude, item.destinationLongitude) !== null,
    ).length,
  };
}

/**
 * Reliable coordinate map for the fleet. It deliberately uses SVG rather than
 * a third-party runtime: the map remains functional in preview and production,
 * and every marker is driven directly by the container's reported latitude and
 * longitude from the tracking API.
 */
export function RouteMap({
  containers,
  className,
  showRoutes = true,
  initialZoom = 3,
  onSelect,
}: RouteMapProps) {
  void initialZoom;

  const plotted = useMemo(
    () =>
      containers.map(item => ({
        item,
        origin: project(item.originLatitude, item.originLongitude),
        destination: project(item.destinationLatitude, item.destinationLongitude),
        current: project(item.currentLatitude, item.currentLongitude),
      })),
    [containers],
  );

  const ports = useMemo(() => {
    const unique = new Map<string, PortPoint>();
    for (const { item, origin, destination } of plotted) {
      if (origin) {
        const port: PortPoint = {
          ...origin,
          code: item.originCode,
          city: item.originCity,
          kind: "origin",
        };
        unique.set(portKey(port), port);
      }
      if (destination) {
        const port: PortPoint = {
          ...destination,
          code: item.destinationCode,
          city: item.destinationCity,
          kind: "destination",
        };
        unique.set(portKey(port), port);
      }
    }
    return Array.from(unique.values());
  }, [plotted]);

  const renderSummary = useMemo(() => getMapRenderSummary(containers), [containers]);
  const locationsReported = renderSummary.positions;

  return (
    <MapView
      className={cn("h-[520px] w-full", className)}
      ariaLabel={`Container location map showing ${locationsReported} reported positions`}
    >
      <div
        className="absolute inset-0"
        data-testid="route-map"
        data-current-position-count={renderSummary.positions}
        data-route-count={showRoutes ? renderSummary.routes : 0}
      >
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <filter id="route-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <marker id="route-arrow" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
              <path d="M0,0 L0,6 L8,3 z" fill="#91d5d9" fillOpacity="0.75" />
            </marker>
          </defs>

          {showRoutes
            ? plotted.map(({ item, origin, destination, current }) => {
                if (!origin || !destination) return null;
                const accent = STATUS_STYLES[item.status]?.marker ?? "#55c3c7";
                const travelledEnd = current ?? destination;
                return (
                  <g key={`route-${item.id}`}>
                    <path
                      d={routePath(origin, destination, 16)}
                      fill="none"
                      stroke="#8ecbd1"
                      strokeOpacity="0.2"
                      strokeWidth="5"
                    />
                    <path
                      d={routePath(origin, travelledEnd, 16)}
                      fill="none"
                      stroke={accent}
                      strokeOpacity="0.9"
                      strokeWidth="2.4"
                      filter="url(#route-glow)"
                      markerEnd={current ? undefined : "url(#route-arrow)"}
                    />
                    {current ? (
                      <path
                        d={routePath(current, destination, 16)}
                        fill="none"
                        stroke="#b5e2e4"
                        strokeOpacity="0.55"
                        strokeWidth="1.8"
                        strokeDasharray="7 8"
                      />
                    ) : null}
                  </g>
                );
              })
            : null}

          {ports.map(port => (
            <g key={portKey(port)} transform={`translate(${port.x}, ${port.y})`}>
              <circle r="8" fill="#061c2d" fillOpacity="0.65" stroke="#9edadd" strokeOpacity="0.7" />
              <circle r="3" fill={port.kind === "origin" ? "#a7c1cb" : "#ffffff"} />
            </g>
          ))}
        </svg>

        {ports.map(port => (
          <div
            key={`label-${portKey(port)}`}
            className="pointer-events-none absolute hidden -translate-x-1/2 -translate-y-1/2 items-center gap-1 rounded bg-[#071d30]/85 px-1.5 py-0.5 text-[9px] font-semibold tracking-[0.1em] text-[#d9f1f1] shadow-sm sm:flex"
            style={{ left: `${(port.x / WIDTH) * 100}%`, top: `${(port.y / HEIGHT) * 100}%`, marginTop: port.kind === "origin" ? 18 : -18 }}
          >
            <Anchor className="h-2.5 w-2.5" />
            {port.code}
          </div>
        ))}

        {plotted.map(({ item, current }) => {
          if (!current) return null;
          const accent = STATUS_STYLES[item.status]?.marker ?? "#55c3c7";
          return (
            <button
              key={`marker-${item.id}`}
              type="button"
              className="group absolute -translate-x-1/2 -translate-y-1/2 rounded-full p-2 text-left outline-none transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-white/80"
              style={{ left: `${(current.x / WIDTH) * 100}%`, top: `${(current.y / HEIGHT) * 100}%` }}
              onClick={() => onSelect?.(item.containerNumber)}
              title={`${item.containerNumber} · ${item.currentLocation ?? "Current position"}`}
              aria-label={`${item.containerNumber}, ${STATUS_LABELS[item.status]}, ${item.currentLocation ?? "current position"}`}
            >
              <span
                className="absolute inset-1 animate-ping rounded-full opacity-30"
                style={{ backgroundColor: accent }}
                aria-hidden="true"
              />
              <span
                className="relative flex h-7 w-7 items-center justify-center rounded-full border-2 border-white/90 shadow-[0_3px_12px_rgba(0,0,0,0.35)]"
                style={{ backgroundColor: accent }}
              >
                <Ship className="h-3.5 w-3.5 text-white" />
              </span>
              <span className="pointer-events-none absolute left-1/2 top-full mt-1 hidden -translate-x-1/2 whitespace-nowrap rounded bg-[#061b2d]/95 px-2 py-1 text-[10px] font-semibold text-white shadow-lg group-hover:block group-focus-visible:block">
                {item.containerNumber}
              </span>
            </button>
          );
        })}

        <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full border border-white/10 bg-[#061b2d]/85 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#d8f0f0] shadow-lg backdrop-blur-sm">
          <Crosshair className="h-3.5 w-3.5 text-[#91d5d9]" />
          {locationsReported} current positions
        </div>

        <div className="absolute bottom-4 left-4 flex flex-wrap gap-2 text-[10px] text-[#c7e6e7] sm:left-auto sm:right-4">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-[#061b2d]/80 px-2.5 py-1 backdrop-blur-sm">
            <MapPin className="h-3 w-3 text-[#91d5d9]" /> Current location
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-[#061b2d]/80 px-2.5 py-1 backdrop-blur-sm">
            <span className="h-px w-3 bg-[#91d5d9]" /> Route
          </span>
        </div>
      </div>
    </MapView>
  );
}

export default RouteMap;
