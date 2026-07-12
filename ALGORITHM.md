# Transport Allocation Algorithm — Formal Specification

This document defines the complete allocation algorithm for the Organization Transport Management System. It is written to be directly implementable: every algorithm below maps to one function, and the reference implementation in `algorithm/transport_allocation.py` mirrors this spec section-by-section.

The pipeline runs **once per (route, date, tripType)**. Morning pickup and evening drop-off are fully independent runs.

```text
A1  Daily trip generation
A2  Attendance recording (state machine)
A3  Vehicle resolution (handles temporary replacement)
A4  Regular passenger classification
A5  Available seat calculation
A6  Guest eligibility filter (direction-aware)
A7  Guest scoring and ranking
A8  Guest allocation and waitlist
A9  Capacity shortfall resolution
A10 Seat assignment (direction-aware)
A11 Re-run triggers and waitlist promotion
```

Pipeline order for one trip: `A3 → A4 → A5 → (A9 if shortfall) → A6 → A7 → A8 → A10 → publish`.

---

## Data Structures

```text
Route:
  id, name
  stops: ordered list of Stop            # stored in EVENING (office → home) drop order
  corridorSharedWith: map<routeId, lastSharedStopIndex>
  vehicleId, routeManagerId
  regularPassengerIds: list

Stop:
  id, name, index                        # index = position in evening drop order

TripType: MORNING_PICKUP | EVENING_DROPOFF

# Direction rule:
#   EVENING_DROPOFF: stop order as stored (office first, farthest stop last)
#   MORNING_PICKUP:  boarding order = reversed stop list
#                    (farthest stop boards first, office is the destination)

Vehicle:
  id, type, capacity, providerId, status (ACTIVE | UNAVAILABLE)

TemporaryVehicleChange:
  routeId, replacementVehicleId, dateFrom, dateTo   # applies to BOTH trips of each day

Passenger (regular):
  id, name, gender
  homeStopId                             # drop point (evening) = boarding point (morning)
  frontSeatPriority: bool                # women / sick / injured / pregnant / medical

Attendance:                              # one per (passenger, dailyTrip)
  status: GOING | NOT_GOING | NO_RESPONSE

GuestRequest:                            # one per (guest, dailyTrip)
  id, name, gender, homeRouteId
  pointStopId                            # boarding point (morning) or drop point (evening)
  requestedAt: timestamp
  emergency: bool, frontSeatPriority: bool
  managerApproved: bool
  requiresDeviation: bool

DailyTrip:
  routeId, date, tripType
  cutoffTime
  policyAfterCutoff: KEEP_RESERVED | MANAGER_RELEASE   # default KEEP_RESERVED

TripPlan (output):
  vehicle, capacityAlerts: list
  confirmedRegulars, reservedRegulars, absentRegulars
  approvedGuests, waitlistedGuests, rejectedGuests
  seatPlan: list<(seatLabel, passenger, reason)>
  notifications: list
```

---

## A1. Daily Trip Generation

Run by a scheduled job at day start (or on demand).

```text
function generateDailyTrips(date):
  for each route with status ACTIVE:
    for tripType in [MORNING_PICKUP, EVENING_DROPOFF]:
      if no DailyTrip exists for (route, date, tripType):
        create DailyTrip(route, date, tripType,
                         cutoff = route.cutoff[tripType],
                         policyAfterCutoff = route.policy)
        for each regular passenger of route:
          create Attendance(passenger, trip, status = NO_RESPONSE)
```

Invariant: attendance rows always exist per trip, never per day.

---

## A2. Attendance State Machine

```text
States: NO_RESPONSE, GOING, NOT_GOING

Allowed transitions (by the passenger, before cutoff):
  NO_RESPONSE → GOING | NOT_GOING
  GOING       → NOT_GOING
  NOT_GOING   → GOING

After cutoff (by passenger): all self-service transitions LOCKED.
After cutoff (by route manager or admin): any transition allowed;
  every post-cutoff change triggers re-run (A11).
```

Marking one trip never touches the other trip's attendance.

---

## A3. Vehicle Resolution

