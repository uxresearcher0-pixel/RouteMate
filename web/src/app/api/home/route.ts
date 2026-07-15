import type { NextRequest } from "next/server";
import { dbConnect } from "@/lib/db";
import { Route } from "@/lib/models";
import { computeTripPlan, todayStr } from "@/lib/trips";
import type { TripPlan } from "@/lib/allocation";
import { getApiUser, unauthorized } from "@/lib/api-auth";

function tripSummary(plan: TripPlan, cutoff: string, afterCutoff: boolean, startsAt: string | null) {
  const cap = plan.vehicle?.capacity ?? 0;
  const used = plan.confirmed.length + plan.reserved.length + plan.approvedGuests.length;
  return {
    vehicle: plan.vehicle?.code ?? null,
    capacity: cap,
    used,
    open: Math.max(0, cap - used),
    waitlist: plan.waitlist.length,
    alerts: plan.alerts,
    cutoff,
    afterCutoff,
    startsAt,
  };
}

/** GET /api/home?date=YYYY-MM-DD — all active routes with per-trip summaries
 *  plus the caller's own attendance for their route. */
export async function GET(req: NextRequest) {
  const user = await getApiUser(req);
  if (!user) return unauthorized();
  const q = req.nextUrl.searchParams.get("date") ?? "";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(q) ? q : todayStr();

  await dbConnect();
  const routes = await Route.find({ status: "ACTIVE" }).sort({ code: 1 });
  const uid = String(user._id);

  const items = await Promise.all(
    routes.map(async (route) => {
      const [m, e] = await Promise.all([
        computeTripPlan(route, date, "MORNING_PICKUP"),
        computeTripPlan(route, date, "EVENING_DROPOFF"),
      ]);
      const mine = route.passengers.some((p) => String(p.employeeId) === uid);
      const myStatus = (t: typeof m) =>
        t.trip.attendance.find((a) => String(a.employeeId) === uid)?.status ?? "NO_RESPONSE";
      const stopSeq = route.passengers.find((p) => String(p.employeeId) === uid)?.stopSeq;
      const stop = route.stops.find((s) => s.seq === stopSeq);
      return {
        code: route.code,
        name: route.name,
        regulars: route.passengers.length,
        mine,
        myStop: mine && stop
          ? { name: stop.name, morningTime: stop.morningTime ?? null, eveningTime: stop.eveningTime ?? null }
          : null,
        morning: {
          ...tripSummary(m.plan, m.cutoff, m.afterCutoff, m.startsAt),
          myStatus: mine ? (m.leaveEmployeeIds.includes(uid) ? "ON_LEAVE" : myStatus(m)) : null,
        },
        evening: {
          ...tripSummary(e.plan, e.cutoff, e.afterCutoff, e.startsAt),
          myStatus: mine ? (e.leaveEmployeeIds.includes(uid) ? "ON_LEAVE" : myStatus(e)) : null,
        },
      };
    }),
  );

  return Response.json({ date, routes: items });
}
