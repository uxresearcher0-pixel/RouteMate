# RouteMate — Employee Transport Management System

## Project Concept

The Organization Transport Management System is a web-based platform designed to manage office transportation for employees across Dhaka, covering both **morning pickup** (home area → office) and **evening drop-off** (office → home area).

The organization has around 500 employees in Dhaka, and nearly 80% use office transport. Employees travel from areas such as Savar, Narayanganj, Old Dhaka, Mirpur, Azimpur, Dhanmondi, Panthapath, and other parts of Dhaka to the office located at Banani 11. Transport is provided through a mix of vendor-supplied microbuses (9–12 seats), office coasters, and 5–6 organization-owned micros — approximately 20–30 vehicles in total, supplied by multiple providers.

As the organization hires new employees every trimester, the number of transport users is increasing rapidly, and manual route and passenger management is becoming difficult. The system will manage routes, vehicles, vendors, route managers, permanent passengers, guest passengers, per-trip attendance, temporary vehicle changes, seat allocation, and announcements in a structured way.

### The Two-Trip Model (Core Design Decision)

Every route operates **two independent daily trips**:

```text
1. Morning Pickup Trip  — e.g., Azimpur → Banani 11
2. Evening Drop-off Trip — e.g., Banani 11 → Azimpur
```

The same route, vehicle, and passenger group are shared, but the stop sequence is reversed and **attendance, seat availability, guest requests, and seat plans are managed separately per trip**. This matters because employee movement is not symmetric:

| Employee | Morning Pickup | Evening Drop-off |
| -------- | -------------- | ---------------- |
| Rafi     | Going          | Going            |
| Nusrat   | Going          | Not Going        |
| Shanto   | Not Going      | Going            |
| Sadia    | Going          | Going            |
| Imran    | Not Going      | Not Going        |

An employee may come by office transport but return by personal ride, or come by personal transport but need the evening drop-off. The system must never assume that morning presence implies evening presence.

**Consequence for seat release:** if a regular passenger is not taking the morning pickup, their seat becomes available for a guest **for the morning trip only**. Their evening seat stays reserved unless they also mark the evening as Not Going.

### Core Allocation Rule

> Regular passengers of a route get first priority, **separately for each trip**. A guest passenger can only be allocated a seat on a trip after the regular passengers of that trip are confirmed, absent, or released for that trip.

A guest can never displace a regular passenger. If a regular passenger marks themselves absent for a trip, that seat temporarily becomes available for that trip only.

### Route Cards

Each route has a dedicated **Route Card** containing: route name and both directions, vehicle details, provider information, route manager, permanent passenger list, pickup/drop points, per-trip daily attendance, per-trip available seats, per-trip guest requests, per-trip seat plans, temporary vehicle changes, and announcements. Route managers manage daily attendance, add new passengers with approval, handle guest ride requests, and notify members about route updates.

### Temporary Vehicle Changes

Due to breakdowns, maintenance, provider-side problems, or operational needs, a vehicle may be replaced for a single day or a date range. The replacement may come from the same provider or another provider (including office-owned backups). When a vehicle changes, the system **recalculates seat capacity for both the morning and evening trips** and notifies the route manager and passengers. A replacement with fewer seats must immediately raise a capacity alert.

### Multiple Providers

All vehicles do not belong to one provider. A provider may supply one car or many. Admin can add, update, deactivate providers and vehicles; office-owned vehicles are managed in the same system.

### Seating Safety and Convenience Rules

1. Women get priority for front seats in microbuses.
2. Sick, injured, elderly, pregnant, or medically prioritized passengers also get front-seat priority.
3. After safety priorities, seating follows the trip direction:
   - **Morning pickup:** passengers boarding **earlier** sit toward the **back/middle** so passengers boarding later can enter easily. (Safety-priority passengers keep front seats regardless of boarding order.)
   - **Evening drop-off:** passengers dropping **earlier** sit toward the **front**; passengers dropping **last** sit toward the **back**.

This reduces climbing over people, makes boarding and dropping smoother, and keeps route movement efficient.

### Route Overlap

