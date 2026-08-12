import { describe, expect, it } from "vitest";
import { getMapRenderSummary, type MapContainer } from "./RouteMap";

const base: MapContainer = {
  id: 1,
  containerNumber: "MSCU1234567",
  status: "in_transit",
  currentLatitude: 35,
  currentLongitude: 12,
  currentLocation: "At sea",
  originCode: "SGSIN",
  originCity: "Singapore",
  originLatitude: 1.29,
  originLongitude: 103.85,
  destinationCode: "USLGB",
  destinationCity: "Long Beach",
  destinationLatitude: 33.75,
  destinationLongitude: -118.2,
  vesselName: "MV Test Vessel",
  progressPercent: 52,
};

describe("RouteMap coordinate rendering", () => {
  it("counts a current position and a complete origin-to-destination route", () => {
    expect(getMapRenderSummary([base])).toEqual({ positions: 1, routes: 1 });
  });

  it("keeps a route visible when a container has not reported a current position", () => {
    const withoutPosition = {
      ...base,
      currentLatitude: null,
      currentLongitude: null,
    };

    expect(getMapRenderSummary([withoutPosition])).toEqual({
      positions: 0,
      routes: 1,
    });
  });

  it("does not plot incomplete coordinate records", () => {
    const incomplete = {
      ...base,
      destinationLatitude: null,
      destinationLongitude: null,
    };

    expect(getMapRenderSummary([incomplete])).toEqual({ positions: 1, routes: 0 });
  });
});
