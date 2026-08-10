/**
 * Seeds realistic ocean freight demo data: ports, shipments, containers and
 * milestone history. Safe to re-run — it clears the tracking tables first.
 *
 * Usage: node scripts/seed.mjs
 */
import "dotenv/config";
import mysql from "mysql2/promise";

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
const now = Date.now();

/** Formats a JS timestamp into a MySQL DATETIME string in UTC. */
function sql(ts) {
  return new Date(ts).toISOString().slice(0, 19).replace("T", " ");
}

const PORTS = [
  ["CNSHA", "Port of Shanghai", "Shanghai", "China", "CN", 31.2304, 121.4737],
  ["CNNGB", "Port of Ningbo-Zhoushan", "Ningbo", "China", "CN", 29.8683, 121.544],
  ["CNYTN", "Port of Yantian", "Shenzhen", "China", "CN", 22.5852, 114.2645],
  ["SGSIN", "Port of Singapore", "Singapore", "Singapore", "SG", 1.2644, 103.84],
  ["MYTPP", "Port of Tanjung Pelepas", "Johor", "Malaysia", "MY", 1.3644, 103.5486],
  ["KRPUS", "Port of Busan", "Busan", "South Korea", "KR", 35.1028, 129.0403],
  ["AEJEA", "Jebel Ali Port", "Dubai", "United Arab Emirates", "AE", 25.0107, 55.0611],
  ["EGSUZ", "Port of Suez", "Suez", "Egypt", "EG", 29.9668, 32.5498],
  ["NLRTM", "Port of Rotterdam", "Rotterdam", "Netherlands", "NL", 51.9494, 4.1425],
  ["DEHAM", "Port of Hamburg", "Hamburg", "Germany", "DE", 53.5417, 9.9243],
  ["BEANR", "Port of Antwerp-Bruges", "Antwerp", "Belgium", "BE", 51.2669, 4.3997],
  ["GBFXT", "Port of Felixstowe", "Felixstowe", "United Kingdom", "GB", 51.9542, 1.3089],
  ["ESVLC", "Port of Valencia", "Valencia", "Spain", "ES", 39.4429, -0.3157],
  ["USLAX", "Port of Los Angeles", "Los Angeles", "United States", "US", 33.7292, -118.2620],
  ["USLGB", "Port of Long Beach", "Long Beach", "United States", "US", 33.7542, -118.2165],
  ["USNYC", "Port of New York and New Jersey", "Newark", "United States", "US", 40.6892, -74.1745],
  ["USSAV", "Port of Savannah", "Savannah", "United States", "US", 32.1313, -81.1443],
  ["BRSSZ", "Port of Santos", "Santos", "Brazil", "BR", -23.9535, -46.3283],
  ["ZADUR", "Port of Durban", "Durban", "South Africa", "ZA", -29.8687, 31.0218],
  ["AUSYD", "Port Botany", "Sydney", "Australia", "AU", -33.9694, 151.2225],
];

/**
 * Great-circle interpolation so an in-transit container sits on a plausible
 * position along its ocean leg rather than on a naive straight line.
 */
function interpolate(from, to, fraction) {
  const toRad = d => (d * Math.PI) / 180;
  const toDeg = r => (r * 180) / Math.PI;
  const [lat1, lon1] = [toRad(from[0]), toRad(from[1])];
  const [lat2, lon2] = [toRad(to[0]), toRad(to[1])];
  const d =
    2 *
    Math.asin(
      Math.sqrt(
        Math.sin((lat2 - lat1) / 2) ** 2 +
          Math.cos(lat1) * Math.cos(lat2) * Math.sin((lon2 - lon1) / 2) ** 2,
      ),
    );
  if (d === 0) return [from[0], from[1]];
  const a = Math.sin((1 - fraction) * d) / Math.sin(d);
  const b = Math.sin(fraction * d) / Math.sin(d);
  const x = a * Math.cos(lat1) * Math.cos(lon1) + b * Math.cos(lat2) * Math.cos(lon2);
  const y = a * Math.cos(lat1) * Math.sin(lon1) + b * Math.cos(lat2) * Math.sin(lon2);
  const z = a * Math.sin(lat1) + b * Math.sin(lat2);
  return [
    Number(toDeg(Math.atan2(z, Math.sqrt(x * x + y * y))).toFixed(6)),
    Number(toDeg(Math.atan2(y, x)).toFixed(6)),
  ];
}