Some routes share a long corridor. For example, the Azimpur route and the Panthapath route share the road until Dhanmondi 32 (Mahakhali → Farmgate → Indira Road → Manik Mia Avenue → Asad Gate → Dhanmondi 27 → Sukrabad → Dhanmondi 32). A guest going to Dhanmondi 32 may be eligible for either vehicle; a guest going to Azimpur should not be assigned to the Panthapath vehicle unless the route manager or admin approves a special arrangement. Non-overlapping routes (e.g., Narayanganj) do not accept corridor guests without an approved transfer point.

### Rollout

Version 1 is a web application for admin, transport team, route managers, and employees. Later versions extend to a mobile app with push notifications, live vehicle updates, QR check-in, and emergency ride requests.

---

# Core System Modules

## 1. Organization Admin Panel

| Module                   | Purpose                                                    |
| ------------------------ | ---------------------------------------------------------- |
| Providers                | Add, edit, remove transport vendors                        |
| Vehicles                 | Add, edit, remove cars, micros, coasters                   |
| Routes                   | Create and manage route cards (both directions)            |
| Route Managers           | Assign managers to routes                                  |
| Employees                | Add employees and assign them to routes                    |
| Passenger Priority       | Regular, guest, emergency, sick, female priority           |
| Daily Trips              | View morning and evening trip status separately            |
| Announcements            | Send notices to route managers or passengers               |
| Temporary Vehicle Change | Replace vehicle for one day or a date range (both trips)   |
| Reports                  | Capacity, usage, absences, no-shows, guest rides, per trip |

## 2. Provider Management

| Provider     | Cars Supplied | Status |
| ------------ | ------------: | ------ |
| Provider A   |       10 cars | Active |
| Provider B   |        4 cars | Active |
| Provider C   |         1 car | Active |
| Office Owned |        6 cars | Active |

Each provider can have one car or many. The system must not assume all vehicles belong to one provider.

## 3. Vehicle Management

| Field                 | Example              |
| --------------------- | -------------------- |
| Vehicle ID            | CAR-AZI-01           |
| Vehicle Type          | Microbus             |
| Capacity              | 12 seats             |
| Provider              | Provider A           |
| Driver Name           | Rahim                |
| Driver Phone          | 017XXXXXXXX          |
| Assigned Route        | Azimpur ⇄ Banani 11  |
| Status                | Active               |
| Temporary Replacement | No                   |

## 4. Route Card

| Section             | Details                                                  |
| ------------------- | -------------------------------------------------------- |
| Route Name          | Azimpur ⇄ Banani 11                                      |
| Route Code          | R-AZI                                                    |
| Morning Direction   | Azimpur → Banani 11                                      |
| Evening Direction   | Banani 11 → Azimpur                                      |
| Vehicle             | CAR-AZI-01 (or temporary replacement)                    |
| Capacity            | 12                                                       |
| Provider            | Provider A                                               |
| Route Manager       | Employee A (with contact)                                |
| Regular Passengers  | Permanent members of the route (9)                       |
| Morning Attendance  | Going / Not Going for today's pickup                     |
| Evening Attendance  | Going / Not Going for today's drop-off                   |
| Guest Requests      | Separate lists for morning and evening trips             |
| Available Seats     | Calculated per trip from attendance and capacity         |
| Seat Plan           | Separate seat plan for pickup and drop-off               |
| Stops               | Pickup sequence (morning) and drop sequence (evening)    |
| Announcements       | Route notices and emergency updates                      |

---

# Example Route Scenarios

## Route 1: Azimpur ⇄ Banani 11 (R-AZI)

Evening drop sequence (morning pickup runs the reverse):

1. Banani 11
2. Mahakhali
3. Elevated Expressway
4. Farmgate
5. Farmgate / Indira Road
6. Manik Mia Avenue
7. Asad Gate
8. Dhanmondi 27
9. Sukrabad
10. Dhanmondi 32
11. Kalabagan
12. Labaid
13. Science Lab
14. New Market
15. Azimpur
16. Dhaka University

## Route 2: Panthapath ⇄ Banani 11 (R-PAN)

Shares the corridor with R-AZI until Dhanmondi 32:

Banani → Mahakhali → Farmgate → Manik Mia Avenue → Asad Gate → Dhanmondi 27 → Sukrabad → Dhanmondi 32 → (turns left toward Panthapath)

