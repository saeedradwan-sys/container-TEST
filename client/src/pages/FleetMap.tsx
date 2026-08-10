import DashboardLayout from "@/components/DashboardLayout";
import PageHeader from "@/components/PageHeader";
import RouteMap from "@/components/RouteMap";
import { StatusBadge, STATUS_STYLES } from "@/components/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { formatDate } from "@/lib/format";
import { trpc } from "@/lib/trpc";
import type { ContainerStatus } from "@shared/tracking";
import { STATUS_LABELS, STATUS_ORDER } from "@shared/tracking";
import { useMemo, useState } from "react";
import { Link } from "wouter";

export default function FleetMap() {
  const [showRoutes, setShowRoutes] = useState(true);
  const [activeStatuses, setActiveStatuses] = useState<ContainerStatus[]>([
    ...STATUS_ORDER,
  ]);

  const queryInput = useMemo(() => ({ sort: "eta" as const, limit: 200 }), []);
  const list = trpc.tracking.list.useQuery(queryInput);

  const visible = useMemo(
    () =>
      (list.data ?? []).filter(row =>
        activeStatuses.includes(row.status as ContainerStatus),
      ),
    [list.data, activeStatuses],
  );

  const toggleStatus = (status: ContainerStatus) => {
    setActiveStatuses(current =>
      current.includes(status)
        ? current.filter(s => s !== status)
        : [...current, status],
    );
  };

  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-7xl space-y-6 px-1 py-4 sm:px-4 sm:py-6">
        <PageHeader
          eyebrow="Live positions"
          title="Fleet map"
          description="Last reported position for every tracked container, with the ocean leg between load and discharge ports."
          actions={
            <div className="flex items-center gap-2.5">
              <Switch
                id="show-routes"
                checked={showRoutes}
                onCheckedChange={setShowRoutes}
              />
              <Label htmlFor="show-routes" className="text-sm font-normal">
                Show routes
              </Label>
            </div>
          }
        />

        {/* Status legend doubles as a filter */}
        <div className="flex flex-wrap items-center gap-2">
          {STATUS_ORDER.map(status => {
            const active = activeStatuses.includes(status);
            const count = (list.data ?? []).filter(r => r.status === status).length;
            return (
              <button
                key={status}
                onClick={() => toggleStatus(status)}
                aria-pressed={active}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  active
                    ? "border-transparent"
                    : "border-border bg-transparent text-muted-foreground"
                }`}
                style={
                  active
                    ? {
                        backgroundColor: STATUS_STYLES[status].background,
                        color: STATUS_STYLES[status].color,
                      }
                    : undefined
                }
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{
                    backgroundColor: active
                      ? STATUS_STYLES[status].marker
                      : "var(--muted-foreground)",
                  }}
                />
                {STATUS_LABELS[status]}
                <span className="tabular opacity-70">{count}</span>
              </button>
            );
          })}
        </div>

        <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
          <div className="surface overflow-hidden">
            {list.isLoading ? (
              <Skeleton className="h-[560px] w-full rounded-none" />
            ) : list.isError ? (
              <p className="px-5 py-24 text-center text-sm text-destructive">
                Could not load container positions. Please refresh to try again.
              </p>
            ) : (
              <RouteMap
                containers={visible}
                showRoutes={showRoutes}
                className="h-[560px]"
                initialZoom={2}
              />
            )}
          </div>

          <aside className="surface overflow-hidden" aria-label="Containers on the map">
            <div className="border-b px-5 py-4">
              <h2 className="font-display text-base">On the map</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {visible.length} of {list.data?.length ?? 0} containers shown
              </p>
            </div>
            {list.isLoading ? (
              <div className="divide-y">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="space-y-2 px-5 py-3.5">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-3 w-40" />
                  </div>
                ))}
              </div>
            ) : !visible.length ? (
              <p className="px-5 py-10 text-center text-sm text-muted-foreground">
                No containers match the selected statuses.
              </p>
            ) : (
              <ul className="max-h-[480px] divide-y overflow-y-auto">
                {visible.map(row => (
                  <li key={row.id}>
                    <Link
                      href={`/containers/${row.containerNumber}`}
                      className="block px-5 py-3.5 transition-colors hover:bg-accent/40"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="code text-sm font-semibold">
                          {row.containerNumber}
                        </span>
                        <StatusBadge status={row.status as ContainerStatus} iconless />
                      </div>
                      <p className="mt-1.5 truncate text-xs text-muted-foreground">
                        {row.originCode} → {row.destinationCode} · ETA{" "}
                        {formatDate(row.eta)}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        </div>
      </div>
    </DashboardLayout>
  );
}
