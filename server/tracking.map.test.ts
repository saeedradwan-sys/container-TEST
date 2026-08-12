import { describe, expect, it } from "vitest";
import { listContainers } from "./db";

describe("tracking map data", () => {
  it.skipIf(!process.env.DATABASE_URL)(
    "returns seeded current positions and origin/destination coordinates for every demo container",
    async () => {
      const rows = await listContainers({ sort: "container", limit: 200 });

      expect(rows).toHaveLength(13);
      expect(
        rows.filter(
          row => row.currentLatitude !== null && row.currentLongitude !== null,
        ),
      ).toHaveLength(13);
      expect(
        rows.filter(
          row =>
            row.originLatitude !== null &&
            row.originLongitude !== null &&
            row.destinationLatitude !== null &&
            row.destinationLongitude !== null,
        ),
      ).toHaveLength(13);
    },
  );
});
