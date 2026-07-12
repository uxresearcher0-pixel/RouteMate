# 🚐 RouteMate

**Employee Transport Management System** — a mobile-first web app for managing
office pickup & drop-off transport across Dhaka: routes, vehicles, daily
attendance, guest seat booking, and automatic seat allocation.

Built for an organization of ~500 employees (≈80% using office transport) with
a mixed fleet of vendor and office-owned Toyota Hiace microbuses and coasters,
running morning pickup and evening drop-off trips between employee areas and
the office at Banani 11.

## Core ideas

- **Two independent trips per route per day** — morning pickup and evening
  drop-off each have their own attendance, seat availability, guest requests,
  and seat plan. `DailyTrip` is the unit of operation.
- **Regulars first** — a guest can never displace a regular passenger; guests
  only get seats that are free for that specific trip.
- **Real seat structures** — capacity counts passenger seats (driver
  excluded), numbered P1..Pn. "12-seated" Hiace = 11 passengers `[1,3,3,4]`,
  "10-seated" = 9 `[1,3,2,3]`, coasters use 2+2 aisle rows with a 5-wide back
  bench. Left-side entrance.
- **Safety seating** — women and sick passengers are placed in the 1st–2nd
  rows behind the driver row (never beside the driver); earlier drops sit
  toward the front in the evening, earlier boarders toward the back in the
  morning.
- **Corridor-aware guest booking** — overlapping routes (e.g. Azimpur and
  Panthapath share the road until Dhanmondi 32) accept each other's guests
  with a transparent scoring model.
- **Approximate stop times** — each stop can carry morning/evening time
  windows ("07:35–07:40") shown to passengers.

## Features

| Area | What's included |
| ---- | --------------- |
| Booking-first home | My-trip quick attendance, open seats per route, guest seat requests |
| Route cards | Visual seat map per trip, guest approval, per-trip attendance, publishable seat-plan snapshots with drift detection |
| Allocation engine | Pure TS module (Python reference in `algorithm/`), verified in parity |
| Roles & auth | Admin / Route Manager / Employee · sign in with Employee ID or mobile number + password (bcrypt), self-service password change, admin reset |
| Cutoffs | Self-service attendance locks at 08:00 / 16:00 per trip; managers override |
| Admin | Providers, vehicles (with seat layouts), employees, routes & stops (with times), passenger assignment, temporary vehicle changes, announcements |
| Reports | Attendance / no-shows / guest usage per route & direction over a date range |
| Mobile-first | Bottom tab navigation, soft minimal UI, designed to become a native app later |

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS · MongoDB + Mongoose ·
lucide-react. Docs: [CONCEPT.md](CONCEPT.md) (system spec),
[ALGORITHM.md](ALGORITHM.md) (allocation spec), [PLAN.md](PLAN.md) (build plan),
[TOMORROW.md](TOMORROW.md) (status & backlog).

## Getting started

```bash
# prerequisites: Node 22+, a local MongoDB on mongodb://localhost:27017
cd web
npm install
npm run seed     # demo data: 3 routes, 5 vehicles, 14 employees, today's trips
npm run dev      # http://localhost:3000 — sign in as "Transport Admin"
```

Useful scripts (in `web/`):

- `npm run seed` — reset the `transport` database to the demo dataset
- `npm run check` — run the allocation algorithm on the reference scenarios
- `python3 ../algorithm/transport_allocation.py` — Python reference, same output

## Roadmap (Phase 3)

SSO or SMS-OTP sign-in, notifications, corridor editing UI, edit/deactivate
CRUD, and a native mobile app with QR check-in and live vehicle tracking.