## Route 3: Narayanganj ⇄ Banani 11 (R-NAR)

A separate corridor. Should not normally accept passengers for Azimpur or Panthapath (and vice versa) unless there is a special approved transfer point.

---

# Main Transport Problems the System Solves

1. Permanent passengers may be absent — differently in the morning and the evening.
2. Other employees may request a guest ride for one trip only.
3. Some routes overlap for a long distance.
4. Some cars may become unavailable on short notice.
5. Replacement cars may have different seat capacity.
6. Route managers may manually add people without visibility.
7. Women and sick employees need safer, more comfortable front seats.
8. Passengers dropping earlier should not be blocked by passengers dropping later; passengers boarding later should not have to climb over passengers boarding earlier.
9. New employees join every trimester, so route demand keeps changing.
10. Manual seat allocation creates confusion, conflict, and unfairness.

---

# Passenger Priority Types

| Priority | Passenger Type                                               | Meaning                              |
| -------: | ------------------------------------------------------------ | ------------------------------------ |
|       P1 | Regular confirmed passenger (for this trip)                   | Highest priority                     |
|       P2 | Regular passenger with emergency/sick/women front-seat need   | High priority for seating position   |
|       P3 | Approved guest on same route (for this trip)                  | Can get seat if available            |
|       P4 | Guest from an overlapping corridor route                      | Can get seat if route overlap allows |
|       P5 | Unapproved/late guest request                                 | Waiting list                         |

Priorities apply **per trip**: a P1 morning passenger who is Not Going in the evening holds no evening seat.

---

# Daily Attendance Rule (Per Trip)

Each member updates status **separately for morning pickup and evening drop-off**.

| Status            | Meaning                                                    |
| ----------------- | ---------------------------------------------------------- |
| Going             | Passenger will take this trip today                        |
| Not Going         | Seat can be released for this trip only                    |
| Late Confirmation | Passenger did not confirm before this trip's cutoff        |
| Guest Request     | Passenger wants a temporary ride on this trip              |
| Emergency Request | Needs special approval or front-seat consideration         |

### Cutoffs and Timeline

**Morning pickup** — confirm the previous night or early morning:

| Time           | Action                                    |
| -------------- | ----------------------------------------- |
| Before 8:00 AM | Employees mark Going / Not Going (pickup) |
| 8:00 AM        | Regular passenger seat lock (morning)     |
| 8:05 AM        | Available morning seats calculated        |
| 8:10 AM        | Morning guest passengers allocated        |
| 8:15 AM        | Final morning seat plan shared            |

**Evening drop-off** — confirm before an afternoon cutoff:

| Time           | Action                                      |
| -------------- | ------------------------------------------- |
| Before 4:00 PM | Employees mark Going / Not Going (drop-off) |
| 4:00 PM        | Regular passenger seat lock (evening)       |
| 4:05 PM        | Available evening seats calculated          |
| 4:10 PM        | Evening guest passengers allocated          |
| 4:15 PM        | Final evening seat plan shared              |

Recommended policy: **do not auto-release regular seats before the cutoff.** After the cutoff, the route manager can release unconfirmed seats manually or by route policy.

---

# Allocation Algorithm

The algorithm runs **once per route per trip** (morning and evening are independent runs).

### Step 1: Load trip data

For each route + trip type, load: vehicle capacity, current assigned vehicle, temporary vehicle (if any), regular passenger list, stop sequence **for this direction**, route manager, guest requests **for this trip**, and passenger priority conditions.

### Step 2: Check vehicle availability

If the assigned car is available, use its capacity. If not, assign the replacement car, recalculate capacity **for both trips of the day**, and notify the route manager and passengers.

```text
Original car: 12 seats
Replacement car: 10 seats
→ The system must immediately detect a capacity risk on each affected trip.
```

### Step 3: Confirm regular passengers first (for this trip)

1. Status `Going` for this trip → reserve seat.
2. Status `Not Going` for this trip → release seat to the guest pool **for this trip only**.
3. No response before cutoff → keep seat reserved until cutoff.
4. After cutoff, route policy decides: keep reserved, move to late/waiting, or release with route manager approval.

### Step 4: Calculate available seats

