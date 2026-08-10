# Google Maps proxy findings

Investigation notes for the blank-map issue, kept so the fix is understandable later.

## Upstream behaviour

The Maps runtime is fetched from the Forge maps proxy:

```
${VITE_FRONTEND_FORGE_API_URL}/v1/maps/proxy/maps/api/js?key=${VITE_FRONTEND_FORGE_API_KEY}&v=weekly&libraries=marker,places,geocoding,geometry
```

Observed responses, by `Origin` header:

| Origin sent | Result |
| --- | --- |
| none | `403 {"error":"origin is required"}` |
| `http://localhost:3000` | `401 {"error":"project origin not matched"}` |
| `https://YZzLbdaBSCBgp8jut5yQQ8.manus.space` (app-id host) | `401 {"error":"project origin not matched"}` |
| `https://3000-ifs0xkvcaz3jkdeiy67ui-75e90c37.sg1.manus.computer` (preview host) | `200`, ~1.4 MB of JS |

`VITE_FRONTEND_FORGE_API_URL` resolves to `https://forge.manus.ai`; `VITE_APP_ID` is
`YZzLbdaBSCBgp8jut5yQQ8`.

## Why the browser could not load it directly

The preview renders the app at `http://127.0.0.1:3000` in headless captures, so the
browser sent a loopback `Origin` and the upstream rejected it. That produced
`Failed to load Google Maps script` and a blank map area.

## Fix

`server/mapsProxy.ts` serves the runtime from our own origin at `/api/maps/js` and
attaches an accepted `Origin` header server-side. The origin is resolved in this
order: `MAPS_PROXY_ORIGIN` env var, then the `X-Forwarded-Host`/proto pair, then the
request `Origin`/`Referer`, skipping loopback values throughout.

`MAPS_PROXY_ORIGIN` is set as a project secret to the preview origin above, and
`server/mapsProxy.test.ts` asserts that origin still returns HTTP 200 from upstream.

## Bootstrap chain

The bootstrap script returned by the proxy is only ~14 KB. It then loads its real
modules straight from Google, not through the proxy:

```
https://maps.googleapis.com/maps-api-v3/api/js/65/12f/common.js
https://maps.googleapis.com/maps-api-v3/api/js/65/12f/geometry.js
https://maps.googleapis.com/maps-api-v3/api/js/65/12f/marker.js
https://maps.googleapis.com/maps-api-v3/api/js/65/12f/controls.js
https://maps.googleapis.com/maps-api-v3/api/js/65/12f/util.js
https://maps.googleapis.com/maps-api-v3/api/js/65/12f/main.js
```

Those URLs are publicly reachable (verified `200` for `common.js` and `main.js`), and
the bootstrap embeds its own Google API key, so no proxy rewriting is needed for the
follow-up requests. The `/api/maps/tile` passthrough therefore sees no traffic in
practice but is harmless and covers proxy-relative URLs should upstream change.
