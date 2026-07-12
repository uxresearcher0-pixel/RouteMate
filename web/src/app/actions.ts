"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { Types } from "mongoose";
import { dbConnect } from "@/lib/db";
import {
  Announcement, DailyTrip, Employee, Provider, Route, TemporaryVehicleChange,
  Vehicle, type TripType, type AttendanceStatus,
} from "@/lib/models";
import { computeTripPlan, cutoffInfo, ensureTrip } from "@/lib/trips";
import { canManageRoute, getCurrentUser, isAdmin, SESSION_COOKIE } from "@/lib/auth";

/* ---------------------------------------------------------- session */

export async function login(formData: FormData): Promise<void> {
  const employeeId = String(formData.get("employeeId"));
  await dbConnect();
  if (!Types.ObjectId.isValid(employeeId)) return;
  const emp = await Employee.findById(employeeId);
  if (!emp) return;
  const store = await cookies();
  store.set(SESSION_COOKIE, String(emp._id), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  redirect("/");
}

export async function logout(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect("/login");
}

/* -------------------------------------------------- attendance (A2) */

export async function setAttendance(formData: FormData): Promise<void> {
  const routeCode = String(formData.get("routeCode"));
  const date = String(formData.get("date"));
  const tripType = String(formData.get("tripType")) as TripType;
  const employeeId = String(formData.get("employeeId"));
  const status = String(formData.get("status")) as AttendanceStatus;

  const user = await getCurrentUser();
  if (!user) return;
  await dbConnect();
  const route = await Route.findOne({ code: routeCode });
  if (!route) return;

  const manager = canManageRoute(user, route);
  const self = String(user._id) === employeeId;
  if (!self && !manager) return; // employees may only set their own status
  const { afterCutoff } = cutoffInfo(route, date, tripType);
  if (afterCutoff && !manager) return; // locked for self-service after cutoff

  const trip = await ensureTrip(route, date, tripType);
  const row = trip.attendance.find((a) => String(a.employeeId) === employeeId);
  if (row) row.status = status;
  else trip.attendance.push({ employeeId: new Types.ObjectId(employeeId), status });
  await trip.save();

  revalidatePath(`/routes/${routeCode}`);
  revalidatePath("/");
}

/* ------------------------------------------------ guest requests (A6) */

export async function addGuestRequest(formData: FormData): Promise<void> {
  const routeCode = String(formData.get("routeCode"));
  const date = String(formData.get("date"));
  const tripType = String(formData.get("tripType")) as TripType;

  const name = String(formData.get("name") ?? "").trim();
  const pointName = String(formData.get("pointName") ?? "").trim();
  if (!name || !pointName) return;
  const user = await getCurrentUser();
  if (!user) return;

  await dbConnect();
  const route = await Route.findOne({ code: routeCode });
  if (!route) return;
  const trip = await ensureTrip(route, date, tripType);

  trip.guestRequests.push({
    name,
    gender: (formData.get("gender") === "F" ? "F" : "M") as "F" | "M",
    homeRouteCode: String(formData.get("homeRouteCode") ?? "").trim(),
    pointName,
    emergency: formData.get("emergency") === "on",
    frontSeatPriority: formData.get("frontSeatPriority") === "on",
    managerApproved: false,
    requiresDeviation: false,
    requestedAt: new Date(),
    status: "PENDING",
  } as never);
  await trip.save();

  revalidatePath(`/routes/${routeCode}`);
}

export async function toggleGuestApproval(formData: FormData): Promise<void> {
  const routeCode = String(formData.get("routeCode"));
  const tripId = String(formData.get("tripId"));
  const guestId = String(formData.get("guestId"));

  const user = await getCurrentUser();
  if (!user) return;
  await dbConnect();
  const route = await Route.findOne({ code: routeCode });
  if (!route || !canManageRoute(user, route)) return; // manager/admin only

  const trip = await DailyTrip.findById(tripId);
  if (!trip) return;
  const g = trip.guestRequests.find((x) => String(x._id) === guestId);
  if (g) {
    g.managerApproved = !g.managerApproved;
    await trip.save();
  }
  revalidatePath(`/routes/${routeCode}`);
}

export async function cancelGuestRequest(formData: FormData): Promise<void> {
  const routeCode = String(formData.get("routeCode"));
  const tripId = String(formData.get("tripId"));
  const guestId = String(formData.get("guestId"));

  const user = await getCurrentUser();
  if (!user) return;
  await dbConnect();
  const route = await Route.findOne({ code: routeCode });
  if (!route || !canManageRoute(user, route)) return;

  const trip = await DailyTrip.findById(tripId);
  if (!trip) return;
  const g = trip.guestRequests.find((x) => String(x._id) === guestId);
  if (g) {
    g.status = "CANCELLED";
    await trip.save();
  }
  revalidatePath(`/routes/${routeCode}`);
}

/* -------------------------------------------- publish seat plan (A10) */

export async function publishSeatPlan(formData: FormData): Promise<void> {
  const routeCode = String(formData.get("routeCode"));
  const date = String(formData.get("date"));
  const tripType = String(formData.get("tripType")) as TripType;

  const user = await getCurrentUser();
  if (!user) return;
  await dbConnect();
  const route = await Route.findOne({ code: routeCode });
  if (!route || !canManageRoute(user, route)) return;

  const { plan, trip } = await computeTripPlan(route, date, tripType);
  trip.publishedPlan = {
    at: new Date().toISOString(),
    by: user.name,
    seatPlan: plan.seatPlan.map((s) => ({ ...s })),
    alerts: [...plan.alerts],
  };
  await trip.save();

  revalidatePath(`/routes/${routeCode}`);
}

/* ------------------------------------- temporary vehicle change (A3) */

export async function createTempVehicleChange(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user)) return;

  const routeCode = String(formData.get("routeCode"));
  const vehicleCode = String(formData.get("vehicleCode"));
  const dateFrom = String(formData.get("dateFrom"));
  const dateTo = String(formData.get("dateTo") || dateFrom);
  const reason = String(formData.get("reason") ?? "");

  await dbConnect();
  const route = await Route.findOne({ code: routeCode });
  const vehicle = await Vehicle.findOne({ code: vehicleCode });
  if (!route || !vehicle || !dateFrom) return;

  await TemporaryVehicleChange.create({
    routeId: route._id, vehicleId: vehicle._id, dateFrom, dateTo, reason,
  });

  revalidatePath(`/routes/${routeCode}`);
  revalidatePath("/admin");
  revalidatePath("/");
}