```text
Available Seats (trip) = Vehicle Capacity
                       - Confirmed Regular Passengers (trip)
                       - Reserved Regular Passengers (trip)
```

Example (morning):

```text
Vehicle capacity = 12
Regular passengers = 9
Confirmed going = 7
Not going = 2
Available morning seats = 12 - 7 = 5
```

### Step 5: Filter guest requests (for this trip)

A guest is eligible only if:

- There is an available seat on this trip.
- Their pickup point (morning) or drop point (evening) is on the route or its shared corridor.
- Their request is approved or allowed by route policy.
- Their ride does not create a major route deviation.
- They do not replace a regular passenger.

Example: a guest going to Dhanmondi 32 in the evening can ride either the Azimpur or Panthapath vehicle. A guest going to Narayanganj cannot be assigned to the Azimpur route.

### Step 6: Score guest requests

```text
Guest Score = Route Match Score
            + Shared Corridor Score
            + Emergency Score
            + Request Time Score
            + Manager Approval Score
```

| Factor                                        | Score |
| --------------------------------------------- | ----: |
| Exact same route                               |  +100 |
| Pickup/drop point exists on route              |   +80 |
| Shared corridor route                          |   +60 |
| Emergency/sick condition                       |   +40 |
| Woman passenger safety consideration           |   +30 |
| Requested early                                |   +20 |
| Route manager approved                         |   +20 |
| Requires route deviation                       |  -100 |

The score ranks guests against each other only. Regular passengers never compete with guests.

### Step 7: Allocate guest passengers

Fill available seats in order: same-route guests → shared-corridor guests → emergency-approved → earliest request time → manager approval. Guests beyond the seat count go to the trip's waiting list.

### Step 8: Assign seats (direction-aware)

1. **Front seats first:** women, sick, ill, injured, pregnant, or medically prioritized passengers (both trip types).
2. **Morning pickup:** remaining seats fill back-to-front by boarding order — earliest pickups sit toward the back, latest pickups toward the front, so no one climbs over seated passengers.
3. **Evening drop-off:** remaining seats fill front-to-back by drop order — earliest drops toward the front, last drops toward the back.

```text
Evening example (Azimpur route):
Front / early seats:  Farmgate, Indira Road, Manik Mia Avenue, Dhanmondi 32
Middle seats:         Kalabagan, Labaid, Science Lab
Back seats:           New Market, Azimpur, Dhaka University
```

---

# Simplified Pseudocode

```text
For each route:
  For each tripType in [MorningPickup, EveningDropoff]:
    Load route card and stop sequence for tripType direction
    Load assigned vehicle
    If assigned vehicle is unavailable:
        Assign temporary replacement vehicle
        Notify route manager
        Update vehicle capacity

    regularPassengers = permanent passengers of this route
    guestRequests = guest requests for (this route or shared corridor) AND tripType

    confirmedRegulars = []; absentRegulars = []; reservedRegulars = []
    For each passenger in regularPassengers:
        status = passenger.attendance[tripType]
        If status == "Going":        Add to confirmedRegulars
        Else if status == "Not Going": Add to absentRegulars
        Else:                         Add to reservedRegulars   # until cutoff

    usedSeats = count(confirmedRegulars) + count(reservedRegulars)
    availableSeats = vehicle.capacity - usedSeats

    If availableSeats < 0:
        Trigger capacity alert for this trip
        Suggest bigger car or second car
        Stop guest allocation

    eligibleGuests = []
    For each guest in guestRequests:
        point = guest.pickupPoint if tripType == MorningPickup else guest.dropPoint
        If point in route.stopList:            Add to eligibleGuests
        Else if point in sharedCorridorStops:  Add to eligibleGuests
        Else:                                  Reject or send to manual review

    Sort eligibleGuests by:
        emergency priority, route match, shared corridor match,
        request time, manager approval

    approvedGuests  = first availableSeats guests
    waitlistedGuests = remaining guests

    finalPassengers = confirmedRegulars + reservedRegulars + approvedGuests

    Assign front seats to women-priority and sick/ill passengers
    If tripType == MorningPickup:
        Assign remaining seats back-to-front by boarding order
        (earlier pickup = back/middle, later pickup = front)
    Else:
        Assign remaining seats front-to-back by drop order
        (earlier drop = front/middle, later drop = back)

    Publish final seat plan for tripType
    Notify passengers and route manager
```

