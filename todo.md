# Container Tracker — TODO

## Database & Data
- [x] `ports` table (UN/LOCODE, name, city, country, lat, lng)
- [x] `shipments` table (booking ref, bill of lading, carrier, vessel, voyage, origin/destination port FKs, ETD, ETA)
- [x] `containers` table (container number, ISO type, size, status, weight, seal, current lat/lng, current location label, ETA, progress, shipment FK)
- [x] `milestones` table (container FK, port FK, event code, event label, description, actual/estimated flag, event timestamp, vessel)
- [x] Generate migration with drizzle-kit and apply SQL via webdev_execute_sql
- [x] Seed realistic ocean freight demo data (20 ports, 12 shipments, 13 containers, 120 milestones)

## API (tRPC)
- [x] `tracking.list` — search by container no./BL/vessel/port + filter by status/carrier, sortable
- [x] `tracking.detail` — container + shipment + ports + full milestone timeline
- [x] `tracking.stats` — total, in transit, at port, customs hold, delivered, delayed counts
- [x] `tracking.upsertContainer` — create or update a container record
- [x] `tracking.upsertShipment` — create or update a shipment record
- [x] `tracking.filters` — carrier and port options
- [x] `tracking.addMilestone` — append a tracking event and sync container status
- [x] Referential validation on mutations (shipmentId, port IDs, containerId) since schema has no FKs
- [x] Conflict handling for duplicate container numbers and booking references

## UI
- [x] Premium theme: refined typography (Google Fonts), spacing scale, soft shadows, maritime accent palette
- [x] Customize DashboardLayout menu items for tracker navigation (Overview, Containers, Map)
- [x] Dashboard home with summary stats cards (total, in transit, delivered, delayed)
- [x] Containers list page: searchable + filterable table (container no., origin, destination, carrier, status, ETA)
- [x] Container detail page: shipment info panel (vessel, BL, carrier, ports) + chronological milestone timeline
- [x] Map view using existing Map.tsx: current position marker + origin→destination route polyline (with graceful fallback; see notes/maps-proxy-findings.md)
- [x] StatusBadge component with exact labels: In Transit, At Port, Customs Hold, Delivered, Delayed
- [x] Loading skeletons, empty states, and error states on all data views
- [x] Responsive layout verified at mobile width

## Quality
- [x] Vitest coverage for maps proxy credentials
- [x] Type check passes (`pnpm check`)
- [x] Visual verification of every screen (dashboard home, containers list, detail page skeleton)
- [x] Push to GitHub repo `saeedradwan-sys/copy-of-container-tracker` (working tree clean, code committed)

## Known Limitations
- The old Google Maps runtime was removed because its origin-handshake loader could hang in preview environments. The tracker now uses a dependency-free SVG ocean map driven directly by latitude/longitude values from the database, so positions and routes render without an external map SDK.
- The container detail API remains authentication-protected. In an unauthenticated preview, the detail page correctly shows its loading/auth state; after login it uses the same verified RouteMap renderer.

## Map Fix (Critical)
- [x] Diagnose Google Maps script load hang and find root cause
- [x] Implement working map solution with a dependency-free SVG coordinate renderer
- [x] Display container locations with status-colored markers and current-position labels
- [x] Show origin→destination routes with solid travelled legs and dashed remaining legs
- [x] Test map with real container data (13 current positions rendered in preview)
- [x] Verify the fleet map renders on desktop and mobile; the protected detail route reuses the same RouteMap component

## Map Verification Evidence
- [x] Pure RouteMap tests verify current-position and route-count rendering logic
- [x] Database integration test verifies all 13 seeded containers expose current coordinates and complete origin/destination coordinates
- [x] Responsive preview verification completed at desktop and mobile widths
- [x] Production build and full Vitest suite pass after the map replacement

## Delivery
- [ ] Save final checkpoint with the working current-location map
- [ ] Confirm the published version is live
