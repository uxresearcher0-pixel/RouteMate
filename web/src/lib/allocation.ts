/**
 * Transport allocation algorithm — TypeScript port of ALGORITHM.md
 * (reference implementation: algorithm/transport_allocation.py).
 *
 * Pure module: no database or framework imports. Callers map Mongoose
 * documents to the plain input types below and render the returned plan.
 */

export type TripType = "MORNING_PICKUP" | "EVENING_DROPOFF";
export type AttendanceStatus = "GOING" | "NOT_GOING" | "NO_RESPONSE";

export interface RegularInput {
  id: string;
  name: string;
  gender: "F" | "M";
  stopSeq: number; // evening drop-order index of home stop
  stopName: string;
  frontSeatPriority: boolean;
  status: AttendanceStatus;
}

export interface GuestInput {
  id: string;
  name: string;
  gender: "F" | "M";
  homeRouteCode: string;
  pointName: string; // boarding point (morning) / drop point (evening)
  requestedAt: number; // epoch ms — lower = earlier
  emergency: boolean;
  frontSeatPriority: boolean;
  managerApproved: boolean;
  requiresDeviation: boolean;
  requestedEarly: boolean;
}

export interface TripInput {
  routeCode: string;
  routeName: string;
  tripType: TripType;
  stops: { name: string; seq: number }[]; // evening drop order
  corridorStopNames: string[]; // stops shared with overlapping routes
  vehicle: {
    code: string;
    capacity: number;
    seatLayout?: number[];
    driverName?: string;
    driverPhone?: string;
  } | null;
  originalVehicleCode?: string; // set when a temporary replacement is active
  afterCutoff: boolean;
  policyAfterCutoff: "KEEP_RESERVED" | "MANAGER_RELEASE";
  regulars: RegularInput[];
  guests: GuestInput[];
}

export interface SeatRow {
  seat: string;
  name: string;
  ptype: "Regular" | "Guest";
  reason: string;
}

export interface ScoredGuest extends GuestInput {
  score: number;
}

export interface TripPlan {
  tripType: TripType;
  vehicle: TripInput["vehicle"];
  alerts: string[];
  blocking: boolean;
  confirmed: RegularInput[];
  reserved: RegularInput[];
  absent: RegularInput[];
  approvedGuests: ScoredGuest[];
  waitlist: { name: string; reason: string }[];
  seatPlan: SeatRow[];
  availableSeatsForGuests: number;
  emptySeats: number;
}

/* ----------------------------------------------- A4: classify regulars */

function classifyRegulars(input: TripInput, plan: TripPlan): void {
  for (const p of input.regulars) {
    if (p.status === "GOING") plan.confirmed.push(p);
    else if (p.status === "NOT_GOING") plan.absent.push(p);
    else {
      // NO_RESPONSE — never auto-released before cutoff
      if (!input.afterCutoff || input.policyAfterCutoff === "KEEP_RESERVED") {
        plan.reserved.push(p);
      } else {
        plan.absent.push(p);
        plan.alerts.push(`${p.name}: no response, released after cutoff by policy`);
      }
    }
  }
}

/* ------------------------------------------------ A6: guest eligibility */

function stopSeqByName(input: TripInput, name: string): number | null {
  const s = input.stops.find((x) => x.name === name);
  return s ? s.seq : null;
}

function filterGuests(input: TripInput, plan: TripPlan): GuestInput[] {
  const eligible: GuestInput[] = [];
  for (const g of input.guests) {
    if (g.requiresDeviation) {
      plan.waitlist.push({ name: g.name, reason: "requires route deviation — rejected" });
    } else if (stopSeqByName(input, g.pointName) !== null) {
      eligible.push(g);
    } else if (input.corridorStopNames.includes(g.pointName)) {
      eligible.push(g);
    } else if (g.managerApproved) {
      eligible.push(g);
    } else {
      plan.waitlist.push({
        name: g.name,
        reason: "point not on route or shared corridor — manual review",
      });
    }
  }
  return eligible;
}

/* --------------------------------------------------- A7: guest scoring */

export function guestScore(g: GuestInput, input: TripInput): number {
  let s = 0;
  if (g.homeRouteCode === input.routeCode) s += 100;
  if (stopSeqByName(input, g.pointName) !== null) s += 80;
  else if (input.corridorStopNames.includes(g.pointName)) s += 60;
  if (g.emergency) s += 40;
  if (g.gender === "F") s += 30;
  if (g.requestedEarly) s += 20;
  if (g.managerApproved) s += 20;
  if (g.requiresDeviation) s -= 100;
  return s;
}

