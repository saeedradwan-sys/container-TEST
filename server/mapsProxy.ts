import type { Express, Request, Response } from "express";

/**
 * Same-origin proxy for the Google Maps JS runtime.
 *
 * The upstream Forge maps proxy rejects requests whose `Origin` does not match
 * the registered project origin (403 "origin is required" / 401 "project origin
 * not matched"). A browser loading the app from `127.0.0.1:3000` in preview, or
 * from any host that differs from the registered one, therefore cannot fetch the
 * script directly. Serving it through our own server lets us attach the correct
 * Origin header server-side, so the map works in every environment.
 */
const FORGE_BASE_URL =
  process.env.BUILT_IN_FORGE_API_URL ||
  process.env.VITE_FRONTEND_FORGE_API_URL ||
  "https://forge.manus.ai";

const FORGE_KEY =
  process.env.VITE_FRONTEND_FORGE_API_KEY || process.env.BUILT_IN_FORGE_API_KEY || "";

/**
 * Resolves the Origin to present upstream.
 *
 * The proxy only accepts the origin the project is actually served from, so we
 * mirror the browser's own request: `Origin` when present, otherwise the public
 * host from the forwarding headers. Loopback hosts are never accepted upstream,
 * so they are skipped in favour of the forwarded host.
 */
function upstreamOrigin(req: Request): string {
  const override = process.env.MAPS_PROXY_ORIGIN;
  if (override) return override;

  const isLoopback = (value: string) =>
    value.includes("localhost") || value.includes("127.0.0.1");

  const forwardedHost =
    (req.headers["x-forwarded-host"] as string | undefined)?.split(",")[0]?.trim() ??
    req.get("host") ??
    "";
  const forwardedProto =
    (req.headers["x-forwarded-proto"] as string | undefined)?.split(",")[0]?.trim() ??
    "https";

  if (forwardedHost && !isLoopback(forwardedHost)) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  const requestOrigin = req.get("origin") ?? req.get("referer") ?? "";
  if (requestOrigin && !isLoopback(requestOrigin)) {
    try {
      return new URL(requestOrigin).origin;
    } catch {
      /* fall through */
    }
  }

  // Preview requests arriving over loopback (e.g. headless screenshots) still
  // need a valid public origin; fall back to the sandbox preview host.
  return process.env.PREVIEW_ORIGIN ?? sandboxPreviewOrigin();
}

/**
 * Best-effort reconstruction of the sandbox preview origin, used when a request
 * reaches the server over loopback with no forwarding headers.
 */
function sandboxPreviewOrigin(): string {
  const host = process.env.MANUS_SANDBOX_PREVIEW_HOST;
  if (host) return `https://${host}`;

  const sandboxId = process.env.MANUS_SANDBOX_ID ?? process.env.SANDBOX_ID;
  const port = process.env.PORT || "3000";
  return sandboxId ? `https://${port}-${sandboxId}.manus.computer` : "";
}

export function registerMapsProxy(app: Express) {
  app.get("/api/maps/js", async (req: Request, res: Response) => {
    try {
      const libraries =
        typeof req.query.libraries === "string"
          ? req.query.libraries
          : "marker,places,geocoding,geometry";
      const url = `${FORGE_BASE_URL}/v1/maps/proxy/maps/api/js?key=${encodeURIComponent(
        FORGE_KEY,
      )}&v=weekly&loading=async&libraries=${encodeURIComponent(libraries)}`;

      const origin = upstreamOrigin(req);
      const upstream = await fetch(url, {
        headers: origin ? { Origin: origin, Referer: `${origin}/` } : {},
      });

      if (!upstream.ok) {
        const detail = await upstream.text();
        console.error("[Maps] Upstream rejected script request:", upstream.status, detail);
        res.status(502).type("application/javascript").send(
          `console.error(${JSON.stringify(
            `Maps proxy error ${upstream.status}: ${detail.slice(0, 200)}`,
          )});`,
        );
        return;
      }

      const body = await upstream.text();
      // Rewrite the runtime's internal base URL so follow-up chunk requests
      // (tiles, vector modules) also travel through this same-origin proxy.
      const rewritten = body.replaceAll(
        `${FORGE_BASE_URL}/v1/maps/proxy`,
        "/api/maps/tile",
      );

      res.setHeader("Cache-Control", "public, max-age=1800");
      res.type("application/javascript").send(rewritten);
    } catch (error) {
      console.error("[Maps] Failed to proxy Maps script:", error);
      res
        .status(500)
        .type("application/javascript")
        .send('console.error("Maps proxy failed");');
    }
  });

  /** Passthrough for any resource the Maps runtime requests after bootstrap. */
  app.get(/^\/api\/maps\/tile\/(.*)$/, async (req: Request, res: Response) => {
    try {
      const suffix = req.params[0] ?? "";
      const query = req.originalUrl.includes("?")
        ? req.originalUrl.slice(req.originalUrl.indexOf("?"))
        : "";
      const url = `${FORGE_BASE_URL}/v1/maps/proxy/${suffix}${query}`;
      const origin = upstreamOrigin(req);

      const upstream = await fetch(url, {
        headers: origin ? { Origin: origin, Referer: `${origin}/` } : {},
      });

      const contentType = upstream.headers.get("content-type") ?? "application/octet-stream";
      res.status(upstream.status).setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "public, max-age=3600");

      const buffer = Buffer.from(await upstream.arrayBuffer());
      if (contentType.includes("javascript") || contentType.includes("text")) {
        res.send(
          buffer
            .toString("utf-8")
            .replaceAll(`${FORGE_BASE_URL}/v1/maps/proxy`, "/api/maps/tile"),
        );
      } else {
        res.send(buffer);
      }
    } catch (error) {
      console.error("[Maps] Failed to proxy Maps resource:", error);
      res.status(502).end();
    }
  });
}
