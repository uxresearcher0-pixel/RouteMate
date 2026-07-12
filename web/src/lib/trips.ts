/**
 * Data-access layer between Mongoose documents and the pure allocation
 * module. Implements A1 (lazy daily-trip creation) and A3 (vehicle
 * resolution incl. temporary replacement), then maps to TripInput.
 */
import type { HydratedDocument } from "mongoose";
import { dbConnect } from "./db";
import {
  DailyTrip,
  Employee,
  LeaveRecord,
  Route,
  Setting,
  TemporaryVehicleChange,
  Vehicle,
  type IDailyTrip,
  type IRoute,
  type IVehicle,
  type TripType,
} from "./models";
import { allocate, type TripInput, type TripPlan } from "./allocation";

export type DailyTripDoc = HydratedDocument<IDailyTrip>;
export type RouteDoc = HydratedDocument<IRoute>;
export type VehicleDoc = HydratedDocument<IVehicle>;

export function todayStr(): string {
  // Local date in Dhaka-style YYYY-MM-DD (uses server-local timezone)
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** A1 — get or create the DailyTrip for (route, date, tripType) with
 *  NO_RESPONSE attendance rows for every current regular passenger. */
export async function ensureTrip(
  route: IRoute,
  date: string,
  tripType: TripType,
): Promise<DailyTripDoc> {
  await dbConnect();
  let trip = await DailyTrip.findOne({ routeId: route._id, date, tripType });
  if (!trip) {
    trip = await DailyTrip.create({
      routeId: route._id,
      date,
      tripType,
      attendance: route.passengers.map((p) => ({
        employeeId: p.employeeId,
        status: "NO_RESPONSE",
      })),
      guestRequests: [],
    });
  } else {
    // keep attendance rows in sync when regulars were added after creation
    const known = new Set(trip.attendance.map((a) => String(a.employeeId)));
    const missing = route.passengers.filter((p) => !known.has(String(p.employeeId)));
    if (missing.length > 0) {
      trip.attendance.push(
        ...missing.map((p) => ({ employeeId: p.employeeId, status: "NO_RESPONSE" as const })),
      );
      await trip.save();
    }
  }
  return trip;
}

/** A3 — resolve the effective vehicle for a route on a date. */
export async function resolveVehicle(
  route: IRoute,
  date: string,
): Promise<{ vehicle: VehicleDoc | null; original: VehicleDoc | null }> {
  await dbConnect();
  const original = await Vehicle.findById(route.vehicleId);
  const change = await TemporaryVehicleChange.findOne({
    routeId: route._id,
    dateFrom: { $lte: date },
    dateTo: { $gte: date },
  });
  if (change) {
    const replacement = await Vehicle.findById(change.vehicleId);
    return { vehicle: replacement, original };
  }
  if (original && original.status !== "ACTIVE") return { vehicle: null, original };
  return { vehicle: original, original };
}

/** First HH:MM inside a time string ("07:25–07:28" → 07:25). */
function parseFirstTime(s?: string): { h: number; m: number } | null {
  const m = s?.match(/([01]?\d|2[0-3]):([0-5]\d)/);
  return m ? { h: parseInt(m[1], 10), m: parseInt(m[2], 10) } : null;
}

/** Trip start time: morning = earliest stop pickup time (farthest stop boards
 *  first); evening = office departure (stop seq 0), falling back to the
 *  earliest evening time. Null when the route has no stop times. */
export function tripStartTime(
  route: IRoute,
  tripType: TripType,
): { h: number; m: number } | null {
  if (tripType === "MORNING_PICKUP") {
    const times = route.stops
      .map((s) => parseFirstTime(s.morningTime))
      .filter((t) => t !== null);
    if (times.length === 0) return null;
    return times.reduce((a, b) => (a.h * 60 + a.m <= b.h * 60 + b.m ? a : b));
  }
  const office = route.stops.find((s) => s.seq === 0);
  const t = parseFirstTime(office?.eveningTime);
  if (t) return t;
  const times = route.stops
    .map((s) => parseFirstTime(s.eveningTime))
    .filter((x) => x !== null);
  if (times.length === 0) return null;
  return times.reduce((a, b) => (a.h * 60 + a.m <= b.h * 60 + b.m ? a : b));
}

/** A2/A4 — cutoff state for a trip. Passengers may change their plan until
 *  10 minutes before the micro starts (derived from stop times); if the
 *  route has no stop times, the route's fixed cutoffs apply. After the
 *  cutoff, self-service locks — managers/admin can still override. */
export function cutoffInfo(
  route: IRoute,
  date: string,
  tripType: TripType,
): { cutoff: string; afterCutoff: boolean; startsAt: string | null } {
  const start = tripStartTime(route, tripType);
  let cutoff: string;
  let startsAt: string | null = null;
  if (start) {
    const total = start.h * 60 + start.m - 10; // plan changes close 10 min before start
    const h = Math.max(0, Math.floor(total / 60));
    const m = ((total % 60) + 60) % 60;
    cutoff = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    startsAt = `${String(start.h).padStart(2, "0")}:${String(start.m).padStart(2, "0")}`;
  } else {
    cutoff = tripType === "MORNING_PICKUP" ? route.morningCutoff : route.eveningCutoff;
  }
  const cutoffAt = new Date(`${date}T${cutoff}:00`);
  return {
    cutoff,
    afterCutoff: Number.isFinite(cutoffAt.getTime()) ? new Date() > cutoffAt : false,
    startsAt,
  };
}

/** Stops shared with overlapping corridor routes (by this route's corridor links). */
function corridorStopNames(route: IRoute): string[] {
  if (route.corridors.length === 0) return [];
  const maxShared = Math.max(...route.corridors.map((c) => c.lastSharedSeq));
  return route.stops.filter((s) => s.seq <= maxShared).map((s) => s.name);
}

/** Map DB state to the pure allocation input and compute the plan. */
export async function computeTripPlan(
  route: IRoute,
  date: string,
  tripType: TripType,
): Promise<{
  plan: TripPlan;
  trip: DailyTripDoc;
  cutoff: string;
  afterCutoff: boolean;
  startsAt: string | null;
  leaveEmployeeIds: string[];
}> {
  await dbConnect();
  const trip = await ensureTrip(route, date, tripType);
  const { vehicle, original } = await resolveVehicle(route, date);
  const { cutoff, afterCutoff, startsAt } = cutoffInfo(route, date, tripType);

  // HRM leave sync: when enabled, passengers on leave for this date are
  // auto-marked Not Going for both trips (attendance stays manual otherwise).
  const syncSetting = await Setting.findOne({ key: "hrmLeaveSync" });
  const hrmSyncEnabled = syncSetting ? Boolean(syncSetting.value) : true;
  let leaveEmployeeIds: string[] = [];
  if (hrmSyncEnabled) {
    const leaves = await LeaveRecord.find({
      employeeId: { $in: route.passengers.map((p) => p.employeeId) },
      dateFrom: { $lte: date },
      dateTo: { $gte: date },
    });
    leaveEmployeeIds = leaves.map((l) => String(l.employeeId));
  }
  const onLeave = new Set(leaveEmployeeIds);

  const employees = await Employee.find({
    _id: { $in: route.passengers.map((p) => p.employeeId) },
  });
  const empById = new Map(employees.map((e) => [String(e._id), e]));
  const stopBySeq = new Map(route.stops.map((s) => [s.seq, s.name]));
  const statusByEmp = new Map(
    trip.attendance.map((a) => [String(a.employeeId), a.status]),
  );

  const input: TripInput = {
    routeCode: route.code,
    routeName: route.name,
    tripType,
    stops: route.stops.map((s) => ({ name: s.name, seq: s.seq })),
    corridorStopNames: corridorStopNames(route),
    vehicle: vehicle
      ? {
          code: vehicle.code,
          capacity: vehicle.capacity,
          seatLayout: vehicle.seatLayout?.length ? vehicle.seatLayout : undefined,
          driverName: vehicle.driverName,
          driverPhone: vehicle.driverPhone,
        }
      : null,
    originalVehicleCode: original?.code,
    // KEEP_RESERVED policy: unresponsive regulars stay reserved even after
    // cutoff; the lock only affects who may edit attendance (see actions).
    afterCutoff,
    policyAfterCutoff: "KEEP_RESERVED",
    regulars: route.passengers
      .map((p) => {
        const e = empById.get(String(p.employeeId));
        if (!e) return null;
        return {
          id: e.empCode,
          name: e.name,
          gender: e.gender,
          stopSeq: p.stopSeq,
          stopName: stopBySeq.get(p.stopSeq) ?? `Stop ${p.stopSeq}`,
          frontSeatPriority: e.frontSeatPriority,
          status: onLeave.has(String(p.employeeId))
            ? ("NOT_GOING" as const)
            : (statusByEmp.get(String(p.employeeId)) ?? "NO_RESPONSE"),
        };
      })
      .filter((x) => x !== null),
    guests: trip.guestRequests
      .filter((g) => g.status !== "CANCELLED")
      .map((g) => ({
        id: String(g._id),
        name: g.name,
        gender: g.gender,
        homeRouteCode: g.homeRouteCode,
        pointName: g.pointName,
        requestedAt: g.requestedAt.getTime(),
        emergency: g.emergency,
        frontSeatPriority: g.frontSeatPriority,
        managerApproved: g.managerApproved,
        requiresDeviation: g.requiresDeviation,
        requestedEarly: true,
      })),
  };

  return { plan: allocate(input), trip, cutoff, afterCutoff, startsAt, leaveEmployeeIds };
}

export async function getRouteByCode(code: string): Promise<RouteDoc | null> {
  await dbConnect();
  return Route.findOne({ code });
}
