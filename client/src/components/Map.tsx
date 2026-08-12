import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type MapViewProps = {
  className?: string;
  children?: ReactNode;
  ariaLabel?: string;
};

/**
 * A dependency-free ocean map canvas used by the tracker. The previous
 * Google Maps runtime depended on a browser-origin handshake that failed in
 * preview and production. RouteMap supplies live SVG overlays on this stable
 * canvas, so coordinates, ports, and routes render without an external SDK.
 */
export function MapView({ className, children, ariaLabel = "Ocean freight map" }: MapViewProps) {
  return (
    <div
      className={cn("relative isolate overflow-hidden bg-[#0b263d]", className)}
      role="img"
      aria-label={ariaLabel}
    >
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full"
        viewBox="0 0 1200 600"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="ocean-gradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#123d57" />
            <stop offset="0.5" stopColor="#0b2d46" />
            <stop offset="1" stopColor="#071e32" />
          </linearGradient>
          <pattern id="ocean-grid" width="100" height="60" patternUnits="userSpaceOnUse">
            <path d="M 100 0 L 0 0 0 60" fill="none" stroke="#8fc7d3" strokeOpacity="0.09" strokeWidth="1" />
          </pattern>
          <filter id="coast-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#041321" floodOpacity="0.35" />
          </filter>
        </defs>
        <rect width="1200" height="600" fill="url(#ocean-gradient)" />
        <rect width="1200" height="600" fill="url(#ocean-grid)" />
        <path
          d="M0 0h184l22 26 14 27-10 25 20 32-12 34 24 30-8 35 20 34-22 38 15 45-22 36 8 45-24 34H0Zm1200 0h-145l-18 26 12 30-24 30 15 31-18 29 11 33-21 37 20 35-11 39 24 36-12 44 22 38-19 37 18 38 34 26h112ZM382 0l25 30-7 28 20 24-13 32 18 31-9 36 20 36-17 34 12 36-21 34 18 31-14 36 19 34-29 42 17 36-13 34 24 30-24 35 15 27H270l24-39-15-28 20-31-11-33 22-35-12-34 19-39-18-36 13-34-20-32 14-35-15-34 20-34-10-35 21-34-12-34 21-29Z"
          fill="#163f51"
          fillOpacity="0.82"
          filter="url(#coast-shadow)"
        />
        <path
          d="M694 0l20 31-12 31 17 28-18 35 22 32-15 36 19 32-17 36 15 35-22 35 17 35-18 32 16 34-24 34 18 33-15 33 23 32-18 37 22 32-13 30 17 32H594l21-31-14-34 18-34-13-38 18-32-16-36 20-32-15-36 21-34-17-34 20-31-14-35 18-35-12-34 19-31-16-31 18-31-13-30Z"
          fill="#1a4a58"
          fillOpacity="0.78"
          filter="url(#coast-shadow)"
        />
        <path
          d="M1030 0l-14 32 19 28-13 30 22 30-14 33 13 28-20 35 16 33-22 34 17 33-21 34 15 33-19 36 18 30-23 40 17 31-14 35 17 34-18 34h174V0ZM355 472l16 23-17 25 12 27-24 29-29-4-15-24 12-24-13-26 24-27Z"
          fill="#205263"
          fillOpacity="0.75"
          filter="url(#coast-shadow)"
        />
        <g fill="none" stroke="#a4dce0" strokeOpacity="0.16" strokeWidth="1">
          <path d="M0 300h1200" />
          <path d="M0 150h1200" />
          <path d="M0 450h1200" />
          <path d="M300 0v600" />
          <path d="M600 0v600" />
          <path d="M900 0v600" />
        </g>
      </svg>
      <div className="relative h-full w-full">{children}</div>
    </div>
  );
}

export default MapView;