/**
 * Each shipment carries one or more containers. `daysAgoDeparted` and
 * `transitDays` drive the whole milestone timeline so dates stay coherent.
 */
const SHIPMENTS = [
  {
    bookingRef: "MEDUSH4471902",
    billOfLading: "MEDUSH4471902",
    carrier: "MSC",
    carrierScac: "MSCU",
    vesselName: "MSC GÜLSÜN",
    vesselImo: "IMO 9839430",
    voyageNumber: "236E",
    origin: "CNSHA",
    destination: "NLRTM",
    shipper: "Ningbo Sunrise Electronics Co., Ltd.",
    consignee: "Van Doorn Distributie B.V.",
    commodity: "Consumer electronics, LED display panels",
    daysAgoDeparted: 18,
    transitDays: 32,
    transshipment: "SGSIN",
    containers: [
      {
        containerNumber: "MSCU7381940",
        isoType: "45G1",
        sizeType: "40ft High Cube Dry",
        status: "in_transit",
        sealNumber: "SL8842176",
        grossWeightKg: 24680,
        progressPercent: 56,
        notes: "Reefer plug not required. Stowed on deck, bay 34.",
      },
      {
        containerNumber: "MSCU7382013",
        isoType: "45G1",
        sizeType: "40ft High Cube Dry",
        status: "in_transit",
        sealNumber: "SL8842177",
        grossWeightKg: 23140,
        progressPercent: 56,
      },
    ],
  },
  {
    bookingRef: "MAEU611294887",
    billOfLading: "MAEU611294887",
    carrier: "Maersk",
    carrierScac: "MAEU",
    vesselName: "MAERSK EDMONTON",
    vesselImo: "IMO 9502931",
    voyageNumber: "512W",
    origin: "CNYTN",
    destination: "USLAX",
    shipper: "Shenzhen Hongfa Precision Ltd.",
    consignee: "Pacific Rim Imports LLC",
    commodity: "Lithium-ion power tools (UN3481, Class 9)",
    daysAgoDeparted: 11,
    transitDays: 16,
    containers: [
      {
        containerNumber: "MRKU4419827",
        isoType: "45G1",
        sizeType: "40ft High Cube Dry",
        status: "in_transit",
        sealNumber: "ML2298431",
        grossWeightKg: 19420,
        progressPercent: 69,
        notes: "Dangerous goods declaration on file. Stow away from heat sources.",
      },
    ],
  },
  {
    bookingRef: "CMDU7719340",
    billOfLading: "CMDUSHA0774193",
    carrier: "CMA CGM",
    carrierScac: "CMDU",
    vesselName: "CMA CGM JACQUES SAADE",
    vesselImo: "IMO 9839179",
    voyageNumber: "0FMW3E1MA",
    origin: "CNNGB",
    destination: "DEHAM",
    shipper: "Zhejiang Textile Union Import & Export",
    consignee: "Nordhafen Handels GmbH",
    commodity: "Woven cotton fabric rolls",
    daysAgoDeparted: 29,
    transitDays: 30,
    containers: [
      {
        containerNumber: "CMAU5602184",
        isoType: "22G1",
        sizeType: "20ft Standard Dry",
        status: "at_port",
        sealNumber: "CM7741220",
        grossWeightKg: 17850,
        progressPercent: 92,
        notes: "Awaiting terminal gate-out appointment.",
      },
    ],
  },
  {
    bookingRef: "HLCUSHA2210447",
    billOfLading: "HLCUSHA2210447",
    carrier: "Hapag-Lloyd",
    carrierScac: "HLCU",
    vesselName: "HAMBURG EXPRESS",
    vesselImo: "IMO 9501334",
    voyageNumber: "118E",
    origin: "KRPUS",
    destination: "USNYC",
    shipper: "Daehan Chemical Industries",
    consignee: "Atlantic Polymer Supply Inc.",
    commodity: "Polypropylene resin, bagged",
    daysAgoDeparted: 34,
    transitDays: 27,
    containers: [
      {
        containerNumber: "HLXU8143992",
        isoType: "22G1",
        sizeType: "20ft Standard Dry",
        status: "customs_hold",
        sealNumber: "HL5590123",
        grossWeightKg: 21200,
        progressPercent: 95,
        notes: "CBP exam ordered — VACIS scan pending at APM Elizabeth.",
      },
    ],
  },
  {
    bookingRef: "OOLU2751188420",
    billOfLading: "OOLU2751188420",
    carrier: "OOCL",
    carrierScac: "OOLU",
    vesselName: "OOCL HONG KONG",
    vesselImo: "IMO 9776171",
    voyageNumber: "079W",
    origin: "SGSIN",
    destination: "GBFXT",
    shipper: "Straits Agri Commodities Pte Ltd",
    consignee: "Harwich Foods Ltd.",
    commodity: "Refined palm oil in flexitanks",
    daysAgoDeparted: 46,
    transitDays: 26,
    containers: [
      {
        containerNumber: "OOLU6627310",
        isoType: "22G1",
        sizeType: "20ft Standard Dry",
        status: "delivered",
        sealNumber: "OO3318870",
        grossWeightKg: 25980,
        progressPercent: 100,
      },
    ],
  },
  {
    bookingRef: "EGLV142200938",
    billOfLading: "EGLV142200938",
    carrier: "Evergreen",
    carrierScac: "EGLV",
    vesselName: "EVER ACE",
    vesselImo: "IMO 9893890",
    voyageNumber: "0104-063E",
    origin: "MYTPP",
    destination: "BEANR",
    shipper: "Pelangi Rubber Products Sdn Bhd",
    consignee: "Antwerp Rubber Trading NV",
    commodity: "Natural rubber sheets (RSS3)",
    daysAgoDeparted: 41,
    transitDays: 24,
    containers: [
      {
        containerNumber: "EGHU9037461",
        isoType: "45G1",
        sizeType: "40ft High Cube Dry",
        status: "delayed",
        sealNumber: "EG8827104",
        grossWeightKg: 22300,
        progressPercent: 88,
        notes: "Vessel omitted Antwerp call due to berth congestion; discharge rescheduled.",
        delayDays: 9,
      },
    ],
  },
  {
    bookingRef: "COSU6398471250",
    billOfLading: "COSU6398471250",
    carrier: "COSCO",
    carrierScac: "COSU",
    vesselName: "COSCO SHIPPING UNIVERSE",
    vesselImo: "IMO 9795629",
    voyageNumber: "042W",
    origin: "CNSHA",
    destination: "USSAV",
    shipper: "Jiangsu Greenfield Furniture Co.",
    consignee: "Southeast Home Collective",
    commodity: "Flat-pack wooden furniture",
    daysAgoDeparted: 6,
    transitDays: 35,
    containers: [
      {
        containerNumber: "CSNU7714205",
        isoType: "45G1",
        sizeType: "40ft High Cube Dry",
        status: "in_transit",
        sealNumber: "CS1180994",
        grossWeightKg: 18760,
        progressPercent: 21,
      },
    ],
  },
  {
    bookingRef: "ONEYSHA55710300",
    billOfLading: "ONEYSHA55710300",
    carrier: "Ocean Network Express",
    carrierScac: "ONEY",
    vesselName: "ONE APUS",
    vesselImo: "IMO 9806079",
    voyageNumber: "025E",
    origin: "CNNGB",
    destination: "AUSYD",
    shipper: "Hangzhou Brightline Appliances",
    consignee: "Southern Cross Retail Group",
    commodity: "Small kitchen appliances",
    daysAgoDeparted: 8,
    transitDays: 19,
    containers: [
      {
        containerNumber: "ONEU2288513",
        isoType: "45G1",
        sizeType: "40ft High Cube Dry",
        status: "in_transit",
        sealNumber: "ON4471250",
        grossWeightKg: 20110,
        progressPercent: 44,
      },
    ],
  },
  {
    bookingRef: "MEDUJEA9920315",
    billOfLading: "MEDUJEA9920315",
    carrier: "MSC",
    carrierScac: "MSCU",
    vesselName: "MSC IRINA",
    vesselImo: "IMO 9942707",
    voyageNumber: "318W",
    origin: "AEJEA",
    destination: "ESVLC",
    shipper: "Gulf Aluminium Rolling Mill",
    consignee: "Mediterráneo Metales S.L.",
    commodity: "Aluminium coils",
    daysAgoDeparted: 21,
    transitDays: 18,
    containers: [
      {
        containerNumber: "MSCU5540872",
        isoType: "22G1",
        sizeType: "20ft Standard Dry",
        status: "delivered",
        sealNumber: "SL9903418",
        grossWeightKg: 26400,
        progressPercent: 100,
      },
    ],
  },
  {
    bookingRef: "SUDU48810277",
    billOfLading: "SUDU48810277",
    carrier: "Hamburg Süd",
    carrierScac: "SUDU",
    vesselName: "CAP SAN LORENZO",
    vesselImo: "IMO 9622537",
    voyageNumber: "141N",
    origin: "BRSSZ",
    destination: "NLRTM",
    shipper: "Fazenda Verde Café Exportadora",
    consignee: "Rotterdam Coffee Terminal B.V.",
    commodity: "Green coffee beans in jute bags",
    daysAgoDeparted: 14,
    transitDays: 21,
    containers: [
      {
        containerNumber: "SUDU6612078",
        isoType: "22G1",
        sizeType: "20ft Standard Dry",
        status: "in_transit",
        sealNumber: "SU2201773",
        grossWeightKg: 19980,
        progressPercent: 67,
      },
    ],
  },
  {
    bookingRef: "SAFM990412665",
    billOfLading: "SAFM990412665",
    carrier: "Maersk",
    carrierScac: "MAEU",
    vesselName: "MAERSK CABO VERDE",
    vesselImo: "IMO 9784374",
    voyageNumber: "228N",
    origin: "ZADUR",
    destination: "GBFXT",
    shipper: "KwaZulu Citrus Growers Co-op",
    consignee: "Fenland Fresh Produce Ltd.",
    commodity: "Refrigerated citrus fruit",
    daysAgoDeparted: 16,
    transitDays: 22,
    containers: [
      {
        containerNumber: "MNBU3091447",
        isoType: "45R1",
        sizeType: "40ft High Cube Reefer",
        status: "delayed",
        sealNumber: "MK6640912",
        grossWeightKg: 27650,
        progressPercent: 61,
        notes: "Reefer set point -0.5°C. ETA revised after Las Palmas bunker delay.",
        delayDays: 4,
      },
    ],
  },
  {
    bookingRef: "MAEU611305512",
    billOfLading: "MAEU611305512",
    carrier: "Maersk",
    carrierScac: "MAEU",
    vesselName: "MAERSK SENTOSA",
    vesselImo: "IMO 9784386",
    voyageNumber: "533W",
    origin: "SGSIN",
    destination: "USLGB",
    shipper: "Asia Pacific Rubber Trading",
    consignee: "West Coast Industrial Supply",
    commodity: "Industrial conveyor belting",
    daysAgoDeparted: 24,
    transitDays: 23,
    containers: [
      {
        containerNumber: "MRKU7729103",
        isoType: "45G1",
        sizeType: "40ft High Cube Dry",
        status: "at_port",
        sealNumber: "ML3390247",
        grossWeightKg: 21870,
        progressPercent: 90,
        notes: "Discharged at Pier T. Awaiting rail transfer to inland ramp.",
      },
    ],
  },
];

