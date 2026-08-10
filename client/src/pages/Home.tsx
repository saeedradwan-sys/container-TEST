import DashboardLayout from "@/components/DashboardLayout";
import PageHeader from "@/components/PageHeader";
import { StatusBadge, STATUS_STYLES } from "@/components/StatusBadge";
import VoyageProgress from "@/components/VoyageProgress";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, formatRelative } from "@/lib/format";
import { trpc } from "@/lib/trpc";
import type { ContainerStatus } from "@shared/tracking";
import {
  Anchor,
  ArrowRight,
  Boxes,
  CheckCircle2,
  Clock3,
  ShieldAlert,
  Ship,
  TriangleAlert,
} from "lucide-react";
import { Link } from "wouter";

type StatCard = {
  key: string;
  label: string;
  value: number;
  hint: string;
  icon: typeof Ship;
  accent: string;
  tint: string;
};

export default function Home() {
  const stats = trpc.tracking.stats.useQuery();
  const recent = trpc.tracking.list.useQuery({ sort: "recent", limit: 6 });
  const attention = trpc.tracking.list.useQuery({
    statuses: ["delayed", "customs_hold"],
    sort: "eta",
    limit: 5,
  });

  const s = stats.data;
  const cards: StatCard[] = [
    {
      key: "total",
      label: "Total containers",
      value: s?.total ?? 0,
      hint: "Tracked across all active bookings",
      icon: Boxes,
      accent: "var(--primary)",
      tint: "var(--accent)",
    },
    {
      key: "in_transit",
      label: "In Transit",
      value: s?.in_transit ?? 0,
      hint: "Currently on the water",
      icon: Ship,
      accent: STATUS_STYLES.in_transit.color,
      tint: STATUS_STYLES.in_transit.background,
    },
    {
      key: "delivered",
      label: "Delivered",
      value: s?.delivered ?? 0,
      hint: "Completed door deliveries",
      icon: CheckCircle2,
      accent: STATUS_STYLES.delivered.color,
      tint: STATUS_STYLES.delivered.background,
    },
    {
      key: "delayed",
      label: "Delayed",
      value: s?.delayed ?? 0,
      hint: "Behind the original schedule",
      icon: TriangleAlert,
      accent: STATUS_STYLES.delayed.color,
      tint: STATUS_STYLES.delayed.background,
    },
  ];

  const secondary = [
    {
      key: "at_port",
      label: "At Port",
      value: s?.at_port ?? 0,
      icon: Anchor,
      accent: STATUS_STYLES.at_port.color,
    },
    {
      key: "customs_hold",
      label: "Customs Hold",
      value: s?.customs_hold ?? 0,
      icon: ShieldAlert,
      accent: STATUS_STYLES.customs_hold.color,
    },
  ];

  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-7xl space-y-8 px-1 py-4 sm:px-4 sm:py-6">
        <PageHeader
          eyebrow="Operations overview"
          title="Fleet visibility at a glance"
          description="Live status across every tracked container, with the exceptions that need attention surfaced first."
          actions={
            <Button asChild variant="outline" className="bg-card">
              <Link href="/containers">
                Browse containers
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
          }
        />

        {/* Summary stats */}
        <section aria-label="Summary statistics">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {cards.map((card, index) => (
              <div
                key={card.key}
                className="surface rise flex flex-col gap-4 p-5"
                style={{ animationDelay: `${index * 45}ms` }}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    {card.label}
                  </p>
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                    style={{ backgroundColor: card.tint, color: card.accent }}
                  >
                    <card.icon className="h-4 w-4" />
                  </span>
                </div>
                <div>
                  {stats.isLoading ? (
                    <Skeleton className="h-9 w-16" />
                  ) : (
                    <p
                      className="font-display tabular text-[2.1rem] leading-none"
                      style={{ color: card.accent }}
                    >
                      {card.value}
                    </p>
                  )}
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    {card.hint}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {secondary.map(item => (
              <div
                key={item.key}
                className="surface flex items-center justify-between gap-4 px-5 py-4"
              >
                <div className="flex items-center gap-3">
                  <item.icon className="h-4 w-4" style={{ color: item.accent }} />
                  <span className="text-sm font-medium">{item.label}</span>
                </div>
                {stats.isLoading ? (
                  <Skeleton className="h-6 w-8" />
                ) : (
                  <span className="tabular text-lg font-semibold">{item.value}</span>
                )}
              </div>
            ))}
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.35fr_1fr]">
          {/* Recent activity */}
          <section className="surface overflow-hidden" aria-label="Recent movements">
            <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
              <div>
                <h2 className="font-display text-base">Latest movements</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Containers ordered by most recent tracking event
                </p>
              </div>
              <Clock3 className="h-4 w-4 text-muted-foreground" />
            </div>

            {recent.isLoading ? (
              <div className="divide-y">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="space-y-3 px-5 py-4">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-full max-w-sm" />
                  </div>
                ))}
              </div>
            ) : recent.isError ? (
              <p className="px-5 py-8 text-sm text-destructive">
                Could not load recent movements. Please refresh to try again.
              </p>
            ) : !recent.data?.length ? (
              <p className="px-5 py-8 text-sm text-muted-foreground">
                No containers are being tracked yet.
              </p>
            ) : (
              <ul className="divide-y">
                {recent.data.map(row => (
                  <li key={row.id}>
                    <Link
                      href={`/containers/${row.containerNumber}`}
                      className="block px-5 py-4 transition-colors hover:bg-accent/40"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="code text-sm font-semibold">
                            {row.containerNumber}
                          </span>
                          <StatusBadge status={row.status as ContainerStatus} />
                        </div>
                        <span className="tabular text-xs text-muted-foreground">
                          ETA {formatDate(row.eta)} · {formatRelative(row.eta)}
                        </span>
                      </div>
                      <p className="mt-2 truncate text-xs text-muted-foreground">
                        {row.carrier} · {row.vesselName} · {row.currentLocation ?? "Position pending"}
                      </p>
                      <VoyageProgress
                        className="mt-3"
                        showLabels={false}
                        origin={row.originCode}
                        destination={row.destinationCode}
                        percent={row.progressPercent}
                        status={row.status as ContainerStatus}
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Exceptions */}
          <section className="surface overflow-hidden" aria-label="Needs attention">
            <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
              <div>
                <h2 className="font-display text-base">Needs attention</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Delayed shipments and customs holds
                </p>
              </div>
              <TriangleAlert
                className="h-4 w-4"
                style={{ color: STATUS_STYLES.delayed.color }}
              />
            </div>

            {attention.isLoading ? (
              <div className="divide-y">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="space-y-3 px-5 py-4">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                ))}
              </div>
            ) : attention.isError ? (
              <p className="px-5 py-8 text-sm text-destructive">
                Could not load exceptions. Please refresh to try again.
              </p>
            ) : !attention.data?.length ? (
              <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
                <CheckCircle2
                  className="h-6 w-6"
                  style={{ color: STATUS_STYLES.delivered.color }}
                />
                <p className="text-sm font-medium">Everything on schedule</p>
                <p className="text-xs text-muted-foreground">
                  No delays or customs holds right now.
                </p>
              </div>
            ) : (
              <ul className="divide-y">
                {attention.data.map(row => (
                  <li key={row.id}>
                    <Link
                      href={`/containers/${row.containerNumber}`}
                      className="block px-5 py-4 transition-colors hover:bg-accent/40"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="code text-sm font-semibold">
                          {row.containerNumber}
                        </span>
                        <StatusBadge status={row.status as ContainerStatus} />
                      </div>
                      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                        {row.notes ?? `${row.originCity} → ${row.destinationCity}`}
                      </p>
                      <p className="tabular mt-1.5 text-xs text-muted-foreground">
                        ETA {formatDate(row.eta)}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </DashboardLayout>
  );
}