---

# Dummy Data Demonstration

## Vehicles

| Vehicle ID | Type         | Capacity | Provider     | Assigned Route        |
| ---------- | ------------ | -------: | ------------ | --------------------- |
| CAR-AZI-01 | Microbus     |       12 | Provider A   | Azimpur ⇄ Banani      |
| CAR-PAN-01 | Microbus     |       10 | Provider B   | Panthapath ⇄ Banani   |
| CAR-NAR-01 | Microbus     |       12 | Provider C   | Narayanganj ⇄ Banani  |
| CAR-OFF-01 | Office Micro |       11 | Office Owned | Backup                |

## Azimpur Route Regular Passengers (Today's Per-Trip Attendance)

| ID   | Name    | Gender | Morning Pickup | Evening Drop-off | Drop Point       | Special Priority |
| ---- | ------- | ------ | -------------- | ---------------- | ---------------- | ---------------- |
| E001 | Rafi    | Male   | Going          | Going            | Farmgate         | No               |
| E002 | Nusrat  | Female | Going          | Going            | Dhanmondi 32     | Front Seat       |
| E003 | Hasan   | Male   | Not Going      | Going            | Kalabagan        | No               |
| E004 | Sadia   | Female | Going          | Going            | Labaid           | Front Seat       |
| E005 | Tanvir  | Male   | Going          | Not Going        | Science Lab      | No               |
| E006 | Imran   | Male   | Going          | Going            | New Market       | No               |
| E007 | Farhana | Female | Not Going      | Not Going        | Azimpur          | Front Seat       |
| E008 | Shanto  | Male   | Not Going      | Going            | Azimpur          | No               |
| E009 | Mahmud  | Male   | Going          | Going            | Dhaka University | No               |

Per-trip summary:

```text
Vehicle capacity: 12

Morning pickup:  Going = 6 (Rafi, Nusrat, Sadia, Tanvir, Imran, Mahmud)
                 Not going = 3 (Hasan, Farhana, Shanto)
                 Available morning seats = 12 - 6 = 6

Evening drop-off: Going = 7 (Rafi, Nusrat, Hasan, Sadia, Imran, Shanto, Mahmud)
                  Not going = 2 (Tanvir, Farhana)
                  Available evening seats = 12 - 7 = 5
```

Note how the two trips differ: Hasan and Shanto skip the morning but need the evening ride; Tanvir rides in the morning but returns on his own. This is exactly why attendance is tracked per trip.

## Guest Requests for Azimpur Route — Evening Trip

| ID   | Name  | Home Route  | Requested Drop | Request Type | Eligible?        |
| ---- | ----- | ----------- | -------------- | ------------ | ---------------- |
| G001 | Tania | Panthapath  | Dhanmondi 32   | Guest        | Yes              |
| G002 | Arif  | Panthapath  | Kalabagan      | Guest        | Yes              |
| G003 | Mita  | Mirpur      | Labaid         | Guest        | Yes              |
| G004 | Sohan | Narayanganj | Azimpur        | Guest        | Yes, if approved |
| G005 | Rumi  | Panthapath  | New Market     | Guest        | Yes              |
| G006 | Pavel | Narayanganj | Narayanganj    | Guest        | No               |

Available evening seats: 5. Eligible requests: 5 accepted, 1 rejected/manual review. (Morning guest requests are handled in a separate, independent pool.)

## Final Evening Passenger Allocation — Azimpur Route

| Priority | Passenger | Type    | Drop Point       | Status    |
| -------: | --------- | ------- | ---------------- | --------- |
|        1 | Rafi      | Regular | Farmgate         | Confirmed |
|        2 | Nusrat    | Regular | Dhanmondi 32     | Confirmed |
|        3 | Hasan     | Regular | Kalabagan        | Confirmed |
|        4 | Sadia     | Regular | Labaid           | Confirmed |
|        5 | Imran     | Regular | New Market       | Confirmed |
|        6 | Shanto    | Regular | Azimpur          | Confirmed |
|        7 | Mahmud    | Regular | Dhaka University | Confirmed |
|        8 | Tania     | Guest   | Dhanmondi 32     | Approved  |
|        9 | Arif      | Guest   | Kalabagan        | Approved  |
|       10 | Mita      | Guest   | Labaid           | Approved  |
|       11 | Rumi      | Guest   | New Market       | Approved  |
|       12 | Sohan     | Guest   | Azimpur          | Approved  |

