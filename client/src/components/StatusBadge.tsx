import { cn } from "@/lib/utils";
import type { ContainerStatus } from "@shared/tracking";
import { STATUS_LABELS } from "@shared/tracking";
import {
  AlertTriangle,
  Anchor,
  CheckCircle2,
  Clock,
  ShieldAlert,
  Ship,
} from "lucide-react";

/**
 * Status presentation is centralised here so badges, timeline dots and map
 * markers always agree on colour and wording.
 */
export const STATUS_STYLES: Record<
  ContainerStatus,
  {
    /** Inline styles reference CSS variables so both themes stay consistent. */
    color: string;
    background: string;
    icon: typeof Ship;
    /** Hex fallback for Google Maps markers, which cannot read CSS vars. */
    marker: string;
  }
> = {
  in_transit: {
    color: "var(--status-transit)",
    background: "var(--status-transit-bg)",
    icon: Ship,
    marker: "#2b5fa8",
  },
  at_port: {
    color: "var(--status-port)",
    background: "var(--status-port-bg)",
    icon: Anchor,
    marker: "#1f7a8c",
  },
  customs_hold: {
    color: "var(--status-hold)",
    background: "var(--status-hold-bg)",
    icon: ShieldAlert,
    marker: "#b26a1c",
  },
  delivered: {
    color: "var(--status-delivered)",
    background: "var(--status-delivered-bg)",
    icon: CheckCircle2,
    marker: "#1e7a55",
  },
  delayed: {
    color: "var(--status-delayed)",
    background: "var(--status-delayed-bg)",
    icon: AlertTriangle,
    marker: "#c0392b",
  },
};

type StatusBadgeProps = {
  status: ContainerStatus;
  className?: string;
  /** Hides the leading icon for dense contexts such as table cells. */
  iconless?: boolean;
  size?: "sm" | "md";
};

export function StatusBadge({
  status,
  className,
  iconless = false,
  size = "sm",
}: StatusBadgeProps) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.in_transit;
  const Icon = style.icon ?? Clock;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium whitespace-nowrap",
        size === "sm" ? "px-2.5 py-0.5 text-xs" : "px-3 py-1 text-sm",
        className,
      )}
      style={{
        color: style.color,
        backgroundColor: style.background,
        borderColor: `color-mix(in oklch, ${style.color} 24%, transparent)`,
      }}
    >
      {!iconless && <Icon className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} />}
      {STATUS_LABELS[status]}
    </span>
  );
}

export default StatusBadge;

