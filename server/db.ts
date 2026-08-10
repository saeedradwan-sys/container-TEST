import { and, asc, desc, eq, inArray, like, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/mysql-core";
import { drizzle } from "drizzle-orm/mysql2";
import {
  containers,
  ContainerStatus,
  InsertContainer,
  InsertShipment,
  InsertUser,
  milestones,
  ports,
  shipments,
  users,
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

/**
 * Thrown when a query helper is called but no database connection is available.
 * Procedures surface this as an internal error rather than silently returning
 * empty data, which would look like "no shipments" to the user.
 */
export class DatabaseUnavailableError extends Error {
  constructor() {
    super("Database is not available");
    this.name = "DatabaseUnavailableError";
  }
}

async function requireDb() {
  const db = await getDb();
  if (!db) throw new DatabaseUnavailableError();
  return db;
}

// `ports` is joined twice per query (origin and destination), so each side
// needs its own alias.
const originPorts = alias(ports, "originPort");
const destinationPorts = alias(ports, "destinationPort");

export type ContainerSort = "eta" | "recent" | "container" | "progress";

export type ListContainersInput = {
  search?: string;
  statuses?: ContainerStatus[];
  carriers?: string[];
  sort?: ContainerSort;
  limit?: number;
  offset?: number;
};

/** Column selection shared by the list and detail queries. */
const containerSelection = {
  id: containers.id,
  containerNumber: containers.containerNumber,
  isoType: containers.isoType,
  sizeType: containers.sizeType,
  status: containers.status,
  sealNumber: containers.sealNumber,
  grossWeightKg: containers.grossWeightKg,
  currentLatitude: containers.currentLatitude,
  currentLongitude: containers.currentLongitude,
  currentLocation: containers.currentLocation,
  eta: containers.eta,
  progressPercent: containers.progressPercent,
  lastEventAt: containers.lastEventAt,
  notes: containers.notes,
  shipmentId: shipments.id,
  bookingRef: shipments.bookingRef,
  billOfLading: shipments.billOfLading,
  carrier: shipments.carrier,
  carrierScac: shipments.carrierScac,
  vesselName: shipments.vesselName,
  vesselImo: shipments.vesselImo,
  voyageNumber: shipments.voyageNumber,
  shipper: shipments.shipper,
  consignee: shipments.consignee,
  commodity: shipments.commodity,
  etd: shipments.etd,
  atd: shipments.atd,
  shipmentEta: shipments.eta,
  ata: shipments.ata,
  originPortId: originPorts.id,
  originCode: originPorts.code,
  originName: originPorts.name,
  originCity: originPorts.city,
  originCountry: originPorts.country,
  originCountryCode: originPorts.countryCode,
  originLatitude: originPorts.latitude,
  originLongitude: originPorts.longitude,
  destinationPortId: destinationPorts.id,
  destinationCode: destinationPorts.code,
  destinationName: destinationPorts.name,
  destinationCity: destinationPorts.city,
  destinationCountry: destinationPorts.country,
  destinationCountryCode: destinationPorts.countryCode,
  destinationLatitude: destinationPorts.latitude,
  destinationLongitude: destinationPorts.longitude,
} as const;

function baseContainerQuery(db: NonNullable<Awaited<ReturnType<typeof getDb>>>) {
  return db
    .select(containerSelection)
    .from(containers)
    .innerJoin(shipments, eq(shipments.id, containers.shipmentId))
    .innerJoin(originPorts, eq(originPorts.id, shipments.originPortId))
    .innerJoin(destinationPorts, eq(destinationPorts.id, shipments.destinationPortId));
}

/** Lists containers with free-text search, status/carrier filters and sorting. */
export async function listContainers(input: ListContainersInput = {}) {
  const db = await requireDb();
  const { search, statuses, carriers, sort = "eta", limit = 100, offset = 0 } = input;

  const conditions = [];
  const term = search?.trim();
  if (term) {
    const pattern = `%${term}%`;
    conditions.push(
      or(
        like(containers.containerNumber, pattern),
        like(shipments.billOfLading, pattern),
        like(shipments.bookingRef, pattern),
        like(shipments.vesselName, pattern),
        like(shipments.carrier, pattern),
        like(shipments.consignee, pattern),
        like(originPorts.code, pattern),
        like(originPorts.city, pattern),
        like(destinationPorts.code, pattern),
        like(destinationPorts.city, pattern),
      ),
    );
  }
  if (statuses?.length) {
    conditions.push(inArray(containers.status, statuses));
  }
  if (carriers?.length) {
    conditions.push(inArray(shipments.carrier, carriers));
  }

  const orderBy =
    sort === "container"
      ? [asc(containers.containerNumber)]
      : sort === "recent"
        ? [desc(containers.lastEventAt)]
        : sort === "progress"
          ? [desc(containers.progressPercent)]
          : [asc(containers.eta)];

  let query = baseContainerQuery(db);
  if (conditions.length) {
    query = query.where(and(...conditions)) as typeof query;
  }

  return query.orderBy(...orderBy).limit(limit).offset(offset);
}

/** Fetches a single container with its shipment and port context. */
export async function getContainerById(id: number) {
  const db = await requireDb();
  const rows = await baseContainerQuery(db).where(eq(containers.id, id)).limit(1);
  return rows[0];
}

/** Fetches a single container by its ISO 6346 number. */
export async function getContainerByNumber(containerNumber: string) {
  const db = await requireDb();
  const rows = await baseContainerQuery(db)
    .where(eq(containers.containerNumber, containerNumber))
    .limit(1);
  return rows[0];
}

/** Returns the full chronological milestone history for a container. */
export async function getMilestonesForContainer(containerId: number) {
  const db = await requireDb();
  return db
    .select({
      id: milestones.id,
      eventCode: milestones.eventCode,
      eventLabel: milestones.eventLabel,
      description: milestones.description,
      locationName: milestones.locationName,
      vesselName: milestones.vesselName,
      status: milestones.status,
      isActual: milestones.isActual,
      eventAt: milestones.eventAt,
      portCode: ports.code,
      portCity: ports.city,
      portLatitude: ports.latitude,
      portLongitude: ports.longitude,
    })
    .from(milestones)
    .leftJoin(ports, eq(ports.id, milestones.portId))
    .where(eq(milestones.containerId, containerId))
    .orderBy(asc(milestones.eventAt), asc(milestones.id));
}

/** Aggregated counts backing the dashboard summary cards. */
export async function getContainerStats() {
  const db = await requireDb();
  const rows = await db
    .select({ status: containers.status, count: sql<number>`count(*)` })
    .from(containers)
    .groupBy(containers.status);

  const byStatus: Record<ContainerStatus, number> = {
    in_transit: 0,
    at_port: 0,
    customs_hold: 0,
    delivered: 0,
    delayed: 0,
  };
  let total = 0;
  for (const row of rows) {
    const count = Number(row.count) || 0;
    byStatus[row.status as ContainerStatus] = count;
    total += count;
  }
  return { total, ...byStatus };
}

/** Distinct carrier names, used to populate the list filter. */
export async function listCarriers() {
  const db = await requireDb();
  const rows = await db
    .selectDistinct({ carrier: shipments.carrier })
    .from(shipments)
    .orderBy(asc(shipments.carrier));
  return rows.map(r => r.carrier);
}

/** All ports, used by filters and record forms. */
export async function listPorts() {
  const db = await requireDb();
  return db.select().from(ports).orderBy(asc(ports.code));
}

/** Lightweight shipment list for record forms. */
export async function listShipments() {
  const db = await requireDb();
  return db
    .select({
      id: shipments.id,
      bookingRef: shipments.bookingRef,
      billOfLading: shipments.billOfLading,
      carrier: shipments.carrier,
      vesselName: shipments.vesselName,
      originPortId: shipments.originPortId,
      destinationPortId: shipments.destinationPortId,
    })
    .from(shipments)
    .orderBy(asc(shipments.bookingRef));
}

/** Existence checks used to keep mutations referentially sound. */
export async function shipmentExists(id: number) {
  const db = await requireDb();
  const rows = await db.select({ id: shipments.id }).from(shipments).where(eq(shipments.id, id)).limit(1);
  return rows.length > 0;
}

export async function portExists(id: number) {
  const db = await requireDb();
  const rows = await db.select({ id: ports.id }).from(ports).where(eq(ports.id, id)).limit(1);
  return rows.length > 0;
}

export async function containerExists(id: number) {
  const db = await requireDb();
  const rows = await db.select({ id: containers.id }).from(containers).where(eq(containers.id, id)).limit(1);
  return rows.length > 0;
}

/** Finds a shipment by booking reference, used for duplicate detection. */
export async function getShipmentByBookingRef(bookingRef: string) {
  const db = await requireDb();
  const rows = await db
    .select({ id: shipments.id })
    .from(shipments)
    .where(eq(shipments.bookingRef, bookingRef))
    .limit(1);
  return rows[0];
}

export async function createContainer(values: InsertContainer) {
  const db = await requireDb();
  const [result] = await db.insert(containers).values(values);
  return Number((result as { insertId: number }).insertId);
}

export async function updateContainer(id: number, values: Partial<InsertContainer>) {
  const db = await requireDb();
  await db.update(containers).set(values).where(eq(containers.id, id));
  return id;
}

export async function createShipment(values: InsertShipment) {
  const db = await requireDb();
  const [result] = await db.insert(shipments).values(values);
  return Number((result as { insertId: number }).insertId);
}

export async function updateShipment(id: number, values: Partial<InsertShipment>) {
  const db = await requireDb();
  await db.update(shipments).set(values).where(eq(shipments.id, id));
  return id;
}

/** Records a tracking event and syncs the container's denormalised status. */
export async function createMilestone(values: {
  containerId: number;
  portId?: number | null;
  eventCode: string;
  eventLabel: string;
  description?: string | null;
  locationName?: string | null;
  vesselName?: string | null;
  status?: ContainerStatus | null;
  isActual?: number;
  eventAt: Date;
}) {
  const db = await requireDb();
  const [result] = await db.insert(milestones).values(values);
  if (values.status && (values.isActual ?? 1) === 1) {
    await db
      .update(containers)
      .set({ status: values.status, lastEventAt: values.eventAt })
      .where(eq(containers.id, values.containerId));
  }
  return Number((result as { insertId: number }).insertId);
}
