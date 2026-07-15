import type { NextRequest } from "next/server";
import { dbConnect } from "@/lib/db";
import { DriverDelay, Employee, LateNotice } from "@/lib/models";
import { computeTripPlan, getRouteByCode, todayStr } from "@/lib/trips";
import { canManageRoute } from "@/lib/auth";
import { getApiUser, unauthorized } from "@/lib/api-auth";

/** GET /api/routes/R-AZI?date=YYYY-MM-DD — full route card for one date. */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ code: string }> },
) {
  const user = await getApiUser(req);
  if (!user) return unauthorized();
  const { code } = await ctx.params;
  const q = req.nextUrl.searchParams.get("date") ?? "";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(q) ? q : todayStr();

  await dbConnect();
  const route = await getRouteByCode(code.toUpperCase());
  if (!route) return Response.json({ error: "not found" }, { status: 404 });

  const [m, e] = await Promise.all([
    computeTripPlan(route, date, "MORNING_PICKUP"),
    computeTripPlan(route, date, "EVENING_DROPOFF"),
  ]);
  const employees = await Employee.find({
    _id: { $in: route.passengers.map((p) => p.employeeId) },
  });
  const empById = new Map(employees.map((x) => [String(x._id), x]));
  const manager = route.routeManagerId
    ? await Employee.findById(route.routeManagerId)
    : null;
  const [lateM, lateE, delays] = await Promise.all([
    LateNotice.find({ tripId: m.trip._id }),
    LateNotice.find({ tripId: e.trip._id }),
    DriverDelay.find({ routeId: route._id, date }),
  ]);

  const uid = String(user._id);
  const serializeTrip = (t: typeof m, late: typeof lateM, tripType: string) => ({
    tripType,
    cutoff: t.cutoff,
    afterCutoff: t.afterCutoff,
    startsAt: t.startsAt,
    vehicle: t.plan.vehicle,
    alerts: t.plan.alerts,
    blocking: t.plan.blocking,
    openSeats: t.plan.availableSeatsForGuests,
    seatPlan: t.plan.seatPlan,
    waitlist: t.plan.waitlist,
    attendance: t.trip.attendance
      .map((a) => {
        const emp = empById.get(String(a.employeeId));
        if (!emp) return null;
        const onLeave = t.leaveEmployeeIds.includes(String(a.employeeId));
        return {
          employeeId: String(a.employeeId),
          empCode: emp.empCode,
          name: emp.name,
          phone: emp.phone ?? null,
          status: onLeave ? "NOT_GOING" : a.status,
          onLeave,
          isMe: String(a.employeeId) === uid,
        };
      })
      .filter((x) => x !== null),
    guests: t.trip.guestRequests
      .filter((g) => g.status !== "CANCELLED")
      .map((g) => ({
        id: String(g._id),
        name: g.name,
        phone: g.phone ?? null,
        homeRouteCode: g.homeRouteCode,
        pointName: g.pointName,
        managerApproved: g.managerApproved,
        seated: t.plan.approvedGuests.some((a) => a.name === g.name),
        waitReason: t.plan.waitlist.find((w) => w.name === g.name)?.reason ?? null,
      })),
    lateNotices: late.map((n) => ({
      id: String(n._id),
      name: empById.get(String(n.employeeId))?.name ?? "Unknown",
      minutes: n.minutes,
      note: n.note ?? null,
      status: n.status,
      isMe: String(n.employeeId) === uid,
    })),
    driverDelays: delays
      .filter((d) => d.tripType === tripType)
      .map((d) => ({ minutes: d.minutes, note: d.note ?? null, reportedBy: d.reportedBy })),
  });

  return Response.json({
    date,
    route: {
      code: route.code,
      name: route.name,
      manager: manager ? { name: manager.name, phone: manager.phone ?? null } : null,
      stops: [...route.stops]
        .sort((a, b) => a.seq - b.seq)
        .map((s) => ({
          name: s.name,
          seq: s.seq,
          morningTime: s.morningTime ?? null,
          eveningTime: s.eveningTime ?? null,
        })),
    },
    canManage: canManageRoute(user, route),
    isRegular: route.passengers.some((p) => String(p.employeeId) === uid),
    morning: serializeTrip(m, lateM, "MORNING_PICKUP"),
    evening: serializeTrip(e, lateE, "EVENING_DROPOFF"),
  });
}
