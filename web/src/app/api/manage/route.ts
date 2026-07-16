import type { NextRequest } from "next/server";
import { dbConnect } from "@/lib/db";
import {
  DailyTrip, DriverDelay, LateNotice, Route, type TripType,
} from "@/lib/models";
import { computeTripPlan, ensureTrip } from "@/lib/trips";
import { canManageRoute } from "@/lib/auth";
import { getApiUser, unauthorized } from "@/lib/api-auth";

/** POST /api/manage — trip-level actions for the mobile app.
 *  Body: { op, routeCode, date?, tripType?, ... } — op one of:
 *   guest-approve   { tripId, guestId }      manager/admin: toggle approval
 *   guest-cancel    { tripId, guestId }      manager/admin
 *   publish         { date, tripType }       manager/admin: snapshot seat plan
 *   late-report     { date, tripType, minutes, note? }   regular passenger
 *   late-resolve    { noticeId, status }     manager/admin: ACKNOWLEDGED|REJECTED
 *   driver-delay    { date, tripType, minutes, note? }   manager/admin
 */
export async function POST(req: NextRequest) {
  const user = await getApiUser(req);
  if (!user) return unauthorized();
  const body = await req.json().catch(() => ({}));
  const op = String(body.op ?? "");
  const routeCode = String(body.routeCode ?? "").toUpperCase();

  await dbConnect();
  const route = await Route.findOne({ code: routeCode });
  if (!route) return Response.json({ error: "route not found" }, { status: 404 });

  const manager = canManageRoute(user, route);
  const date = String(body.date ?? "");
  const tripType = String(body.tripType ?? "") as TripType;
  const validTrip =
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    ["MORNING_PICKUP", "EVENING_DROPOFF"].includes(tripType);

  switch (op) {
    case "guest-approve":
    case "guest-cancel": {
      if (!manager) return Response.json({ error: "forbidden" }, { status: 403 });
      const trip = await DailyTrip.findById(String(body.tripId ?? ""));
      if (!trip || String(trip.routeId) !== String(route._id))
        return Response.json({ error: "trip not found" }, { status: 404 });
      const g = trip.guestRequests.find((x) => String(x._id) === String(body.guestId));
      if (!g) return Response.json({ error: "guest not found" }, { status: 404 });
      if (op === "guest-approve") g.managerApproved = !g.managerApproved;
      else g.status = "CANCELLED";
      await trip.save();
      return Response.json({ ok: true, managerApproved: g.managerApproved });
    }

    case "publish": {
      if (!manager) return Response.json({ error: "forbidden" }, { status: 403 });
      if (!validTrip) return Response.json({ error: "bad trip" }, { status: 400 });
      const { plan, trip } = await computeTripPlan(route, date, tripType);
      trip.publishedPlan = {
        at: new Date().toISOString(),
        by: user.name,
        seatPlan: plan.seatPlan.map((s) => ({ ...s })),
        alerts: [...plan.alerts],
      };
      await trip.save();
      return Response.json({ ok: true, publishedAt: trip.publishedPlan.at });
    }

    case "late-report": {
      if (!validTrip) return Response.json({ error: "bad trip" }, { status: 400 });
      const isRegular = route.passengers.some(
        (p) => String(p.employeeId) === String(user._id),
      );
      if (!isRegular && !manager)
        return Response.json({ error: "forbidden" }, { status: 403 });
      const minutes = Math.min(10, Math.max(5, parseInt(String(body.minutes), 10) || 5));
      const trip = await ensureTrip(route, date, tripType);
      await LateNotice.updateOne(
        { tripId: trip._id, employeeId: user._id },
        {
          $set: {
            minutes,
            note: String(body.note ?? "").trim(),
            status: "PENDING",
            createdAt: new Date(),
          },
        },
        { upsert: true },
      );
      return Response.json({ ok: true });
    }

    case "late-resolve": {
      if (!manager) return Response.json({ error: "forbidden" }, { status: 403 });
      const status = body.status === "ACKNOWLEDGED" ? "ACKNOWLEDGED" : "REJECTED";
      await LateNotice.findByIdAndUpdate(String(body.noticeId ?? ""), { status });
      return Response.json({ ok: true, status });
    }

    case "driver-delay": {
      if (!manager) return Response.json({ error: "forbidden" }, { status: 403 });
      if (!validTrip) return Response.json({ error: "bad trip" }, { status: 400 });
      await DriverDelay.create({
        routeId: route._id,
        date,
        tripType,
        minutes: Math.max(1, parseInt(String(body.minutes), 10) || 5),
        note: String(body.note ?? "").trim(),
        reportedBy: user.name,
      });
      return Response.json({ ok: true });
    }

    default:
      return Response.json({ error: "unknown op" }, { status: 400 });
  }
}
