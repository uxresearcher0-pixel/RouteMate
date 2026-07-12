# Build Plan — RouteMate (Employee Transport Management System)

Source documents: `CONCEPT.md` (system spec) and `ALGORITHM.md` (allocation logic, with a verified Python reference in `algorithm/transport_allocation.py`).

## Tech Stack

| Layer      | Choice                          | Why                                                                 |
| ---------- | ------------------------------- | ------------------------------------------------------------------- |
| Framework  | Next.js 15 (App Router) + TypeScript | One repo for UI + API, server components fit an admin-style app     |
| Database   | MongoDB (local, via Mongoose)   | Already installed and running on localhost:27017; document model fits route cards (embedded stops, per-trip attendance). Mongoose chosen over Prisma because Prisma's Mongo connector needs a replica set. |
| Styling    | Tailwind CSS                    | Fast, consistent admin UI                                            |
| Core logic | Pure TypeScript module (`src/lib/allocation.ts`) | Direct port of the verified Python reference; framework-free and unit-testable |

Layout: docs at repo root, web application in `web/`.

## Architecture Rules

1. **DailyTrip is the unit of operation** — attendance, guest requests, and seat plans hang off a (route, date, tripType) record, never a calendar day.
2. **Allocation is computed, not stored** — the seat plan is recomputed from current data on every read (idempotent, per ALGORITHM.md A11). Persisting published plans comes later.
3. **The allocation module is pure** — pages fetch via Mongoose, map to plain inputs, call `allocate()`, render the result. No DB access inside the algorithm.
4. Trips are created lazily (A1): opening a route card for a date creates the two DailyTrip records and NO_RESPONSE attendance rows if missing.

## Build Phases

### Phase 1 — Foundation (this build)
1. Scaffold Next.js app (`web/`), TypeScript + Tailwind + ESLint.
2. Mongoose models: Provider, Vehicle, Employee, Route (with embedded stops, corridor links, and passenger assignments), DailyTrip (with embedded attendance and guest requests), TemporaryVehicleChange, Announcement.
3. Port the allocation algorithm to `src/lib/allocation.ts`.
4. Seed script with the CONCEPT.md dummy data (3 routes, 4 vehicles, 4 providers, 9 regulars, corridor link, today's attendance + guest requests).
5. Pages:
   - `/` — dashboard: all routes with today's morning/evening trip summaries.
   - `/routes/[id]` — Route Card: vehicle + manager info, per-trip attendance toggles, guest request list + add/approve, live seat plan and capacity alerts for both trips.
   - `/admin` — providers and vehicles overview, temporary vehicle change form.
6. Server actions: set attendance, add/approve/reject guest request, create/remove temporary vehicle change.
7. Verify end-to-end against the Python reference output.

### Phase 2 — Operations hardening
- Login + roles (Admin / Route Manager / Employee) — likely NextAuth credentials.
- Cutoff times enforced (self-service lock after cutoff, manager override).
- Publish/lock a seat plan (persist SeatAssignment snapshot + notifications).
- Announcements UI; waitlist promotion on late status changes.
- CRUD screens for providers, vehicles, routes, stops, passengers.

### Phase 3 — Reports & scale
- Reports: capacity, absences, no-shows, guest usage per trip.
- MongoDB Atlas (or managed Mongo) migration, deployment.
- Mobile-friendly employee view; later native app, QR check-in, live tracking.

## Out of Scope for Phase 1 (deliberate)
- Authentication (role behavior is simulated; all actions open).
- Notification delivery (alerts render in the UI only).
- Persisted seat-plan snapshots.