function rankGuests(guests: GuestInput[], input: TripInput): ScoredGuest[] {
  return guests
    .map((g) => ({ ...g, score: guestScore(g, input) }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        Number(b.emergency) - Number(a.emergency) ||
        a.requestedAt - b.requestedAt ||
        a.id.localeCompare(b.id),
    );
}

/* --------------------------------------------- A10: seat assignment
 *
 * Seat structure model: a vehicle has `seatLayout` — PASSENGER seats per
 * row, front→back (the driver is not a passenger seat). Capacity counts
 * passenger seats only. Fleet reality (Toyota Hiace + coasters):
 *
 *   "12-seated" Hiace (11 passengers):   P1|Driver / P2-P4 / P5-P7 / P8-P11
 *     → [1,3,3,4]
 *   "10-seated" Hiace (9 passengers):    P1|Driver / P2-P4 / P5-P6 / P7-P9
 *     → [1,3,2,3]
 *   coasters 20-30: rows of 4 (2+2 aisle) with a 5-wide back bench.
 *
 * Seats are numbered P1..Pn front→back; P1 sits beside the driver
 * (first pick for safety-priority passengers).                          */

const KNOWN_LAYOUTS: Record<number, number[]> = {
  9: [1, 3, 2, 3], // "10-seated" Hiace
  10: [1, 3, 3, 3],
  11: [1, 3, 3, 4], // "12-seated" Hiace
};

export function defaultSeatLayout(capacity: number): number[] {
  if (KNOWN_LAYOUTS[capacity]) return KNOWN_LAYOUTS[capacity];
  if (capacity >= 20) {
    // coaster: rows of 4 (2+2 aisle), back bench of 5 when it fits
    const k = Math.floor((capacity - 5) / 4);
    if (capacity - 5 - 4 * k === 0) return [...Array<number>(k).fill(4), 5];
    const k2 = Math.floor(capacity / 4);
    const rem = capacity - 4 * k2;
    return rem === 0 ? Array<number>(k2).fill(4) : [...Array<number>(k2).fill(4), rem];
  }
  // generic small vehicle: 1 front seat beside driver, rows of 3, back row ≤4
  const rows = [1];
  let remaining = capacity - 1;
  while (remaining > 4) {
    rows.push(3);
    remaining -= 3;
  }
  if (remaining > 0) rows.push(remaining);
  return rows;
}

/** Resolve the row structure for a vehicle: explicit layout if it matches
 *  capacity, otherwise the capacity-derived default. */
export function resolveSeatRows(capacity: number, seatLayout?: number[]): number[] {
  if (
    seatLayout &&
    seatLayout.length > 0 &&
    seatLayout.reduce((a, b) => a + b, 0) === capacity
  ) {
    return seatLayout;
  }
  return defaultSeatLayout(capacity);
}

/** Seat labels grouped by row (front→back), numbered P1..Pn, e.g. for
 *  [1,3,3,4]: [[P1], [P2,P3,P4], [P5,P6,P7], [P8,P9,P10,P11]] */
export function seatRowGroups(rows: number[]): string[][] {
  let n = 0;
  return rows.map((size) =>
    Array.from({ length: size }, () => `P${++n}`),
  );
}

export function buildSeatLayout(rows: number[]): string[] {
  return seatRowGroups(rows).flat(); // ordered front -> back
}

interface Rider {
  name: string;
  ptype: "Regular" | "Guest";
  stopSeq: number;
  frontPriority: boolean;
  stopName: string;
}

/** Safety-priority zone: women / sick passengers sit in the 1st-2nd rows
 *  BEHIND the driver row — never on P1 beside the driver. (For coasters,
 *  which have no driver-adjacent bench, the zone is simply the first two
 *  passenger rows.) Entrance is from the left, so lower seat numbers in a
 *  row are closest to the door. */
function safetyZone(rows: number[], groups: string[][]): string[] {
  const benchFront = rows.length > 2 && rows[0] <= 2;
  return (benchFront ? groups.slice(1, 3) : groups.slice(0, 2)).flat();
}

function assignSeats(input: TripInput, plan: TripPlan, capacity: number): void {
  const rows = resolveSeatRows(capacity, input.vehicle?.seatLayout);
  const groups = seatRowGroups(rows);
  const seats = groups.flat();
  const riders: Rider[] = [
    ...[...plan.confirmed, ...plan.reserved].map((p) => ({
      name: p.name,
      ptype: "Regular" as const,
      stopSeq: p.stopSeq,
      frontPriority: p.frontSeatPriority,
      stopName: p.stopName,
    })),
    ...plan.approvedGuests.map((g) => {
      const seq = stopSeqByName(input, g.pointName);
      return {
        name: g.name,
        ptype: "Guest" as const,
        stopSeq: seq ?? input.stops.length,
        frontPriority: g.frontSeatPriority,
        stopName: g.pointName,
      };
    }),
  ];

  const evening = input.tripType === "EVENING_DROPOFF";

  // Phase 1 — safety priority (women/sick) into rows 1-2 behind the driver
  // row; never P1 beside the driver. Overflow continues into later rows,
  // and P1 is only ever a last resort.
  const zone = safetyZone(rows, groups);
  const safetyOrder = [
    ...zone,
    ...seats.filter((s) => !zone.includes(s) && s !== "P1"),
    ...(rows.length > 2 && rows[0] <= 2 ? ["P1"] : []),
  ];
  const safety = riders
    .filter((r) => r.frontPriority)
    .sort((a, b) => (evening ? a.stopSeq - b.stopSeq : b.stopSeq - a.stopSeq));
  const rest = riders.filter((r) => !r.frontPriority);

  const taken: { seat: string; rider: Rider; reason: string }[] = [];
  const used = new Set<string>();
  for (const r of safety) {
    const seat = safetyOrder.find((s) => !used.has(s));
    if (!seat) break;
    used.add(seat);
    taken.push({ seat, rider: r, reason: "Safety priority (rows behind driver)" });
  }
  const free = seats.filter((s) => !used.has(s)); // front→back, includes P1

  // Phase 2 — direction rule
  if (evening) {
    // earlier drop -> closer to front (earliest drop may take P1)
    rest.sort((a, b) => a.stopSeq - b.stopSeq);
    rest.forEach((r, i) => {
      if (i < free.length)
        taken.push({ seat: free[i], rider: r, reason: `Drop order: ${r.stopName}` });
    });
  } else {
    // morning boarding order = reversed drop order: farthest stop boards first
    // and sits at the back; last boarder sits nearest the front/door
    rest.sort((a, b) => b.stopSeq - a.stopSeq); // earliest boarder first
    const reversedFree = [...free].reverse();
    rest.forEach((r, i) => {
      if (i < reversedFree.length)
        taken.push({ seat: reversedFree[i], rider: r, reason: `Boards at ${r.stopName}` });
    });
  }

  const order = new Map(seats.map((s, i) => [s, i]));
  taken.sort((a, b) => (order.get(a.seat) ?? 0) - (order.get(b.seat) ?? 0));
  plan.seatPlan = taken.map((t) => ({
    seat: t.seat,
    name: t.rider.name,
    ptype: t.rider.ptype,
    reason: t.reason,
  }));
  plan.emptySeats = capacity - plan.seatPlan.length;
}

/* ------------------------------------- pipeline: A3..A10 for one trip */

export function allocate(input: TripInput): TripPlan {
  const plan: TripPlan = {
    tripType: input.tripType,
    vehicle: input.vehicle,
    alerts: [],
    blocking: false,
    confirmed: [],
    reserved: [],
    absent: [],
    approvedGuests: [],
    waitlist: [],
    seatPlan: [],
    availableSeatsForGuests: 0,
    emptySeats: 0,
  };

  // A3 — vehicle resolution happens in the data layer; here we only report it
  if (!input.vehicle) {
    plan.alerts.push("BLOCKING: assigned vehicle unavailable and no replacement set");
    plan.blocking = true;
    return plan;
  }
  if (input.originalVehicleCode && input.originalVehicleCode !== input.vehicle.code) {
    plan.alerts.push(
      `Temporary vehicle ${input.vehicle.code} in effect (replaces ${input.originalVehicleCode})`,
    );
  }

  classifyRegulars(input, plan); // A4

  // A5
  let available =
    input.vehicle.capacity - plan.confirmed.length - plan.reserved.length;

  if (available < 0) {
    // A9 step 2 — regulars alone exceed capacity; guests are never seated,
    // regulars are never auto-removed.
    plan.blocking = true;
    plan.alerts.push(
      `BLOCKING capacity alert: ${plan.confirmed.length + plan.reserved.length} regulars ` +
        `need seats but vehicle ${input.vehicle.code} has ${input.vehicle.capacity}. ` +
        `Options: larger vehicle, corridor transfer, manager decision. Guest allocation skipped.`,
    );
    available = 0;
    const eligible = rankGuests(filterGuests(input, plan), input);
    for (const g of eligible) {
      plan.waitlist.push({ name: g.name, reason: "no seats — regulars exceed capacity" });
    }
  } else {
    const eligible = rankGuests(filterGuests(input, plan), input); // A6 + A7
    plan.approvedGuests = eligible.slice(0, available); // A8
    for (const g of eligible.slice(available)) {
      plan.waitlist.push({
        name: g.name,
        reason: "no seat available — waitlisted in rank order",
      });
    }
  }
  plan.availableSeatsForGuests = available;

  // A9 step 1 (shrunken vehicle after approval) is handled by idempotent
  // re-run: this function is recomputed from current data on every read,
  // so the ranking naturally trims the lowest-scored guests first.

  assignSeats(input, plan, input.vehicle.capacity); // A10
  return plan;
}