```text
function resolveVehicle(route, date) -> (vehicle, alerts):
  change = active TemporaryVehicleChange where
             routeId == route.id AND dateFrom <= date <= dateTo
  if change exists:
    vehicle = change.replacementVehicle
    alerts += "Temporary vehicle {vehicle.id} in effect (replaces {route.vehicle.id})"
  else if route.vehicle.status == UNAVAILABLE:
    alerts += "Assigned vehicle unavailable and no replacement set — BLOCKING"
    return (null, alerts)
  else:
    vehicle = route.vehicle
  return (vehicle, alerts)
```

A temporary change always covers **both trips** of each date in its range; each trip's pipeline re-runs on capacity with its own numbers (the same swap can be fine in the morning and a shortfall in the evening).

---

## A4. Regular Passenger Classification

```text
function classifyRegulars(trip) -> (confirmed, reserved, absent):
  confirmed = []; reserved = []; absent = []
  for each regular passenger p of trip.route:
    s = attendance(p, trip).status
    if s == GOING:      confirmed += p
    else if s == NOT_GOING: absent += p
    else:  # NO_RESPONSE
      if now < trip.cutoff:
        reserved += p                       # seat held — never auto-released early
      else if trip.policyAfterCutoff == KEEP_RESERVED:
        reserved += p                       # still held; manager may release manually
      else:  # MANAGER_RELEASE
        absent += p                         # released, flagged "late — released by policy"
  return (confirmed, reserved, absent)
```

Rule: **a regular seat is never auto-released before cutoff.** Release after cutoff happens only by explicit policy or manager action.

---

## A5. Available Seat Calculation

```text
function availableSeats(vehicle, confirmed, reserved) -> int:
  return vehicle.capacity - len(confirmed) - len(reserved)
```

If the result is negative, regulars alone exceed capacity → go to A9 with `guestAllocation = SKIPPED`.

---

## A6. Guest Eligibility Filter (Direction-Aware)

```text
function filterGuests(trip, requests) -> (eligible, rejected):
  route = trip.route
  # the point that must lie on the route:
  #   MORNING_PICKUP  → guest's boarding point
  #   EVENING_DROPOFF → guest's drop point
  for each g in requests:
    if g.requiresDeviation:
      reject(g, "requires route deviation")            # score would be negative anyway
    else if g.pointStop in route.stops:
      eligible += g                                     # on-route match
    else if g.pointStop in sharedCorridorStops(route):
      eligible += g                                     # corridor match
    else if g.managerApproved:
      eligible += g                                     # special approved arrangement
    else:
      reject(g, "point not on route or shared corridor — manual review")
  return (eligible, rejected)

function sharedCorridorStops(route):
  union over (otherRouteId, lastSharedIndex) in route.corridorSharedWith of
    otherRoute.stops[0 .. lastSharedIndex]
```

---

## A7. Guest Scoring and Ranking

```text
function score(g, trip) -> int:
  s = 0
  if g.homeRouteId == trip.route.id:            s += 100   # exact same route
  if g.pointStop in trip.route.stops:           s += 80    # point exists on route
  else if g.pointStop in sharedCorridor:        s += 60    # corridor route
  if g.emergency:                               s += 40
  if g.gender == FEMALE:                        s += 30    # safety consideration
  if g.requestedAt <= trip.earlyRequestCutoff:  s += 20    # requested early
  if g.managerApproved:                         s += 20
  if g.requiresDeviation:                       s -= 100
  return s

Ranking: sort by (score DESC, emergency DESC, requestedAt ASC, id ASC)
```

The score orders guests **against each other only**. Regulars never enter this ranking.

---

## A8. Guest Allocation and Waitlist

```text
function allocateGuests(eligibleRanked, seats) -> (approved, waitlisted):
  approved  = eligibleRanked[0 : max(seats, 0)]
  waitlisted = eligibleRanked[max(seats, 0) : ]     # keeps rank order for promotion
  return (approved, waitlisted)
```

---

## A9. Capacity Shortfall Resolution

Triggered when `capacity < regulars needed` (A5 negative) or when a vehicle swap shrinks capacity after guests were approved.

