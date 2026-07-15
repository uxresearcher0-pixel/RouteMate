import type { NextRequest } from "next/server";
import { dbConnect } from "@/lib/db";
import { Route, type TripType } from "@/lib/models";
import { ensureTrip } from "@/lib/trips";
import { getApiUser, unauthorized } from "@/lib/api-auth";

/** POST { routeCode, date, tripType, pointName, name?, phone?, gender? } —
 *  defaults to the signed-in user requesting a seat for themselves. */
export async function POST(req: NextRequest) {
  const user = await getApiUser(req);
  if (!user) return unauthorized();
  const body = await req.json().catch(() => ({}));
  const routeCode = String(body.routeCode ?? "");
  const date = String(body.date ?? "");
  const tripType = String(body.tripType ?? "") as TripType;
  const pointName = String(body.pointName ?? "").trim();
  const name = String(body.name ?? user.name).trim();

  if (!pointName || !name)
    return Response.json({ error: "missing point or name" }, { status: 400 });
  if (!["MORNING_PICKUP", "EVENING_DROPOFF"].includes(tripType))
    return Response.json({ error: "bad tripType" }, { status: 400 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
    return Response.json({ error: "bad date" }, { status: 400 });

  await dbConnect();
  const route = await Route.findOne({ code: routeCode.toUpperCase() });
  if (!route) return Response.json({ error: "route not found" }, { status: 404 });

  const trip = await ensureTrip(route, date, tripType);
  trip.guestRequests.push({
    name,
    gender: (body.gender === "F" || (body.gender == null && user.gender === "F") ? "F" : "M") as "F" | "M",
    phone: String(body.phone ?? user.phone ?? "").trim(),
    homeRouteCode: String(body.homeRouteCode ?? "").trim(),
    pointName,
    emergency: Boolean(body.emergency),
    frontSeatPriority: Boolean(body.frontSeatPriority ?? user.frontSeatPriority),
    managerApproved: false,
    requiresDeviation: false,
    requestedAt: new Date(),
    status: "PENDING",
  } as never);
  await trip.save();

  return Response.json({ ok: true });
}
