"""Reference implementation of ALGORITHM.md.

Pure-python, no dependencies. Each function maps to a spec section (A1-A11).
Run directly to execute the dummy-data demo from CONCEPT.md:

    python3 algorithm/transport_allocation.py
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


# ---------------------------------------------------------------- data model

class TripType(Enum):
    MORNING_PICKUP = "Morning Pickup"
    EVENING_DROPOFF = "Evening Drop-off"


class Status(Enum):
    GOING = "Going"
    NOT_GOING = "Not Going"
    NO_RESPONSE = "No Response"


class CutoffPolicy(Enum):
    KEEP_RESERVED = "keep_reserved"
    MANAGER_RELEASE = "manager_release"


@dataclass
class Stop:
    id: str
    name: str
    index: int  # position in EVENING drop order (office first)


@dataclass
class Vehicle:
    id: str
    vtype: str
    capacity: int
    provider: str
    active: bool = True


@dataclass
class Passenger:
    id: str
    name: str
    gender: str  # "F" / "M"
    home_stop: str  # stop id: drop point (evening) = boarding point (morning)
    front_seat_priority: bool = False


@dataclass
class GuestRequest:
    id: str
    name: str
    gender: str
    home_route: str
    point_stop: str  # boarding point (morning) or drop point (evening)
    requested_order: int  # lower = requested earlier
    emergency: bool = False
    front_seat_priority: bool = False
    manager_approved: bool = False
    requires_deviation: bool = False
    requested_early: bool = True


@dataclass
class Route:
    id: str
    name: str
    stops: list[Stop]  # evening drop order
    vehicle: Vehicle
    route_manager: str
    regulars: list[Passenger]
    # routeId -> index of last shared stop in THIS route's stop list
    corridor_shared_with: dict[str, int] = field(default_factory=dict)

    def stop_index(self, stop_id: str) -> Optional[int]:
        for s in self.stops:
            if s.id == stop_id:
                return s.index
        return None


@dataclass
class DailyTrip:
    route: Route
    trip_type: TripType
    attendance: dict[str, Status]  # passenger id -> status (A1/A2)
    after_cutoff: bool = False
    policy: CutoffPolicy = CutoffPolicy.KEEP_RESERVED
    temporary_vehicle: Optional[Vehicle] = None  # A3: covers both trips of the day


@dataclass
class SeatAssignment:
    seat: str
    name: str
    ptype: str  # Regular / Guest
    reason: str


@dataclass
class TripPlan:
    trip: DailyTrip
    vehicle: Optional[Vehicle] = None
    alerts: list[str] = field(default_factory=list)
    confirmed: list[Passenger] = field(default_factory=list)
    reserved: list[Passenger] = field(default_factory=list)
    absent: list[Passenger] = field(default_factory=list)
    approved_guests: list[GuestRequest] = field(default_factory=list)
    waitlist: list[tuple[str, str]] = field(default_factory=list)  # (name, reason)
    seat_plan: list[SeatAssignment] = field(default_factory=list)


# --------------------------------------------------- A3: vehicle resolution

def resolve_vehicle(trip: DailyTrip, plan: TripPlan) -> Optional[Vehicle]:
    if trip.temporary_vehicle is not None:
        plan.alerts.append(
            f"Temporary vehicle {trip.temporary_vehicle.id} in effect "
            f"(replaces {trip.route.vehicle.id}, "
            f"{trip.route.vehicle.capacity} -> {trip.temporary_vehicle.capacity} seats)"
        )
        return trip.temporary_vehicle
    if not trip.route.vehicle.active:
        plan.alerts.append(
            "BLOCKING: assigned vehicle unavailable and no replacement set"
        )
        return None
    return trip.route.vehicle


# ------------------------------------------- A4: regular classification

def classify_regulars(trip: DailyTrip, plan: TripPlan) -> None:
    for p in trip.route.regulars:
        status = trip.attendance.get(p.id, Status.NO_RESPONSE)
        if status is Status.GOING:
            plan.confirmed.append(p)
        elif status is Status.NOT_GOING:
            plan.absent.append(p)
        else:  # NO_RESPONSE — never auto-released before cutoff
            if not trip.after_cutoff or trip.policy is CutoffPolicy.KEEP_RESERVED:
                plan.reserved.append(p)
            else:
                plan.absent.append(p)
                plan.alerts.append(
                    f"{p.name}: no response, released after cutoff by policy"
                )


# ------------------------------------------------ A6: guest eligibility

def shared_corridor_stop_ids(route: Route) -> set[str]:
    return {s.id for s in route.stops if any(
        s.index <= last_idx for last_idx in route.corridor_shared_with.values()
    )}


def filter_guests(
    trip: DailyTrip, requests: list[GuestRequest], plan: TripPlan
) -> list[GuestRequest]:
    route = trip.route
    corridor = shared_corridor_stop_ids(route)
    eligible = []
    for g in requests:
        if g.requires_deviation:
            plan.waitlist.append((g.name, "requires route deviation — rejected"))
        elif route.stop_index(g.point_stop) is not None:
            eligible.append(g)
        elif g.point_stop in corridor:
            eligible.append(g)
        elif g.manager_approved:
            eligible.append(g)
        else:
            plan.waitlist.append(
                (g.name, "point not on route or shared corridor — manual review")
            )
    return eligible


# --------------------------------------------------- A7: guest scoring

def guest_score(g: GuestRequest, trip: DailyTrip) -> int:
    route = trip.route
    s = 0
    if g.home_route == route.id:
        s += 100
    if route.stop_index(g.point_stop) is not None:
        s += 80
    elif g.point_stop in shared_corridor_stop_ids(route):
        s += 60
    if g.emergency:
        s += 40
    if g.gender == "F":
        s += 30
    if g.requested_early:
        s += 20
    if g.manager_approved:
        s += 20
    if g.requires_deviation:
        s -= 100
    return s


def rank_guests(guests: list[GuestRequest], trip: DailyTrip) -> list[GuestRequest]:
    return sorted(
        guests,
        key=lambda g: (-guest_score(g, trip), not g.emergency, g.requested_order, g.id),
    )


# ------------------------------------- A5 + A8 + A9: allocation pipeline

def allocate(trip: DailyTrip, guest_requests: list[GuestRequest]) -> TripPlan:
    plan = TripPlan(trip=trip)

    vehicle = resolve_vehicle(trip, plan)  # A3
    plan.vehicle = vehicle
    if vehicle is None:
        return plan

    classify_regulars(trip, plan)  # A4

    available = vehicle.capacity - len(plan.confirmed) - len(plan.reserved)  # A5

    if available < 0:  # A9 step 2: regulars alone exceed capacity
        plan.alerts.append(
            f"BLOCKING capacity alert ({trip.trip_type.value}): "
            f"{len(plan.confirmed) + len(plan.reserved)} regulars need seats but "
            f"vehicle has {vehicle.capacity}. Options: larger vehicle, corridor "
            f"transfer, manager decision. Guest allocation skipped."
        )
        available = 0
        eligible: list[GuestRequest] = list(
            rank_guests(filter_guests(trip, guest_requests, plan), trip)
        )
        for g in eligible:
            plan.waitlist.append((g.name, "no seats — regulars exceed capacity"))
    else:
        eligible = rank_guests(filter_guests(trip, guest_requests, plan), trip)  # A6+A7
        plan.approved_guests = eligible[:available]  # A8
        for g in eligible[available:]:
            plan.waitlist.append((g.name, "no seat available — waitlisted in rank order"))
        if plan.approved_guests and available > len(plan.approved_guests):
            pass  # spare seats simply stay empty

    # A9 step 1 safety-net: shrunken vehicle after approval is handled by
    # re-running allocate(); guests always trimmed from the bottom of the
    # ranking before any regular is touched (regulars are never auto-removed).

    assign_seats(trip, plan, vehicle)  # A10
    return plan


# --------------------------------------------- A10: seat assignment

# Real fleet structures (Toyota Hiace + coasters). seat_layout counts
# PASSENGER seats per row (driver excluded); seats numbered P1..Pn:
#   "12-seated" Hiace (11 pax): P1|Driver / P2-P4 / P5-P7 / P8-P11 → [1,3,3,4]
#   "10-seated" Hiace (9 pax):  P1|Driver / P2-P4 / P5-P6 / P7-P9  → [1,3,2,3]
#   coasters 20-30: rows of 4 (2+2 aisle) with a 5-wide back bench.
KNOWN_LAYOUTS = {9: [1, 3, 2, 3], 10: [1, 3, 3, 3], 11: [1, 3, 3, 4]}


def default_seat_layout(capacity: int) -> list[int]:
    if capacity in KNOWN_LAYOUTS:
        return KNOWN_LAYOUTS[capacity]
    if capacity >= 20:
        k = (capacity - 5) // 4
        if capacity - 5 - 4 * k == 0:
            return [4] * k + [5]
        k2, rem = capacity // 4, capacity % 4
        return [4] * k2 + ([rem] if rem else [])
    rows = [1]
    remaining = capacity - 1
    while remaining > 4:
        rows.append(3)
        remaining -= 3
    if remaining > 0:
        rows.append(remaining)
    return rows


def build_seat_layout(capacity: int, seat_layout: Optional[list[int]] = None) -> list[str]:
    rows = (
        seat_layout
        if seat_layout and sum(seat_layout) == capacity
        else default_seat_layout(capacity)
    )
    return [f"P{i + 1}" for i in range(sum(rows))]  # ordered front -> back


@dataclass
class _Rider:
    name: str
    ptype: str
    stop_index: int  # evening drop-order index of their point
    front_priority: bool
    drop_name: str


def _riders(trip: DailyTrip, plan: TripPlan) -> list[_Rider]:
    route = trip.route
    riders = []
    for p in plan.confirmed + plan.reserved:
        riders.append(_Rider(
            p.name, "Regular", route.stop_index(p.home_stop) or 0,
            p.front_seat_priority,
            next(s.name for s in route.stops if s.id == p.home_stop),
        ))
    for g in plan.approved_guests:
        idx = route.stop_index(g.point_stop)
        stop_name = g.point_stop if idx is None else next(
            s.name for s in route.stops if s.id == g.point_stop
        )
        riders.append(_Rider(
            g.name, "Guest", idx if idx is not None else len(route.stops),
            g.front_seat_priority, stop_name,
        ))
    return riders


def safety_zone(rows: list[int], seats: list[str]) -> list[str]:
    """Women/sick zone: 1st-2nd rows BEHIND the driver row — never P1 beside
    the driver. Coasters (no driver-adjacent bench) use the first two rows."""
    bench_front = len(rows) > 2 and rows[0] <= 2
    start = rows[0] if bench_front else 0
    count = sum(rows[1:3]) if bench_front else sum(rows[0:2])
    return seats[start : start + count]


def assign_seats(trip: DailyTrip, plan: TripPlan, vehicle: Vehicle) -> None:
    rows = default_seat_layout(vehicle.capacity)
    seats = build_seat_layout(vehicle.capacity)
    riders = _riders(trip, plan)
    evening = trip.trip_type is TripType.EVENING_DROPOFF

    # Phase 1 — safety priority (women/sick) into rows 1-2 behind the driver
    # row; never P1 beside the driver (P1 only as a last resort).
    zone = safety_zone(rows, seats)
    bench_front = len(rows) > 2 and rows[0] <= 2
    safety_order = (
        zone
        + [s for s in seats if s not in zone and s != "P1"]
        + (["P1"] if bench_front else [])
    )
    safety = sorted(
        (r for r in riders if r.front_priority),
        key=lambda r: r.stop_index if evening else -r.stop_index,
    )
    rest = [r for r in riders if not r.front_priority]

    taken: list[tuple[str, _Rider, str]] = []
    used: set[str] = set()
    for r in safety:
        seat = next((s for s in safety_order if s not in used), None)
        if seat is None:
            break
        used.add(seat)
        taken.append((seat, r, "Safety priority (rows behind driver)"))
    free = [s for s in seats if s not in used]  # front→back, includes P1

    # Phase 2 — direction rule
    if evening:
        # earlier drop -> closer to front
        rest.sort(key=lambda r: r.stop_index)
        for seat, r in zip(free, rest):
            taken.append((seat, r, f"Drop order: {r.drop_name}"))
    else:
        # morning boarding order = reversed drop order: highest stop_index boards
        # first and sits at the back; last boarder sits nearest the door/front
        rest.sort(key=lambda r: -r.stop_index)  # earliest boarder first
        for seat, r in zip(reversed(free), rest):
            taken.append((seat, r, f"Boards at {r.drop_name}"))

    order = {s: i for i, s in enumerate(seats)}
    taken.sort(key=lambda t: order[t[0]])
    plan.seat_plan = [SeatAssignment(s, r.name, r.ptype, why) for s, r, why in taken]


# ------------------------------------------------------- demo / dry run

def print_plan(plan: TripPlan) -> None:
    trip = plan.trip
    v = plan.vehicle
    print(f"\n=== {trip.route.name} — {trip.trip_type.value} ===")
    if v is None:
        print("  NO VEHICLE:", "; ".join(plan.alerts))
        return
    print(f"  Vehicle: {v.id} ({v.capacity} seats)   "
          f"Regulars going: {len(plan.confirmed)}  reserved: {len(plan.reserved)}  "
          f"absent: {len(plan.absent)}  guests approved: {len(plan.approved_guests)}")
    for a in plan.alerts:
        print(f"  ALERT: {a}")
    print(f"  {'Seat':<14} {'Passenger':<10} {'Type':<8} Reason")
    for s in plan.seat_plan:
        print(f"  {s.seat:<14} {s.name:<10} {s.ptype:<8} {s.reason}")
    empty = v.capacity - len(plan.seat_plan)
    if empty:
        print(f"  ({empty} seat(s) empty)")
    if plan.waitlist:
        print("  Waitlist / rejected:")
        for name, reason in plan.waitlist:
            print(f"    - {name}: {reason}")


def build_demo_route() -> Route:
    stop_names = [
        "Banani 11", "Mahakhali", "Elevated Expressway", "Farmgate",
        "Indira Road", "Manik Mia Avenue", "Asad Gate", "Dhanmondi 27",
        "Sukrabad", "Dhanmondi 32", "Kalabagan", "Labaid", "Science Lab",
        "New Market", "Azimpur", "Dhaka University",
    ]
    stops = [Stop(f"S{i:02d}", n, i) for i, n in enumerate(stop_names)]
    sid = {s.name: s.id for s in stops}

    regulars = [
        Passenger("E001", "Rafi", "M", sid["Farmgate"]),
        Passenger("E002", "Nusrat", "F", sid["Dhanmondi 32"], front_seat_priority=True),
        Passenger("E003", "Hasan", "M", sid["Kalabagan"]),
        Passenger("E004", "Sadia", "F", sid["Labaid"], front_seat_priority=True),
        Passenger("E005", "Tanvir", "M", sid["Science Lab"]),
        Passenger("E006", "Imran", "M", sid["New Market"]),
        Passenger("E007", "Farhana", "F", sid["Azimpur"], front_seat_priority=True),
        Passenger("E008", "Shanto", "M", sid["Azimpur"]),
        Passenger("E009", "Mahmud", "M", sid["Dhaka University"]),
    ]
    return Route(
        id="R-AZI", name="Azimpur ⇄ Banani 11", stops=stops,
        vehicle=Vehicle("CAR-AZI-01", "Hiace 12-seated", 11, "Provider A"),
        route_manager="Employee A", regulars=regulars,
        corridor_shared_with={"R-PAN": 9},  # shared until Dhanmondi 32 (index 9)
    )


def demo() -> None:
    route = build_demo_route()
    sid = {s.name: s.id for s in route.stops}

    morning_attendance = {
        "E001": Status.GOING, "E002": Status.GOING, "E003": Status.NOT_GOING,
        "E004": Status.GOING, "E005": Status.GOING, "E006": Status.GOING,
        "E007": Status.NOT_GOING, "E008": Status.NOT_GOING, "E009": Status.GOING,
    }
    evening_attendance = {
        "E001": Status.GOING, "E002": Status.GOING, "E003": Status.GOING,
        "E004": Status.GOING, "E005": Status.NOT_GOING, "E006": Status.GOING,
        "E007": Status.NOT_GOING, "E008": Status.GOING, "E009": Status.GOING,
    }

    morning_guests = [
        GuestRequest("G101", "Rina", "F", "R-MIR", sid["Kalabagan"], 1),
        GuestRequest("G102", "Adnan", "M", "R-PAN", sid["Dhanmondi 27"], 2),
        GuestRequest("G103", "Joy", "M", "R-NAR", "Narayanganj", 3),
    ]
    evening_guests = [
        GuestRequest("G001", "Tania", "F", "R-PAN", sid["Dhanmondi 32"], 1),
        GuestRequest("G002", "Arif", "M", "R-PAN", sid["Kalabagan"], 2),
        GuestRequest("G003", "Mita", "F", "R-MIR", sid["Labaid"], 3),
        GuestRequest("G004", "Sohan", "M", "R-NAR", sid["Azimpur"], 4,
                     manager_approved=True),
        GuestRequest("G005", "Rumi", "F", "R-PAN", sid["New Market"], 5),
        GuestRequest("G006", "Pavel", "M", "R-NAR", "Narayanganj", 6),
    ]

    print("SCENARIO 1 — normal day, per-trip allocation")
    morning = DailyTrip(route, TripType.MORNING_PICKUP, morning_attendance)
    print_plan(allocate(morning, morning_guests))

    evening = DailyTrip(route, TripType.EVENING_DROPOFF, evening_attendance)
    print_plan(allocate(evening, evening_guests))

    print("\nSCENARIO 2 — temporary vehicle change: CAR-OFF-01 (11 seats), both trips")
    backup = Vehicle("CAR-OFF-01", "Office Micro", 10, "Office Owned")
    morning2 = DailyTrip(route, TripType.MORNING_PICKUP, morning_attendance,
                         temporary_vehicle=backup)
    print_plan(allocate(morning2, morning_guests))
    evening2 = DailyTrip(route, TripType.EVENING_DROPOFF, evening_attendance,
                         temporary_vehicle=backup)
    print_plan(allocate(evening2, evening_guests))


if __name__ == "__main__":
    demo()