/** Builds the milestone history for one container from its shipment plan. */
function buildMilestones(shipment, container, portsByCode) {
  const origin = portsByCode[shipment.origin];
  const destination = portsByCode[shipment.destination];
  const transship = shipment.transshipment ? portsByCode[shipment.transshipment] : null;
  const delayDays = container.delayDays ?? 0;

  const departedAt = now - shipment.daysAgoDeparted * DAY;
  const scheduledArrival = departedAt + shipment.transitDays * DAY;
  const arrivalAt = scheduledArrival + delayDays * DAY;

  const events = [];
  const add = (offsetMs, code, label, description, port, status, isActual = 1) => {
    events.push({
      eventAt: offsetMs,
      eventCode: code,
      eventLabel: label,
      description,
      locationName: port ? `${port.name}, ${port.country}` : null,
      portId: port ? port.id : null,
      vesselName: shipment.vesselName,
      status,
      isActual,
    });
  };

  add(
    departedAt - 9 * DAY,
    "CEPT",
    "Empty container released",
    `Empty ${container.sizeType.toLowerCase()} picked up from depot for stuffing.`,
    origin,
    null,
  );
  add(
    departedAt - 6 * DAY,
    "GTIN",
    "Gate in at origin terminal",
    "Laden container received at terminal and accepted for loading.",
    origin,
    "at_port",
  );
  add(
    departedAt - 4 * DAY,
    "CUSR",
    "Export customs released",
    "Export declaration cleared by origin customs authority.",
    origin,
    "at_port",
  );
  add(
    departedAt - 14 * HOUR,
    "LOAD",
    "Loaded on vessel",
    `Loaded aboard ${shipment.vesselName} voyage ${shipment.voyageNumber}.`,
    origin,
    "at_port",
  );
  add(
    departedAt,
    "VDEP",
    "Vessel departed",
    `Sailed from ${origin.city} on ${shipment.vesselName}.`,
    origin,
    "in_transit",
  );

  if (transship) {
    const tsArrive = departedAt + Math.round(shipment.transitDays * 0.35) * DAY;
    add(
      tsArrive,
      "VARR",
      "Vessel arrived at transshipment port",
      `Arrived ${transship.name} for transshipment.`,
      transship,
      "at_port",
    );
    add(
      tsArrive + 20 * HOUR,
      "DISC",
      "Discharged for transshipment",
      "Container discharged and staged for onward connection.",
      transship,
      "at_port",
    );
    add(
      tsArrive + 2 * DAY,
      "LOAD",
      "Loaded on connecting vessel",
      `Reloaded aboard ${shipment.vesselName} for the ocean leg to ${destination.city}.`,
      transship,
      "in_transit",
    );
    add(
      tsArrive + 2 * DAY + 8 * HOUR,
      "VDEP",
      "Vessel departed transshipment port",
      `Departed ${transship.city} on the mainline service.`,
      transship,
      "in_transit",
    );
  }

  if (delayDays > 0) {
    add(
      departedAt + Math.round(shipment.transitDays * 0.7) * DAY,
      "DLAY",
      "Schedule delay reported",
      container.notes ?? "Carrier reported a revised arrival schedule.",
      null,
      "delayed",
    );
  }

  const arrived = arrivalAt <= now;
  add(
    arrivalAt,
    "VARR",
    "Vessel arrived at destination",
    `${shipment.vesselName} berthed at ${destination.name}.`,
    destination,
    "at_port",
    arrived ? 1 : 0,
  );

  if (arrived) {
    add(
      arrivalAt + 16 * HOUR,
      "DISC",
      "Discharged from vessel",
      "Container lifted ashore and moved to the container yard.",
      destination,
      "at_port",
    );

    if (container.status === "customs_hold") {
      add(
        arrivalAt + 30 * HOUR,
        "CUSH",
        "Held by customs",
        container.notes ?? "Container selected for customs examination.",
        destination,
        "customs_hold",
      );
    } else if (container.status === "delivered") {
      add(
        arrivalAt + 28 * HOUR,
        "CUSR",
        "Import customs released",
        "Entry accepted and container released for delivery.",
        destination,
        "at_port",
      );
      add(
        arrivalAt + 2 * DAY,
        "GTOU",
        "Gate out for delivery",
        "Container collected by haulier for door delivery.",
        destination,
        "in_transit",
      );
      add(
        arrivalAt + 2 * DAY + 7 * HOUR,
        "DLVR",
        "Delivered to consignee",
        `Delivered to ${shipment.consignee}.`,
        destination,
        "delivered",
      );
      add(
        arrivalAt + 4 * DAY,
        "CERT",
        "Empty container returned",
        "Empty equipment returned to the nominated depot.",
        destination,
        "delivered",
      );
    } else if (container.status === "at_port") {
      add(
        arrivalAt + 30 * HOUR,
        "CUSR",
        "Import customs released",
        "Entry accepted; container awaiting collection.",
        destination,
        "at_port",
      );
      add(
        arrivalAt + 4 * DAY,
        "GTOU",
        "Estimated gate out",
        "Forecast collection once a haulage slot is confirmed.",
        destination,
        "in_transit",
        0,
      );
    }
  } else {
    add(
      arrivalAt + 20 * HOUR,
      "DISC",
      "Estimated discharge",
      "Forecast discharge from vessel at destination terminal.",
      destination,
      "at_port",
      0,
    );
    add(
      arrivalAt + 3 * DAY,
      "DLVR",
      "Estimated delivery",
      `Forecast delivery to ${shipment.consignee}.`,
      destination,
      "delivered",
      0,
    );
  }

  events.sort((a, b) => a.eventAt - b.eventAt);
  return { events, departedAt, scheduledArrival, arrivalAt };
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
  }
  // TiDB Cloud requires TLS; without it the handshake stalls indefinitely.
  const conn = await mysql.createConnection({
    uri: process.env.DATABASE_URL,
    ssl: { minVersion: "TLSv1.2", rejectUnauthorized: true },
    connectTimeout: 20000,
  });

  console.log("Clearing existing tracking data...");
  await conn.execute("DELETE FROM milestones");
  console.log("  milestones cleared");
  await conn.execute("DELETE FROM containers");
  console.log("  containers cleared");
  await conn.execute("DELETE FROM shipments");
  console.log("  shipments cleared");
  await conn.execute("DELETE FROM ports");
  console.log("  ports cleared");

  console.log(`Inserting ${PORTS.length} ports...`);
  await conn.query(
    "INSERT INTO ports (code, name, city, country, countryCode, latitude, longitude) VALUES ?",
    [PORTS],
  );
  const [portRows] = await conn.query("SELECT id, code, name, city, country, latitude, longitude FROM ports");
  const portsByCode = Object.fromEntries(portRows.map(p => [p.code, p]));

  let containerCount = 0;
  let milestoneCount = 0;

  for (const shipment of SHIPMENTS) {
    console.log(`  seeding ${shipment.bookingRef}...`);
    const origin = portsByCode[shipment.origin];
    const destination = portsByCode[shipment.destination];
    const departedAt = now - shipment.daysAgoDeparted * DAY;
    const maxDelay = Math.max(0, ...shipment.containers.map(c => c.delayDays ?? 0));
    const scheduledArrival = departedAt + shipment.transitDays * DAY;
    const arrivalAt = scheduledArrival + maxDelay * DAY;

    const [res] = await conn.execute(
      `INSERT INTO shipments
        (bookingRef, billOfLading, carrier, carrierScac, vesselName, vesselImo, voyageNumber,
         originPortId, destinationPortId, shipper, consignee, commodity, etd, atd, eta, ata)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        shipment.bookingRef,
        shipment.billOfLading,
        shipment.carrier,
        shipment.carrierScac,
        shipment.vesselName,
        shipment.vesselImo,
        shipment.voyageNumber,
        origin.id,
        destination.id,
        shipment.shipper,
        shipment.consignee,
        shipment.commodity,
        sql(departedAt - 12 * HOUR),
        sql(departedAt),
        sql(arrivalAt),
        arrivalAt <= now ? sql(arrivalAt) : null,
      ],
    );
    const shipmentId = res.insertId;

    for (const container of shipment.containers) {
      const { events, arrivalAt: cArrival } = buildMilestones(shipment, container, portsByCode);
      const actuals = events.filter(e => e.isActual === 1 && e.eventAt <= now);
      const lastEvent = actuals[actuals.length - 1] ?? events[0];

      let position;
      let locationLabel;
      if (container.status === "in_transit") {
        const fraction = Math.min(0.95, Math.max(0.05, container.progressPercent / 100));
        position = interpolate(
          [Number(origin.latitude), Number(origin.longitude)],
          [Number(destination.latitude), Number(destination.longitude)],
          fraction,
        );
        locationLabel = `At sea — en route to ${destination.city}`;
      } else if (container.status === "delayed") {
        const fraction = Math.min(0.95, Math.max(0.05, container.progressPercent / 100));
        position = interpolate(
          [Number(origin.latitude), Number(origin.longitude)],
          [Number(destination.latitude), Number(destination.longitude)],
          fraction,
        );
        locationLabel = `At sea — delayed, revised arrival ${destination.city}`;
      } else {
        position = [Number(destination.latitude), Number(destination.longitude)];
        locationLabel =
          container.status === "delivered"
            ? `Delivered — ${destination.city}, ${destination.country}`
            : container.status === "customs_hold"
              ? `Customs examination — ${destination.name}`
              : `${destination.name} container yard`;
      }

      const [cRes] = await conn.execute(
        `INSERT INTO containers
          (containerNumber, shipmentId, isoType, sizeType, status, sealNumber, grossWeightKg,
           currentLatitude, currentLongitude, currentLocation, eta, progressPercent, lastEventAt, notes)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          container.containerNumber,
          shipmentId,
          container.isoType,
          container.sizeType,
          container.status,
          container.sealNumber,
          container.grossWeightKg,
          position[0],
          position[1],
          locationLabel,
          sql(cArrival),
          container.progressPercent,
          sql(lastEvent.eventAt),
          container.notes ?? null,
        ],
      );
      const containerId = cRes.insertId;
      containerCount += 1;

      const rows = events.map(e => [
        containerId,
        e.portId,
        e.eventCode,
        e.eventLabel,
        e.description,
        e.locationName,
        e.vesselName,
        e.status,
        e.isActual,
        sql(e.eventAt),
      ]);
      await conn.query(
        `INSERT INTO milestones
          (containerId, portId, eventCode, eventLabel, description, locationName, vesselName, status, isActual, eventAt)
         VALUES ?`,
        [rows],
      );
      milestoneCount += rows.length;
    }
  }

  console.log(
    `Seeded ${PORTS.length} ports, ${SHIPMENTS.length} shipments, ${containerCount} containers, ${milestoneCount} milestones.`,
  );
  await conn.end();
  // TiDB's TLS socket can keep the event loop alive; exit explicitly.
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