export async function removeTempVehicleChange(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user)) return;
  await dbConnect();
  await TemporaryVehicleChange.findByIdAndDelete(String(formData.get("id")));
  revalidatePath("/admin");
  revalidatePath("/");
}

/* ------------------------------------------------------ announcements */

export async function createAnnouncement(formData: FormData): Promise<void> {
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const routeCode = String(formData.get("routeCode") ?? "").trim();
  if (!title || !body) return;

  const user = await getCurrentUser();
  if (!user) return;
  await dbConnect();

  let routeId: Types.ObjectId | undefined;
  if (routeCode) {
    const route = await Route.findOne({ code: routeCode });
    if (!route || !canManageRoute(user, route)) return;
    routeId = route._id;
  } else if (!isAdmin(user)) {
    return; // org-wide announcements are admin-only
  }

  await Announcement.create({ routeId, title, body });
  revalidatePath("/admin");
  if (routeCode) revalidatePath(`/routes/${routeCode}`);
}

/* -------------------------------------------------------- admin CRUD */

export async function createProvider(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user)) return;
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  await dbConnect();
  await Provider.updateOne(
    { name },
    { $setOnInsert: { name, phone: String(formData.get("phone") ?? "").trim() } },
    { upsert: true },
  );
  revalidatePath("/admin");
}

function parseLayout(text: string, capacity: number): number[] {
  const rows = text
    .split(/[-,/\s]+/)
    .map((x) => parseInt(x, 10))
    .filter((n) => Number.isFinite(n) && n > 0);
  return rows.reduce((a, b) => a + b, 0) === capacity ? rows : [];
}

