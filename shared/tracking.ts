import type { ContainerStatus } from "../drizzle/schema";

export type { ContainerStatus };

/**
 * Canonical status labels. These strings are contractual: they appear verbatim
 * in the UI badges and must not be reworded.
 */
export const STATUS_LABELS: Record<ContainerStatus, string> = {
  in_transit: "In Transit",
  at_port: "At Port",
  customs_hold: "Customs Hold",
  delivered: "Delivered",
  delayed: "Delayed",
};

export const STATUS_ORDER: ContainerStatus[] = [
  "in_transit",
  "at_port",
  "customs_hold",
  "delivered",
  "delayed",
];

export function statusLabel(status: ContainerStatus): string {
  return STATUS_LABELS[status] ?? status;
}