Waitlist:

| Passenger | Reason                                  |
| --------- | --------------------------------------- |
| Pavel     | Drop point does not match Azimpur route |

## Evening Seat Plan (12 passenger seats)

| Seat         | Passenger | Reason                      |
| ------------ | --------- | --------------------------- |
| Front 1      | Nusrat    | Female safety priority      |
| Front 2      | Sadia     | Female safety priority      |
| Row 1 Seat 1 | Rafi      | First drop: Farmgate        |
| Row 1 Seat 2 | Tania     | Early drop: Dhanmondi 32    |
| Row 1 Seat 3 | Arif      | Kalabagan                   |
| Row 2 Seat 1 | Hasan     | Kalabagan                   |
| Row 2 Seat 2 | Mita      | Labaid                      |
| Row 2 Seat 3 | Imran     | New Market                  |
| Row 3 Seat 1 | Rumi      | New Market                  |
| Row 3 Seat 2 | Shanto    | Azimpur                     |
| Row 3 Seat 3 | Sohan     | Azimpur                     |
| Back Seat    | Mahmud    | Last drop: Dhaka University |

Rules applied: women/sick priority first; then earlier drop points toward the front, later drop points toward the back.

## Morning Seat Plan (same route, 6 regulars going)

Morning pickup order is the reverse of the drop sequence: Dhaka University area boards first, Farmgate boards last.

| Seat         | Passenger | Reason                                        |
| ------------ | --------- | --------------------------------------------- |
| Front 1      | Nusrat    | Female safety priority                        |
| Front 2      | Sadia     | Female safety priority                        |
| Back Seat    | Mahmud    | Boards first (Dhaka University)               |
| Row 3 Seat 1 | Imran     | Boards early (New Market)                     |
| Row 2 Seat 1 | Tanvir    | Boards mid-route (Science Lab)                |
| Row 1 Seat 1 | Rafi      | Boards last (Farmgate) — sits nearest the door |

The remaining 6 seats are offered to morning guest requests using the same scoring rules.

---

# Example: Temporary Vehicle Change

Azimpur route's regular car (CAR-AZI-01, 12 seats) becomes unavailable. Replacement: CAR-OFF-01, 11 seats. The change applies to **both trips**, so the system re-checks each trip:

```text
Morning trip: 6 regulars + up to 6 guests → recheck against 11 seats (max 5 guests now)
Evening trip: 7 regulars + 5 approved guests = 12 → exceeds 11 seats
```

The system triggers:

```text
Capacity Alert (Evening trip):
Azimpur route has 12 assigned passengers but the replacement car has only 11 seats.
1 passenger must be moved to the waitlist, another route, or a larger car must be assigned.
```

Resolution options:

1. Assign a larger vehicle.
2. Move one Dhanmondi 32 or Kalabagan passenger to the Panthapath route if seats are available there.
3. Remove the lowest-priority guest from the approved list.
4. Route manager manually approves the final adjustment.

**The system must never remove a regular confirmed passenger before removing guest passengers.**

---

# How the Web Application Will Work

## Admin Workflow

1. Admin adds providers.
2. Admin adds cars under each provider.
3. Admin creates route cards with both directions and stop sequences.
4. Admin assigns cars to routes.
5. Admin assigns route managers.
6. Admin assigns regular passengers to each route.
7. Admin defines pickup and drop points.
8. Admin monitors daily attendance and capacity for morning and evening trips.
9. Admin handles emergency vehicle changes.
10. Admin sends announcements to route managers or passengers.

## Route Manager Workflow

1. Route manager opens their route card.
2. Checks today's passenger status — morning and evening separately.
3. Reminds members to mark Going / Not Going for each trip before its cutoff.
4. Reviews available seats per trip.
5. Approves or rejects guest requests per trip.
6. Confirms the final passenger list per trip.
7. Reviews the seat allocation per trip.
8. Sends notices to route members.
9. Reports issues to admin.

