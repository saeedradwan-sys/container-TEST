import DashboardLayout from "@/components/DashboardLayout";
import PageHeader from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import VoyageProgress from "@/components/VoyageProgress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, formatRelative } from "@/lib/format";
import { trpc } from "@/lib/trpc";
import type { ContainerStatus } from "@shared/tracking";
import { STATUS_LABELS, STATUS_ORDER } from "@shared/tracking";
import { ArrowRight, PackageSearch, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "wouter";

type SortKey = "eta" | "recent" | "container" | "progress";

const SORT_LABELS: Record<SortKey, string> = {
  eta: "ETA (soonest first)",
  recent: "Most recent event",
  container: "Container number",
  progress: "Voyage progress",
};

export default function Containers() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ContainerStatus | "all">("all");
  const [carrier, setCarrier] = useState<string>("all");
  const [sort, setSort] = useState<SortKey>("eta");

  const filters = trpc.tracking.filters.useQuery();

  // Query input is memoised so a stable reference avoids refetch loops.
  const queryInput = useMemo(
    () => ({
      search: search.trim() || undefined,
      statuses: status === "all" ? undefined : [status],
      carriers: carrier === "all" ? undefined : [carrier],
      sort,
      limit: 200,
    }),
    [search, status, carrier, sort],
  );

  const list = trpc.tracking.list.useQuery(queryInput);
  const hasFilters = search.trim() !== "" || status !== "all" || carrier !== "all";

  const resetFilters = () => {
    setSearch("");
    setStatus("all");
    setCarrier("all");
  };

  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-7xl space-y-6 px-1 py-4 sm:px-4 sm:py-6">
        <PageHeader
          eyebrow="Equipment register"
          title="Containers"
          description="Search by container, bill of lading, vessel, carrier or port, then filter down to the exceptions you care about."
        />

        {/* Filter bar */}
        <div className="surface flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search container, B/L, vessel, carrier or port…"
              className="h-10 pl-9"
              aria-label="Search containers"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Select value={status} onValueChange={v => setStatus(v as ContainerStatus | "all")}>
              <SelectTrigger className="h-10 w-[168px]" aria-label="Filter by status">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {STATUS_ORDER.map(value => (
                  <SelectItem key={value} value={value}>
                    {STATUS_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={carrier} onValueChange={setCarrier}>
              <SelectTrigger className="h-10 w-[176px]" aria-label="Filter by carrier">
                <SelectValue placeholder="All carriers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All carriers</SelectItem>
                {(filters.data?.carriers ?? []).map(name => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sort} onValueChange={v => setSort(v as SortKey)}>
              <SelectTrigger className="h-10 w-[208px]" aria-label="Sort containers">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(SORT_LABELS) as SortKey[]).map(key => (
                  <SelectItem key={key} value={key}>
                    {SORT_LABELS[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {hasFilters ? (
              <Button variant="ghost" onClick={resetFilters} className="h-10 px-3">
                <X className="mr-1.5 h-4 w-4" />
                Clear
              </Button>
            ) : null}
          </div>
        </div>

        {/* Result summary */}
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {list.isLoading
              ? "Loading containers…"
              : `${list.data?.length ?? 0} container${(list.data?.length ?? 0) === 1 ? "" : "s"}${
                  hasFilters ? " matching your filters" : ""
                }`}
          </p>
        </div>

        {/* Table */}
        <div className="surface overflow-hidden">
          {list.isLoading ? (
            <div className="divide-y">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-5 py-4">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </div>
          ) : list.isError ? (
            <div className="px-5 py-16 text-center">
              <p className="text-sm text-destructive">
                Could not load containers. Please refresh to try again.
              </p>
            </div>
          ) : !list.data?.length ? (
            <div className="flex flex-col items-center gap-3 px-5 py-16 text-center">
              <PackageSearch className="h-7 w-7 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">No containers found</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {hasFilters
                    ? "Try widening your search or clearing the filters."
                    : "Seed data has not been loaded yet."}
                </p>
              </div>
              {hasFilters ? (
                <Button variant="outline" className="bg-card" onClick={resetFilters}>
                  Clear filters
                </Button>
              ) : null}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[168px]">Container</TableHead>
                    <TableHead className="min-w-[220px]">Route</TableHead>
                    <TableHead className="min-w-[168px]">Carrier / Vessel</TableHead>
                    <TableHead className="w-[136px]">Status</TableHead>
                    <TableHead className="w-[152px] text-right">ETA</TableHead>
                    <TableHead className="w-[44px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.data.map(row => (
                    <TableRow key={row.id} className="group">
                      <TableCell className="align-top">
                        <Link
                          href={`/containers/${row.containerNumber}`}
                          className="code text-sm font-semibold hover:underline"
                        >
                          {row.containerNumber}
                        </Link>
                        <p className="mt-1 text-xs text-muted-foreground">{row.sizeType}</p>
                      </TableCell>

                      <TableCell className="align-top">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="code font-medium">{row.originCode}</span>
                          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="code font-medium">{row.destinationCode}</span>
                        </div>
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          {row.originCity} → {row.destinationCity}
                        </p>
                        <VoyageProgress
                          className="mt-2 max-w-[220px]"
                          showLabels={false}
                          origin={row.originCode}
                          destination={row.destinationCode}
                          percent={row.progressPercent}
                          status={row.status as ContainerStatus}
                        />
                      </TableCell>

                      <TableCell className="align-top">
                        <p className="text-sm font-medium">{row.carrier}</p>
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          {row.vesselName}
                          {row.voyageNumber ? ` · ${row.voyageNumber}` : ""}
                        </p>
                      </TableCell>

                      <TableCell className="align-top">
                        <StatusBadge status={row.status as ContainerStatus} />
                      </TableCell>

                      <TableCell className="align-top text-right">
                        <p className="tabular text-sm">{formatDate(row.eta)}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatRelative(row.eta)}
                        </p>
                      </TableCell>

                      <TableCell className="align-top text-right">
                        <Link
                          href={`/containers/${row.containerNumber}`}
                          aria-label={`View ${row.containerNumber}`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                        >
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
