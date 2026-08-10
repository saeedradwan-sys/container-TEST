import {
  decimal,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Container lifecycle statuses. Labels shown in the UI must match exactly:
 * In Transit, At Port, Customs Hold, Delivered, Delayed.
 */
export const CONTAINER_STATUSES = [
  "in_transit",
  "at_port",
  "customs_hold",
  "delivered",
  "delayed",
] as const;

export type ContainerStatus = (typeof CONTAINER_STATUSES)[number];

/** Seaports referenced as shipment endpoints and milestone locations. */
export const ports = mysqlTable("ports", {
  id: int("id").autoincrement().primaryKey(),
  /** UN/LOCODE, e.g. "CNSHA" for Shanghai. */
  code: varchar("code", { length: 8 }).notNull().unique(),
  name: varchar("name", { length: 128 }).notNull(),
  city: varchar("city", { length: 128 }).notNull(),
  country: varchar("country", { length: 96 }).notNull(),
  countryCode: varchar("countryCode", { length: 2 }).notNull(),
  latitude: decimal("latitude", { precision: 9, scale: 6 }).notNull(),
  longitude: decimal("longitude", { precision: 9, scale: 6 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/** A booking moving one or more containers from an origin port to a destination port. */
export const shipments = mysqlTable(
  "shipments",
  {
    id: int("id").autoincrement().primaryKey(),
    /** Carrier booking reference. */
    bookingRef: varchar("bookingRef", { length: 32 }).notNull().unique(),
    /** Bill of lading number. */
    billOfLading: varchar("billOfLading", { length: 32 }).notNull(),
    carrier: varchar("carrier", { length: 96 }).notNull(),
    carrierScac: varchar("carrierScac", { length: 8 }),
    vesselName: varchar("vesselName", { length: 128 }).notNull(),
    vesselImo: varchar("vesselImo", { length: 16 }),
    voyageNumber: varchar("voyageNumber", { length: 24 }),
    originPortId: int("originPortId").notNull(),
    destinationPortId: int("destinationPortId").notNull(),
    shipper: varchar("shipper", { length: 160 }),
    consignee: varchar("consignee", { length: 160 }),
    commodity: varchar("commodity", { length: 160 }),
    /** Estimated time of departure from the origin port. */
    etd: timestamp("etd"),
    /** Actual time of departure, set once the vessel sails. */
    atd: timestamp("atd"),
    /** Estimated time of arrival at the destination port. */
    eta: timestamp("eta"),
    /** Actual time of arrival, set once the vessel berths. */
    ata: timestamp("ata"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    originIdx: index("shipments_origin_idx").on(table.originPortId),
    destinationIdx: index("shipments_destination_idx").on(table.destinationPortId),
  }),
);

/** An individual physical container tracked against a shipment. */
export const containers = mysqlTable(
  "containers",
  {
    id: int("id").autoincrement().primaryKey(),
    /** ISO 6346 container number, e.g. "MSCU1234567". */
    containerNumber: varchar("containerNumber", { length: 16 }).notNull().unique(),
    shipmentId: int("shipmentId").notNull(),
    /** ISO size/type code, e.g. "45G1" for a 40ft high-cube dry container. */
    isoType: varchar("isoType", { length: 8 }).notNull(),
    /** Human readable equipment size, e.g. "40ft High Cube". */
    sizeType: varchar("sizeType", { length: 48 }).notNull(),
    status: mysqlEnum("status", CONTAINER_STATUSES).default("in_transit").notNull(),
    sealNumber: varchar("sealNumber", { length: 24 }),
    /** Gross weight in kilograms. */
    grossWeightKg: int("grossWeightKg"),
    /** Last reported position, used by the map view. */
    currentLatitude: decimal("currentLatitude", { precision: 9, scale: 6 }),
    currentLongitude: decimal("currentLongitude", { precision: 9, scale: 6 }),
    /** Free-text description of the last reported position. */
    currentLocation: varchar("currentLocation", { length: 160 }),
    /** Container-level ETA, which can drift from the shipment ETA. */
    eta: timestamp("eta"),
    /** Journey completion percentage, 0-100. */
    progressPercent: int("progressPercent").default(0).notNull(),
    lastEventAt: timestamp("lastEventAt"),
    notes: text("notes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    shipmentIdx: index("containers_shipment_idx").on(table.shipmentId),
    statusIdx: index("containers_status_idx").on(table.status),
  }),
);

/** Chronological tracking events forming the status history of a container. */
export const milestones = mysqlTable(
  "milestones",
  {
    id: int("id").autoincrement().primaryKey(),
    containerId: int("containerId").notNull(),
    portId: int("portId"),
    /** Carrier event code, e.g. "GTOU", "VDEP", "VARR", "CUSH". */
    eventCode: varchar("eventCode", { length: 16 }).notNull(),
    /** Display label, e.g. "Vessel departed". */
    eventLabel: varchar("eventLabel", { length: 128 }).notNull(),
    description: varchar("description", { length: 255 }),
    locationName: varchar("locationName", { length: 160 }),
    vesselName: varchar("vesselName", { length: 128 }),
    /** Status the container entered as a result of this event. */
    status: mysqlEnum("status", CONTAINER_STATUSES),
    /** False when the event is still a forecast rather than a confirmed actual. */
    isActual: int("isActual").default(1).notNull(),
    eventAt: timestamp("eventAt").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    containerIdx: index("milestones_container_idx").on(table.containerId),
    eventAtIdx: index("milestones_event_at_idx").on(table.eventAt),
  }),
);

export type Port = typeof ports.$inferSelect;
export type InsertPort = typeof ports.$inferInsert;
export type Shipment = typeof shipments.$inferSelect;
export type InsertShipment = typeof shipments.$inferInsert;
export type Container = typeof containers.$inferSelect;
export type InsertContainer = typeof containers.$inferInsert;
export type Milestone = typeof milestones.$inferSelect;
export type InsertMilestone = typeof milestones.$inferInsert;
