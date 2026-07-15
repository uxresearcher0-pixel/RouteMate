import type { NextRequest } from "next/server";
import { Types } from "mongoose";
import { dbConnect } from "@/lib/db";
import { Route, type AttendanceStatus, type TripType } from "@/lib/models";
import { cutoffInfo, ensureTrip } from "@/lib/trips";
import { canManageRoute } from "@/lib/auth";
import { getApiUser, unauthorized } from "@/lib/api-auth";

/** POST { routeCode, date, tripType, employeeId?, status } — same rules as the
 *  web action: self-service before cutoff; managers/admin anytime, anyone. */
export async function POST(req: NextRequest) {
  const user = await getApiUser(req);
  if (!user) return unauthorized();
  const body = await req.json().catch(() => ({}));
  const routeCode = String(body.routeCode ?? "");
  const date = String(body.date ?? "");
  const tripType = String(body.tripType ?? "") as TripType;
  const employeeId = String(body.employeeId ?? user._id);
  const status = String(body.status ?? "") as AttendanceStatus;

  if (!["GOING", "NOT_GOING", "NO_RESPONSE"].includes(status))
    return Response.json({ error: "bad status" }, { status: 400 });
  if (!["MORNING_PICKUP", "EVENING_DROPOFF"].includes(tripType))
    return Response.json({ error: "bad tripType" }, { status: 400 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
    return Response.json({ error: "bad date" }, { status: 400 });

  await dbConnect();
  const route = await Route.findOne({ code: routeCode.toUpperCase() });
  if (!route) return Response.json({ error: "route not found" }, { status: 404 });

  const manager = canManageRoute(user, route);
  const self = String(user._id) === employeeId;
  if (!self && !manager) return Response.json({ error: "forbidden" }, { status: 403 });
  const { afterCutoff, cutoff } = cutoffInfo(route, date, tripType);
  if (afterCutoff && !manager)
    return Response.json(
      { error: `locked — plan changes closed at ${cutoff}` },
      { status: 409 },
    );

  const trip = await ensureTrip(route, date, tripType);
  const row = trip.attendance.find((a) => String(a.employeeId) === employeeId);
  if (row) row.status = status;
  else trip.attendance.push({ employeeId: new Types.ObjectId(employeeId), status });
  await trip.save();

  return Response.json({ ok: true, status });
}
