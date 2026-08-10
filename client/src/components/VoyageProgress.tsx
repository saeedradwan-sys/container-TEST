import { STATUS_STYLES } from "@/components/StatusBadge";
import { cn } from "@/lib/utils";
import type { ContainerStatus } from "@shared/tracking";

/**
 * Origin → destination progress rail. The fill colour follows the container
 * status so a delayed leg reads differently from a healthy one at a glance.
 */
export function VoyageProgress({
  origin,
  destination,
  percent,
  status,
  className,
  showLabels = true,
}: {
  origin: string;
  destination: string;
  percent: number;
  status: ContainerStatus;
  className?: string;
  showLabels?: boolean;
}) {
  const clamped = Math.min(100, Math.max(0, percent));
  const accent = (STATUS_STYLES[status] ?? STATUS_STYLES.in_transit).color;

  return (
    <div className={cn("w-full", className)}>
      {showLabels ? (
        <div className="mb-1.5 flex items-baseline justify-between gap-3 text-xs">
          <span className="code font-medium">{origin}</span>
          <span className="tabular text-muted-foreground">{clamped}%</span>
          <span className="code font-medium">{destination}</span>
        </div>
      ) : null}
      <div
        className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Voyage progress from ${origin} to ${destination}`}
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-500"
          style={{
            width: `${clamped}%`,
            backgroundColor: accent,
            transitionTimingFunction: "var(--ease-out-quint)",
          }}
        />
      </div>
    </div>
  );
}

export default VoyageProgress;

