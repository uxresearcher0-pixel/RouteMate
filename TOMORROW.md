# Status (updated 2026-07-15 late — mobile app verified on iOS simulator; paused)

## Where we stopped

Mobile app fully verified end-to-end on the iPhone 17 Pro simulator against
the PRODUCTION API: login (E999) → home with live open-seat counts → route
screen showing the van-silhouette seat map with real seat icons, priority
zone (rose), open seats (emerald), tap-to-call driver, cutoff lock, guest
request chips. Relaunch anytime: `cd mobile && npx expo start --ios`; if
Expo Go says "request timed out", run
`xcrun simctl openurl booted "exp://127.0.0.1:8081"`.

## Next session options (user to pick)

1. **Native Xcode build** — `npx expo run:ios` (generates ios/ project,
   ~10 min first build) for a real .xcworkspace + home-screen app.
2. **EAS builds for real devices** — `npx eas-cli build --platform ios
   --profile preview` on @shahriaruxs-team (Apple credentials prompt on
   first run; needs the user).
3. **Manager actions in mobile** — approve guests, publish plan, resolve
   late notices, report driver delay (currently web-only; API endpoints
   need adding like /api/attendance).
4. Remaining Phase 3 backlog: notifications, HRM API, corridor editing UI,
   edit/deactivate CRUD, coaster-shaped body for COACH-01.

# Previous status (2026-07-18 note — seat map v3 shipped)

## DONE — Seat map v3: accurate seat icons (completed 2026-07-18)

Both seat maps (web + mobile) now draw every seat with the real bucket-seat
glyph traced from the Vecteezy asset — headrest, backrest with inner panel,
cushion — tinted by passenger type, inside a vehicle-body outline with a
windshield hint. Walkway/door semantics, P-numbering, and the allocation
logic are unchanged. Deployed to production.

Left open (needs user input): if the exact per-seat x/y positions from the
three Hiace diagrams matter beyond row strings (e.g. the third diagram's
shifted middle column), extend `seatArrangement` to coordinates — confirm
whether the two diagram variants are different vehicles.

## Original request notes — Seat map v3 (user, 2026-07-15)

The user provided three top-view Hiace floor-plan diagrams (front at LEFT,
individual bucket seats drawn with seat back + curved armrest) and a vector
seat icon to use "with accuracy":

- Asset: `design-assets/vecteezy_car-seat-icon-vector-illustration_27568771-0.eps`
  (+ JPG preview + Vecteezy license PDF, copied from Downloads 2026-07-15)
- The diagrams show individual seats (not benches) with realistic spacing,
  center walkway, and slightly different middle-row arrangements between
  variants — first two diagrams identical, third has the middle single-seat
  column shifted (likely two real seat-position variants of the same Hiace).

### Implementation sketch
1. Convert the EPS to clean SVG (Ghostscript/Inkscape, or trace the JPG);
   produce a small top-view seat glyph (rotatable, tintable) for web
   (inline SVG component) and mobile (react-native-svg).
2. Seat map v3 (web `components/ui.tsx` SeatMap + mobile
   `components/seat-map.tsx`): render each seat as the icon positioned per
   the diagrams — individual seats with gaps, walkway, driver seat icon,
   vehicle outline (rounded body shape like the diagrams) — replacing the
   rounded-rectangle cells. Keep P-numbering, type dots/tints (regular/
   guest/priority/open), and the door-side walkway semantics.
3. Possibly extend `seatArrangement` to full per-seat x/y positions per
   vehicle variant if row strings can't express the diagrams accurately.
4. Verify against the three provided diagrams seat-for-seat.

## Previous status (2026-07-12 — operations features complete)

## Latest batch (2026-07-12)

- **Jatrabari route (R-JAT)** with the user's schedule (Jatrabari 07:10 →
  Dayaganj 07:15 → Rajdhani 07:20 → Tati Bazar 07:25 → Kakrail 07:35 →
  Holy Family Red Crescent 07:45 → Banani 11 08:00) + calculated evening
  times; R-PAN and R-NAR filled with calculated stop times, regulars,
  attendance, and guests (38 employees total, 4 active routes, 6 vehicles).
- **Contacts everywhere**: every employee and driver has a phone number,
  shown in attendance lists, trip headers (driver), guest requests, and
  profiles — all `tel:` links.
- **Profiles**: avatar/name click → `/people/[empCode]` (contact, route,
  home stop with times, today's status, leave records).
- **Plan-change window**: cutoff is now derived per trip = first-stop
  departure time − 10 minutes (falls back to fixed route cutoffs when a
  route has no stop times). Badge shows "starts ~HH:MM · changes until
  HH:MM / locked".
- **Running late (passenger)**: 5–10 min notices to the micro manager, who
  Holds (acknowledge) or "Can't wait" (reject — the micro must start).
- **Driver delay**: manager/admin records the driver being late to the
  first stop; shows as an alert on the trip and in the admin monitor.
- **HRM leave sync**: LeaveRecord feed (admin simulates HRM) + admin ON/OFF
  toggle; when ON, on-leave passengers are auto-marked Not Going for both
  trips (badge "on leave (HRM)"); manual attendance works either way.
- **Admin Operations Monitor**: today's late passengers, driver delays, and
  leave records in one card.

Deferred (needs product decision): a real HRM API integration (current
LeaveRecord collection stands in for the feed); driver accounts (delays are
recorded by manager/admin on the driver's behalf).

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