## Employee Workflow

1. Employee logs into the web app.
2. Opens their assigned route card.
3. Marks daily status for each trip:
   - Morning pickup: Going / Not Going
   - Evening drop-off: Going / Not Going
   - Need guest ride (for either trip)
4. For a guest ride, employee selects: desired route, trip (pickup or drop-off), pickup point, drop point, date, and reason.
5. System shows request status: Approved / Waiting / Rejected / Pending manager approval.
6. Employee receives final seat and vehicle information for each confirmed trip.

---

# Recommended MVP Features

## MVP Phase 1

| Feature                                        | Priority |
| ---------------------------------------------- | -------- |
| Admin login                                    | High     |
| Provider management                            | High     |
| Vehicle management                             | High     |
| Route card creation (bidirectional)            | High     |
| Route manager assignment                       | High     |
| Regular passenger assignment                   | High     |
| Daily Going / Not Going — per trip             | High     |
| Guest ride request — per trip                  | High     |
| Seat availability calculation — per trip       | High     |
| Basic passenger allocation — per trip          | High     |
| Manual approval by route manager               | High     |
| Announcement system                            | Medium   |
| Temporary car replacement (both trips)         | Medium   |
| Direction-aware seat plan                      | Medium   |
| Basic reports (per trip)                       | Medium   |

## Advanced Features for Later

| Feature                          | Purpose                                     |
| -------------------------------- | ------------------------------------------- |
| AI-based route optimization      | Suggest better route distribution           |
| Auto car capacity prediction     | Detect when a route needs a bigger vehicle  |
| Attendance pattern analysis      | Identify unused seats and frequent absences (per trip) |
| Live vehicle tracking            | Show current car location                   |
| Mobile app                       | Faster daily confirmation, push notifications |
| QR check-in                      | Confirm passenger boarding per trip         |
| No-show tracking                 | Prevent repeated misuse (per trip)          |
| Gender/safety-aware seating      | Improve women's safety                      |
| Emergency passenger mode         | Prioritize sick or urgent passengers        |
| Multi-day temporary route change | Handle office events or road closures       |
| Cost reporting                   | Track vendor cost per route                 |
| Provider performance report      | Evaluate vendor punctuality and reliability |

---

# Suggested Database Entities

```text
User
Employee
Provider
Vehicle
Route                    # bidirectional; has morning and evening directions
RouteCard
RouteManager
RouteStop                # ordered; sequence reversible per direction
PassengerAssignment      # permanent membership of an employee on a route
DailyTrip                # one record per route per trip type per day
                         #   tripType: MORNING_PICKUP | EVENING_DROPOFF
DailyAttendance          # per employee per DailyTrip (not per day)
GuestRequest             # tied to a specific DailyTrip
SeatAssignment           # per DailyTrip; direction-aware seat plan
Announcement
TemporaryVehicleChange   # date range; affects both trips; triggers capacity recheck
```

Key modeling rule: **DailyTrip is the unit of operation.** Attendance, guest requests, seat assignments, capacity alerts, and notifications all hang off a DailyTrip, never off a calendar day alone.

---

# Final System Rule Summary

1. Regular route passengers get first priority — separately for morning pickup and evening drop-off.
2. Guest passengers can only use seats available on that specific trip.
3. A guest can never replace a regular passenger.
4. A regular passenger's absence releases their seat for that trip only; the other trip's seat stays reserved.
5. Women and sick passengers get front-seat priority on both trips.
6. Evening drop-off: earlier drops sit toward the front, later drops toward the back.
7. Morning pickup: earlier boarders sit toward the back/middle so later boarders can enter easily.
8. Temporary car changes recalculate capacity for both trips and alert on shortfalls.
9. Route managers can approve guest passengers but cannot break priority rules.
10. Admin has final control over provider, vehicle, route, and manager setup.
11. Every route has a clear daily passenger list, seat plan, and announcement history — one per trip.

The system should not work like a simple car list. It should work like a daily transport operation platform where every route, vehicle, trip, passenger, seat, and exception is managed clearly — and it will reduce confusion, improve fairness, increase safety, and keep office transport scalable as the organization grows.
