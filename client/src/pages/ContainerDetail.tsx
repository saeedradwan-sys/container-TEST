import DashboardLayout from "@/components/DashboardLayout";
import RouteMap from "@/components/RouteMap";
import { StatusBadge, STATUS_STYLES } from "@/components/StatusBadge";
import VoyageProgress from "@/components/VoyageProgress";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  formatCoordinates,
  formatDate,
  formatDateTime,
  formatRelative,
  formatWeight,
} from "@/lib/format";
import { trpc } from "@/lib/trpc";
import type { ContainerStatus } from "@shared/tracking";
import { STATUS_LABELS } from "@shared/tracking";
import {
  ArrowLeft,
  ArrowRight,
  CircleDashed,
  MapPin,
  Route,
  Ship,
} from "lucide-react";
import { Link, useParams } from "wouter";

/** Two-column definition row used throughout the info panels. */
function Field({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 border-b border-dashed py-2.5 last:border-b-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
      <dt className="text-xs uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </dt>
      <dd className={`text-sm sm:text-right ${mono ? "code" : ""}`}>{value ?? "—"}</dd>
    </div>
  );
}

export default function ContainerDetail() {
  const params = useParams<{ containerNumber: string }>();
  const containerNumber = (params.containerNumber ?? "").toUpperCase();

  const detail = trpc.tracking.detail.useQuery(
    { containerNumber },
    { enabled: containerNumber.length > 3 },
  );

  const container = detail.data?.container;
  const timeline = detail.data?.timeline ?? [];
  const status = (container?.status ?? "in_transit") as ContainerStatus;

  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-6xl space-y-6 px-1 py-4 sm:px-4 sm:py-6">
        <Button asChild variant="ghost" className="-ml-2 h-9 w-fit px-2">
          <Link href="/containers">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            All containers
          </Link>
        </Button>

        {detail.isLoading ? (
          <div className="space-y-6">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : detail.isError ? (
          <div className="surface px-6 py-16 text-center">
            <p className="font-display text-lg">Container not found</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              We could not find a container matching{" "}
              <span className="code">{containerNumber}</span>. It may have been removed, or
              the reference may be mistyped.
            </p>
            <Button asChild className="mt-6">
              <Link href="/containers">Back to containers</Link>
            </Button>
          </div>
        ) : container ? (
          <>
            {/* Masthead */}
            <header className="surface rise overflow-hidden">
              <div className="flex flex-col gap-5 p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      {container.sizeType} · {container.isoType}
                    </p>
                    <h1 className="code mt-1.5 text-2xl font-semibold tracking-tight sm:text-[1.75rem]">
                      {container.containerNumber}
                    </h1>
                    <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" />
                      {container.currentLocation ?? "Position pending"}
                    </p>
                  </div>
                  <div className="flex flex-col items-start gap-2 sm:items-end">
                    <StatusBadge status={status} size="md" />
                    <p className="tabular text-sm">
                      ETA{" "}
                      <span className="font-medium">{formatDate(container.eta)}</span>{" "}
                      <span className="text-muted-foreground">
                        ({formatRelative(container.eta)})
                      </span>
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
                  <span className="code font-medium">{container.originCode}</span>
                  <span className="text-muted-foreground">{container.originCity}</span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <span className="code font-medium">{container.destinationCode}</span>
                  <span className="text-muted-foreground">
                    {container.destinationCity}
                  </span>
                </div>

                <VoyageProgress
                  origin={container.originCode}
                  destination={container.destinationCode}
                  percent={container.progressPercent}
                  status={status}
                />

                {container.notes ? (
                  <p
                    className="rounded-md px-3.5 py-3 text-sm leading-relaxed"
                    style={{
                      backgroundColor: STATUS_STYLES[status].background,
                      color: STATUS_STYLES[status].color,
                    }}
                  >
                    {container.notes}
                  </p>
                ) : null}
              </div>
            </header>

            <div className="grid gap-6 lg:grid-cols-[1fr_1.05fr]">
              {/* Shipment information */}
              <section className="surface p-5 sm:p-6" aria-label="Shipment information">
                <div className="flex items-center gap-2">
                  <Ship className="h-4 w-4 text-muted-foreground" />
                  <h2 className="font-display text-base">Shipment information</h2>
                </div>
                <dl className="mt-4">
                  <Field label="Vessel" value={container.vesselName} />
                  <Field label="IMO number" value={container.vesselImo} mono />
                  <Field label="Voyage" value={container.voyageNumber} mono />
                  <Field label="Carrier" value={container.carrier} />
                  <Field label="SCAC" value={container.carrierScac} mono />
                  <Field label="Bill of lading" value={container.billOfLading} mono />
                  <Field label="Booking reference" value={container.bookingRef} mono />
                  <Field
                    label="Port of loading"
                    value={`${container.originName} (${container.originCode})`}
                  />
                  <Field
                    label="Port of discharge"
                    value={`${container.destinationName} (${container.destinationCode})`}
                  />
                  <Field label="Shipper" value={container.shipper} />
                  <Field label="Consignee" value={container.consignee} />
                  <Field label="Commodity" value={container.commodity} />
                  <Field label="Seal number" value={container.sealNumber} mono />
                  <Field
                    label="Gross weight"
                    value={formatWeight(container.grossWeightKg)}
                  />
                  <Field label="Departed" value={formatDate(container.atd)} />
                  <Field
                    label="Last position"
                    value={formatCoordinates(
                      container.currentLatitude,
                      container.currentLongitude,
                    )}
                    mono
                  />
                </dl>
              </section>

              {/* Timeline and map */}
              <section aria-label="Milestones and route">
                <Tabs defaultValue="timeline">
                  <TabsList className="w-full">
                    <TabsTrigger value="timeline" className="flex-1">
                      Milestones
                    </TabsTrigger>
                    <TabsTrigger value="map" className="flex-1">
                      Route map
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="timeline" className="mt-4">
                    <div className="surface p-5 sm:p-6">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <Route className="h-4 w-4 text-muted-foreground" />
                          <h3 className="font-display text-base">Event timeline</h3>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {timeline.filter(e => e.isActual).length} of {timeline.length}{" "}
                          confirmed
                        </p>
                      </div>

                      {!timeline.length ? (
                        <p className="py-10 text-center text-sm text-muted-foreground">
                          No tracking events have been recorded yet.
                        </p>
                      ) : (
                        <ol className="mt-5 space-y-0">
                          {timeline.map((event, index) => {
                            const eventStatus = (event.status ??
                              "in_transit") as ContainerStatus;
                            const accent = event.isActual
                              ? STATUS_STYLES[eventStatus].color
                              : "var(--muted-foreground)";
                            const isLast = index === timeline.length - 1;

                            return (
                              <li key={event.id} className="relative flex gap-4 pb-6 last:pb-0">
                                {!isLast ? (
                                  <span
                                    aria-hidden
                                    className="absolute left-[7px] top-5 bottom-0 w-px"
                                    style={{
                                      backgroundColor: event.isActual
                                        ? "var(--border)"
                                        : "transparent",
                                      borderLeft: event.isActual
                                        ? undefined
                                        : "1px dashed var(--border)",
                                    }}
                                  />
                                ) : null}

                                <span className="relative z-10 mt-1 flex h-[15px] w-[15px] shrink-0 items-center justify-center">
                                  {event.isActual ? (
                                    <span
                                      className="h-[11px] w-[11px] rounded-full ring-4 ring-card"
                                      style={{ backgroundColor: accent }}
                                    />
                                  ) : (
                                    <CircleDashed
                                      className="h-[15px] w-[15px]"
                                      style={{ color: accent }}
                                    />
                                  )}
                                </span>

                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                                    <p
                                      className={`text-sm font-medium ${
                                        event.isActual ? "" : "text-muted-foreground"
                                      }`}
                                    >
                                      {event.eventLabel}
                                      {!event.isActual ? (
                                        <span className="ml-2 rounded border px-1.5 py-0.5 text-[0.65rem] font-normal uppercase tracking-wider text-muted-foreground">
                                          Estimated
                                        </span>
                                      ) : null}
                                    </p>
                                    <time className="tabular shrink-0 text-xs text-muted-foreground">
                                      {formatDateTime(event.eventAt)}
                                    </time>
                                  </div>
                                  {event.description ? (
                                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                                      {event.description}
                                    </p>
                                  ) : null}
                                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                    {event.locationName ? (
                                      <span className="inline-flex items-center gap-1">
                                        <MapPin className="h-3 w-3" />
                                        {event.locationName}
                                      </span>
                                    ) : null}
                                    <span className="code">{event.eventCode}</span>
                                    {event.status ? (
                                      <span>→ {STATUS_LABELS[eventStatus]}</span>
                                    ) : null}
                                  </div>
                                </div>
                              </li>
                            );
                          })}
                        </ol>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="map" className="mt-4">
                    <div className="surface overflow-hidden">
                      <RouteMap
                        containers={[container]}
                        className="h-[520px]"
                        initialZoom={4}
                      />
                      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t px-5 py-3 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: STATUS_STYLES[status].marker }}
                          />
                          Current position
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <span className="h-px w-5" style={{ backgroundColor: STATUS_STYLES[status].marker }} />
                          Completed leg
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <span
                            className="h-px w-5"
                            style={{
                              backgroundImage: `repeating-linear-gradient(to right, ${STATUS_STYLES[status].marker} 0 4px, transparent 4px 8px)`,
                              height: "2px",
                            }}
                          />
                          Remaining leg
                        </span>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </section>
            </div>
          </>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