export async function createVehicle(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user)) return;
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const type = String(formData.get("type") ?? "").trim() || "Microbus";
  const capacity = parseInt(String(formData.get("capacity")), 10);
  const providerId = String(formData.get("providerId"));
  if (!code || !Number.isFinite(capacity) || capacity < 1) return;
  if (!Types.ObjectId.isValid(providerId)) return;

  await dbConnect();
  await Vehicle.updateOne(
    { code },
    {
      $setOnInsert: { code },
      $set: {
        type,
        capacity,
        seatLayout: parseLayout(String(formData.get("seatLayout") ?? ""), capacity),
        providerId: new Types.ObjectId(providerId),
        driverName: String(formData.get("driverName") ?? "").trim(),
        driverPhone: String(formData.get("driverPhone") ?? "").trim(),
      },
    },
    { upsert: true },
  );
  revalidatePath("/admin");
  revalidatePath("/");
}

export async function createEmployee(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user)) return;
  const empCode = String(formData.get("empCode") ?? "").trim().toUpperCase();
  const name = String(formData.get("name") ?? "").trim();
  if (!empCode || !name) return;
  await dbConnect();
  await Employee.updateOne(
    { empCode },
    {
      $setOnInsert: { empCode },
      $set: {
        name,
        gender: formData.get("gender") === "F" ? "F" : "M",
        role: ["ADMIN", "ROUTE_MANAGER", "EMPLOYEE"].includes(String(formData.get("role")))
          ? String(formData.get("role"))
          : "EMPLOYEE",
        frontSeatPriority: formData.get("frontSeatPriority") === "on",
      },
    },
    { upsert: true },
  );
  revalidatePath("/admin");
}

export async function createRoute(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user)) return;
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const name = String(formData.get("name") ?? "").trim();
  const vehicleId = String(formData.get("vehicleId"));
  const managerId = String(formData.get("managerId") ?? "");
  // one stop per line: "Name" or "Name | 07:20" or "Name | 07:20 | 18:05"
  const stops = String(formData.get("stops") ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((line, seq) => {
      const [stopName, morningTime, eveningTime] = line
        .split("|")
        .map((x) => x.trim());
      return {
        name: stopName,
        seq,
        morningTime: morningTime || undefined,
        eveningTime: eveningTime || undefined,
      };
    })
    .filter((s) => s.name);
  if (!code || !name || stops.length < 2 || !Types.ObjectId.isValid(vehicleId)) return;

  await dbConnect();
  const exists = await Route.findOne({ code });
  if (exists) return;
  await Route.create({
    code,
    name,
    vehicleId: new Types.ObjectId(vehicleId),
    routeManagerId: Types.ObjectId.isValid(managerId)
      ? new Types.ObjectId(managerId)
      : undefined,
    stops,
    corridors: [],
    passengers: [],
  });
  revalidatePath("/admin");
  revalidatePath("/");
}

export async function assignPassenger(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user)) return;
  const employeeId = String(formData.get("employeeId"));
  const target = String(formData.get("target") ?? ""); // "R-AZI:3" = route:stopSeq
  const [routeCode, seqStr] = target.split(":");
  const stopSeq = parseInt(seqStr, 10);
  if (!Types.ObjectId.isValid(employeeId) || !routeCode || !Number.isFinite(stopSeq)) return;

  await dbConnect();
  const employee = await Employee.findById(employeeId);
  const route = await Route.findOne({ code: routeCode });
  if (!employee || !route || !route.stops.some((s) => s.seq === stopSeq)) return;

  // one route per employee: remove any existing assignment first
  await Route.updateMany(
    { "passengers.employeeId": employee._id },
    { $pull: { passengers: { employeeId: employee._id } } },
  );
  await Route.updateOne(
    { _id: route._id },
    { $push: { passengers: { employeeId: employee._id, stopSeq } } },
  );
  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath(`/routes/${routeCode}`);
}

export async function removeAssignment(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user)) return;
  const employeeId = String(formData.get("employeeId"));
  if (!Types.ObjectId.isValid(employeeId)) return;
  await dbConnect();
  await Route.updateMany(
    { "passengers.employeeId": new Types.ObjectId(employeeId) },
    { $pull: { passengers: { employeeId: new Types.ObjectId(employeeId) } } },
  );
  revalidatePath("/admin");
  revalidatePath("/");
}
