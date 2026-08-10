import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { CONTAINER_STATUSES } from "../../drizzle/schema";
import * as db from "../db";
import { protectedProcedure, router } from "../_core/trpc";

const statusSchema = z.enum(CONTAINER_STATUSES);

const listInput = z.object({
  search: z.string().max(120).optional(),
  statuses: z.array(statusSchema).optional(),
  carriers: z.array(z.string().max(96)).optional(),
  sort: z.enum(["eta", "recent", "container", "progress"]).optional(),
  limit: z.number().int().min(1).max(200).optional(),
  offset: z.number().int().min(0).optional(),
});

const containerUpsertInput = z.object({
  id: z.number().int().positive().optional(),
  containerNumber: z
    .string()
    .trim()
    .min(4)
    .max(16)
    .regex(/^[A-Za-z0-9]+$/, "Container number must be alphanumeric"),
  shipmentId: z.number().int().positive(),
  isoType: z.string().trim().min(2).max(8),
  sizeType: z.string().trim().min(2).max(48),
  status: statusSchema,
  sealNumber: z.string().trim().max(24).optional().nullable(),
  grossWeightKg: z.number().int().min(0).max(100000).optional().nullable(),
  currentLatitude: z.number().min(-90).max(90).optional().nullable(),
  currentLongitude: z.number().min(-180).max(180).optional().nullable(),
  currentLocation: z.string().trim().max(160).optional().nullable(),
  eta: z.date().optional().nullable(),
  progressPercent: z.number().int().min(0).max(100),
  notes: z.string().trim().max(2000).optional().nullable(),
});

const shipmentUpsertInput = z.object({
  id: z.number().int().positive().optional(),
  bookingRef: z.string().trim().min(3).max(32),
  billOfLading: z.string().trim().min(3).max(32),
  carrier: z.string().trim().min(2).max(96),
  carrierScac: z.string().trim().max(8).optional().nullable(),
  vesselName: z.string().trim().min(2).max(128),
  vesselImo: z.string().trim().max(16).optional().nullable(),
  voyageNumber: z.string().trim().max(24).optional().nullable(),
  originPortId: z.number().int().positive(),
  destinationPortId: z.number().int().positive(),
  shipper: z.string().trim().max(160).optional().nullable(),
  consignee: z.string().trim().max(160).optional().nullable(),
  commodity: z.string().trim().max(160).optional().nullable(),
  etd: z.date().optional().nullable(),
  atd: z.date().optional().nullable(),
  eta: z.date().optional().nullable(),
  ata: z.date().optional().nullable(),
});

const milestoneInput = z.object({
  containerId: z.number().int().positive(),
  portId: z.number().int().positive().optional().nullable(),
  eventCode: z.string().trim().min(2).max(16),
  eventLabel: z.string().trim().min(2).max(128),
  description: z.string().trim().max(255).optional().nullable(),
  locationName: z.string().trim().max(160).optional().nullable(),
  vesselName: z.string().trim().max(128).optional().nullable(),
  status: statusSchema.optional().nullable(),
  isActual: z.boolean().optional(),
  eventAt: z.date(),
});

