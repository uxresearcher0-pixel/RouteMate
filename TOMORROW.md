# Status (updated 2026-07-10 late night — Phase 2 + mobile-first redesign complete)

## Mobile-first pass (latest)

- **Corrected seat structures**: capacity = passenger seats, driver excluded.
  "12-seated" Hiace = 11 pax `[1,3,3,4]` (P1 beside driver / P2-P4 / P5-P7 /
  P8-P11); "10-seated" = 9 pax `[1,3,2,3]`. Seats numbered P1..Pn everywhere.
- **Mobile-first, booking-first**: app-style bottom tab bar (Home / My Trip /
  Reports / Admin), slim top bar, booking-first Home (my-trip quick attendance,
  open-seats-per-route cards with Request-a-seat CTA, routes list), route card
  reordered (seat map → guest requests → attendance; stops collapsed), open
  seats shown green in the map, soft minimal styling with larger touch targets.
- Future native mobile app should reuse this IA; the allocation module and
  server actions are already API-shaped for it.


Everything from the previous plan is now implemented and verified. This file
tracks what remains for Phase 3.

## Completed in Phase 2

- **Real vehicle seat structures** — `seatLayout` per vehicle
  (Hiace 12 = 2/3/3/4, Hiace 10 = 2/3/2/3, office micro 11 = 2/3/3/3,
  coaster = 2+2 aisle rows + 5-wide back bench). Flows through the allocation
  module, visual seat map (with aisle rendering), seed data, admin form, and
  the Python reference (`npm run check` parity re-verified).
- **Login + roles** — cookie session with "sign in as" (demo mode; password/SSO
  slots into `web/src/lib/auth.ts` later). Pages redirect signed-out users to
  /login; Admin page and nav link are ADMIN-only; server actions enforce roles
  independently of the UI.
- **Cutoff enforcement** — attendance self-service locks at 08:00 (morning) /
  16:00 (evening) per trip; route manager and admin can still edit. Lock state
  shows as a badge; buttons disable for regular employees.
- **CRUD** — providers, vehicles (with seat layout), employees, routes (with
  stops), passenger assignments (one route per employee, reassignment moves
  them), all on the Admin page.
- **Publish seat plan** — manager/admin snapshot per trip stored on DailyTrip;
  badge shows publish time and flips to "outdated" when live data drifts.
- **Date navigation** — route card accepts any date (`?date=`), trips are
  created lazily per date.
- **Announcements** — org-wide (admin) and per-route (manager) with list on
  admin and banner on route cards.
- **Reports** — /reports with date range: per route × trip direction — days,
  going / not-going / no-response counts, guest requests, approvals,
  published-plan count, plus summary tiles and response rate.
- **Mobile** — morning/evening tab switcher below xl breakpoint.

## DONE — Stop-by-stop approximate times (completed)

`RouteStop` has optional `morningTime` / `eveningTime` (free text, windows
like "07:25–07:28" supported; morning and evening are separate because
traffic differs by direction). Seeded with the user's morning schedule
(DU 07:20 → Azimpur 07:25–28 → D32 07:35–40 → Sobhanbagh 07:42 →
Manik Mia 07:45 → office 08:00). Shown on: route-card stop chips
(↑ morning / ↓ evening), the "My trip today" card ("pickup ~07:42 ·
Sobhanbagh"), and guest-form stop options. Admin route form accepts
`Name | morning | evening` per line.

**Assumption to confirm with user:** "subahanbag" was added as a NEW stop
"Sobhanbagh" between Dhanmondi 27 and Sukrabad (evening order) — not a
rename of Sukrabad. Evening drop times are not filled in yet (no data given).

## Phase 3 backlog (not started)

| Item | Notes |
| ---- | ----- |
| Real authentication | Passwords or SSO; replace the demo "sign in as" login. auth.ts is the single seam. |
| Notifications | Email/push when seat plan publishes or vehicle changes; today it's UI-only. |
| Corridor editing | Corridor links are seed-only; admin UI to define shared-corridor stop ranges. |
| Edit/deactivate CRUD | Current CRUD is create + assign/remove; add edit forms and deactivation for vehicles/providers/employees/routes. |
| Waitlist promotion notices | Promotion happens automatically on recompute; notify the promoted guest. |
| Deployment | Managed MongoDB (Atlas), hosting, env-based config. |
| Mobile app / QR check-in / live tracking | Long-term roadmap. |

## Dev quickstart

- `mongod` via brew services on 27017; app: `cd web && npm run dev`
- Reset demo data: `npm run seed` · Algorithm parity: `npm run check`
- Sign in as **Transport Admin (E999)** for full access.
