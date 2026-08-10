import "dotenv/config";
import { describe, expect, it } from "vitest";

/**
 * Validates that MAPS_PROXY_ORIGIN is an origin the upstream Forge maps proxy
 * accepts. A wrong value returns 401 "project origin not matched" and the map
 * silently fails, so this is checked explicitly rather than at runtime only.
 */
describe("Google Maps proxy credentials", () => {
  const base = process.env.VITE_FRONTEND_FORGE_API_URL;
  const key = process.env.VITE_FRONTEND_FORGE_API_KEY;
  const origin = process.env.MAPS_PROXY_ORIGIN;

  it("has the required configuration", () => {
    expect(base, "VITE_FRONTEND_FORGE_API_URL must be set").toBeTruthy();
    expect(key, "VITE_FRONTEND_FORGE_API_KEY must be set").toBeTruthy();
    expect(origin, "MAPS_PROXY_ORIGIN must be set").toBeTruthy();
  });

  it("loads the Maps runtime when the configured origin is presented", async () => {
    const url = `${base}/v1/maps/proxy/maps/api/js?key=${key}&v=weekly&libraries=marker`;
    const response = await fetch(url, {
      headers: { Origin: origin as string, Referer: `${origin}/` },
    });

    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("google.maps");
  }, 30000);
});