/** Maps decimal string columns to numbers so the client can use them directly. */
function num(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

type RawContainerRow = Awaited<ReturnType<typeof db.getContainerById>>;

function serializeContainer(row: NonNullable<RawContainerRow>) {
  return {
    ...row,
    currentLatitude: num(row.currentLatitude),
    currentLongitude: num(row.currentLongitude),
    originLatitude: num(row.originLatitude),
    originLongitude: num(row.originLongitude),
    destinationLatitude: num(row.destinationLatitude),
    destinationLongitude: num(row.destinationLongitude),
  };
}

/**
 * The schema intentionally omits foreign keys (TiDB/serverless friendliness),
 * so every mutation validates its references explicitly before writing.
 */
async function assertShipmentExists(shipmentId: number) {
  if (!(await db.shipmentExists(shipmentId))) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Shipment ${shipmentId} does not exist`,
    });
  }
}

async function assertPortExists(portId: number, field: string) {
  if (!(await db.portExists(portId))) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `${field} ${portId} does not exist`,
    });
  }
}

export const trackingRouter = router({
  /** Searchable, filterable container list for the table view. */
  list: protectedProcedure.input(listInput.optional()).query(async ({ input }) => {
    const rows = await db.listContainers(input ?? {});
    return rows.map(serializeContainer);
  }),

  /** Container detail plus the complete milestone timeline. */
  detail: protectedProcedure
    .input(
      z.union([
        z.object({ id: z.number().int().positive() }),
        z.object({ containerNumber: z.string().trim().min(4).max(16) }),
      ]),
    )
    .query(async ({ input }) => {
      const row =
        "id" in input
          ? await db.getContainerById(input.id)
          : await db.getContainerByNumber(input.containerNumber);

      if (!row) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Container not found" });
      }

      const timeline = await db.getMilestonesForContainer(row.id);
      return {
        container: serializeContainer(row),
        timeline: timeline.map(event => ({
          ...event,
          isActual: event.isActual === 1,
          portLatitude: num(event.portLatitude),
          portLongitude: num(event.portLongitude),
        })),
      };
    }),

  /** Counts backing the dashboard summary cards. */
  stats: protectedProcedure.query(() => db.getContainerStats()),

  /** Filter option lists. */
  filters: protectedProcedure.query(async () => {
    const [carriers, ports] = await Promise.all([db.listCarriers(), db.listPorts()]);
    return {
      carriers,
      ports: ports.map(port => ({
        ...port,
        latitude: num(port.latitude),
        longitude: num(port.longitude),
      })),
    };
  }),

  /** Shipment options for the container form. */
  shipments: protectedProcedure.query(() => db.listShipments()),

  /** Creates a container when `id` is absent, otherwise updates it. */
  upsertContainer: protectedProcedure
    .input(containerUpsertInput)
    .mutation(async ({ input }) => {
      const { id, ...rest } = input;
      await assertShipmentExists(rest.shipmentId);

      const values = {
        ...rest,
        containerNumber: rest.containerNumber.toUpperCase(),
        currentLatitude: rest.currentLatitude?.toString() ?? null,
        currentLongitude: rest.currentLongitude?.toString() ?? null,
      };

      if (id) {
        if (!(await db.containerExists(id))) {
          throw new TRPCError({ code: "NOT_FOUND", message: `Container ${id} does not exist` });
        }
        const duplicate = await db.getContainerByNumber(values.containerNumber);
        if (duplicate && duplicate.id !== id) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `Container ${values.containerNumber} already exists`,
          });
        }
        await db.updateContainer(id, values);
        return { id, created: false as const };
      }

      const existing = await db.getContainerByNumber(values.containerNumber);
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Container ${values.containerNumber} already exists`,
        });
      }
      const newId = await db.createContainer(values);
      return { id: newId, created: true as const };
    }),

  /** Creates a shipment when `id` is absent, otherwise updates it. */
  upsertShipment: protectedProcedure
    .input(shipmentUpsertInput)
    .mutation(async ({ input }) => {
      const { id, ...values } = input;
      await assertPortExists(values.originPortId, "Origin port");
      await assertPortExists(values.destinationPortId, "Destination port");
      if (values.originPortId === values.destinationPortId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Origin and destination ports must differ",
        });
      }

      const duplicate = await db.getShipmentByBookingRef(values.bookingRef);
      if (id) {
        if (!(await db.shipmentExists(id))) {
          throw new TRPCError({ code: "NOT_FOUND", message: `Shipment ${id} does not exist` });
        }
        if (duplicate && duplicate.id !== id) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `Booking reference ${values.bookingRef} is already in use`,
          });
        }
        await db.updateShipment(id, values);
        return { id, created: false as const };
      }
      if (duplicate) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Booking reference ${values.bookingRef} is already in use`,
        });
      }
      const newId = await db.createShipment(values);
      return { id: newId, created: true as const };
    }),

  /** Appends a tracking event, updating the container status when actual. */
  addMilestone: protectedProcedure.input(milestoneInput).mutation(async ({ input }) => {
    const { isActual, ...rest } = input;
    if (!(await db.containerExists(rest.containerId))) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Container ${rest.containerId} does not exist`,
      });
    }
    if (rest.portId) {
      await assertPortExists(rest.portId, "Port");
    }
    const newId = await db.createMilestone({
      ...rest,
      isActual: isActual === false ? 0 : 1,
    });
    return { id: newId };
  }),
});
