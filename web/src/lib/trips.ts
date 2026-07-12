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
  Route,
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

/** A2/A4 — cutoff state for a trip: self-service attendance locks after the
 *  trip's cutoff time on its date (managers/admin can still override). */
export function cutoffInfo(
  route: IRoute,
  date: string,
  tripType: TripType,
): { cutoff: string; afterCutoff: boolean } {
  const cutoff =
    tripType === "MORNING_PICKUP" ? route.morningCutoff : route.eveningCutoff;
  const cutoffAt = new Date(`${date}T${cutoff}:00`);
  return { cutoff, afterCutoff: Number.isFinite(cutoffAt.getTime()) ? new Date() > cutoffAt : false };
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
}> {
  await dbConnect();
  const trip = await ensureTrip(route, date, tripType);
  const { vehicle, original } = await resolveVehicle(route, date);
  const { cutoff, afterCutoff } = cutoffInfo(route, date, tripType);

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
          status: statusByEmp.get(String(p.employeeId)) ?? "NO_RESPONSE",
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

  return { plan: allocate(input), trip, cutoff, afterCutoff };
}

export async function getRouteByCode(code: string): Promise<RouteDoc | null> {
  await dbConnect();
  return Route.findOne({ code });
}