```text
function resolveShortfall(trip, plan, vehicle):
  overflow = totalAssigned(plan) - vehicle.capacity
  alerts += "Capacity alert: {totalAssigned} passengers, {capacity} seats on {tripType}"

  # Step 1 — remove guests, lowest score first (NEVER a regular)
  while overflow > 0 and plan.approvedGuests not empty:
    g = lowest-ranked approved guest
    move g to front of waitlist          # keeps priority for promotion
    overflow -= 1

  # Step 2 — if regulars alone still exceed capacity:
  if overflow > 0:
    alerts += "BLOCKING: regulars exceed capacity by {overflow}"
    suggest, in order:
      1. assign a larger vehicle
      2. transfer corridor-compatible regulars to an overlapping route with free seats
      3. route manager / admin manual decision
    # the system NEVER auto-removes a regular passenger
```

Hard invariant: **no regular confirmed/reserved passenger is ever removed before every guest has been removed**, and regulars are never removed automatically at all.

---

## A10. Seat Assignment (Direction-Aware)

Each vehicle carries a `seatLayout` — PASSENGER seats per row, front → back
(the driver is not a passenger seat; capacity counts passengers only). Seats
are numbered P1..Pn. Fleet reality (Toyota Hiace + coasters):

```text
"12-seated" Hiace (11 passengers):  P1|Driver / P2-P4 / P5-P7 / P8-P11 → [1,3,3,4]
"10-seated" Hiace (9 passengers):   P1|Driver / P2-P4 / P5-P6 / P7-P9  → [1,3,2,3]
coasters 20-30 seats: rows of 4 (2+2 with center aisle), 5-wide back bench
```

P1 sits beside the driver but is **never** given to safety-priority (women /
sick) passengers — their priority zone is the **1st and 2nd rows behind the
driver row** (P2..P7 on a 12-seated Hiace); overflow continues into later rows
and P1 is only a last resort. The entrance is on the **left side**, so lower
seat numbers within a row are closest to the door. When a
vehicle has no explicit layout (or it doesn't sum to capacity), derive it from
capacity: known Hiace patterns for 9-11 passengers, the coaster pattern for
≥20, otherwise 1 front seat + rows of 3.

```text
function buildSeatLayout(seatLayout) -> ordered list of seatLabels
  # e.g. [1,3,3,4] → [P1, P2..P4, P5..P7, P8..P11]

function assignSeats(trip, passengers) -> seatPlan:
  seats = buildSeatLayout(vehicle.capacity)          # front → back order

  # --- Phase 1: safety priority (both trip types) ---
  safety = passengers with frontSeatPriority (women priority, sick/ill/injured/
           pregnant/medical), ordered by stop order for the trip direction
  assign safety passengers to seats front → back (front seats first)

  remaining = passengers - safety
  freeSeats = seats not yet assigned      # still in front → back order

  # --- Phase 2: direction rule ---
  if trip.tripType == EVENING_DROPOFF:
    order remaining by drop stop index ASC        # earlier drop first
    assign to freeSeats front → back              # earlier drop = closer to front
  else:  # MORNING_PICKUP
    order remaining by boarding order ASC         # boards earlier first
    assign to freeSeats back → front              # earlier boarder = closer to back,
                                                  # last boarder sits nearest the door
  return seatPlan
```

Rationale: evening — nobody climbs past you to get out before you; morning — nobody climbs past seated passengers to get in after you.

---

## A11. Re-run Triggers and Waitlist Promotion

The pipeline is **idempotent**: re-running it for a trip from current data always yields a consistent plan. Re-run the affected trip when:

| Event                                        | Action                                    |
| -------------------------------------------- | ----------------------------------------- |
| Regular flips to NOT_GOING after allocation  | seat freed → promote head of waitlist     |
| Regular flips to GOING (manager, post-cutoff)| regular reclaims seat → lowest guest drops to waitlist (A9 order) |
| Approved guest cancels                       | promote head of waitlist                  |
| Temporary vehicle change created/removed     | re-run BOTH trips of every affected date  |
| Manager releases a reserved seat post-cutoff | seat freed → promote head of waitlist     |
| New guest request before cutoff              | insert into ranking (A7), re-allocate     |

Promotion always takes the **head of the waitlist** (highest surviving rank). Every re-run ends by re-executing A10 and notifying only passengers whose seat or status changed.

---

## Published Output (per trip)

1. Final passenger list: confirmed regulars, reserved regulars, approved guests.
2. Waitlist in promotion order.
3. Seat plan with reasons.
4. Capacity alerts, if any.
5. Notifications to route manager and affected passengers.
