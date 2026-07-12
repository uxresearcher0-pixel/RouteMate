import { BarChart3, Sunrise, Sunset } from "lucide-react";
import { dbConnect } from "@/lib/db";
import { DailyTrip, Route, type TripType } from "@/lib/models";
import { todayStr } from "@/lib/trips";
import { requireUser } from "@/lib/auth";
import { Badge, Card } from "@/components/ui";

export const dynamic = "force-dynamic";

const TH = "px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400";
const TD = "px-4 py-2.5 text-sm";

interface Row {
  routeCode: string;
  routeName: string;
  tripType: TripType;
  trips: number;
  going: number;
  notGoing: number;
  noResponse: number;
  guestRequests: number;
  guestApproved: number;
  published: number;
}

function daysAgoStr(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  await requireUser();
  const sp = await searchParams;
  const valid = (s?: string) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null);
  const from = valid(sp.from) ?? daysAgoStr(6);
  const to = valid(sp.to) ?? todayStr();

  await dbConnect();
  const [routes, trips] = await Promise.all([
    Route.find().sort({ code: 1 }),
    DailyTrip.find({ date: { $gte: from, $lte: to } }),
  ]);
  const routeById = new Map(routes.map((r) => [String(r._id), r]));

  const rows = new Map<string, Row>();
  for (const trip of trips) {
    const route = routeById.get(String(trip.routeId));
    if (!route) continue;
    const key = `${route.code}|${trip.tripType}`;
    const row =
      rows.get(key) ??
      ({
        routeCode: route.code,
        routeName: route.name,
        tripType: trip.tripType,
        trips: 0,
        going: 0,
        notGoing: 0,
        noResponse: 0,
        guestRequests: 0,
        guestApproved: 0,
        published: 0,
      } satisfies Row);
    row.trips += 1;
    for (const a of trip.attendance) {
      if (a.status === "GOING") row.going += 1;
      else if (a.status === "NOT_GOING") row.notGoing += 1;
      else row.noResponse += 1;
    }
    const active = trip.guestRequests.filter((g) => g.status !== "CANCELLED");
    row.guestRequests += active.length;
    row.guestApproved += active.filter((g) => g.managerApproved).length;
    if (trip.publishedPlan) row.published += 1;
    rows.set(key, row);
  }
  const sorted = [...rows.values()].sort(
    (a, b) => a.routeCode.localeCompare(b.routeCode) || a.tripType.localeCompare(b.tripType),
  );

  const totals = sorted.reduce(
    (acc, r) => ({
      trips: acc.trips + r.trips,
      going: acc.going + r.going,
      notGoing: acc.notGoing + r.notGoing,
      noResponse: acc.noResponse + r.noResponse,
      guests: acc.guests + r.guestRequests,
    }),
    { trips: 0, going: 0, notGoing: 0, noResponse: 0, guests: 0 },
  );
  const responded = totals.going + totals.notGoing;
  const responseRate =
    responded + totals.noResponse > 0
      ? Math.round((responded / (responded + totals.noResponse)) * 100)
      : 100;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
          <p className="mt-1 text-sm text-slate-500">
            Attendance and guest activity per route and trip direction.
          </p>
        </div>
        <form method="GET" className="flex items-center gap-2 text-sm">
          <input
            type="date"
            name="from"
            defaultValue={from}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs outline-none focus:border-indigo-400"
          />
          <span className="text-slate-400">→</span>
          <input
            type="date"
            name="to"
            defaultValue={to}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs outline-none focus:border-indigo-400"
          />
          <button
            type="submit"
            className="rounded-lg bg-slate-900 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-700"
          >
            Apply
          </button>
        </form>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          { label: "Trips", value: totals.trips },
          { label: "Going marks", value: totals.going },
          { label: "Not-going marks", value: totals.notGoing },
          { label: "No response (no-shows)", value: totals.noResponse },
          { label: "Response rate", value: `${responseRate}%` },
        ].map((s) => (
          <Card key={s.label} className="p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
              {s.label}
            </div>
            <div className="mt-1 text-2xl font-bold tabular-nums">{s.value}</div>
          </Card>
        ))}
      </div>

      <Card className="mt-6 overflow-hidden">
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
          <BarChart3 size={16} className="text-indigo-500" />
          <h2 className="font-bold tracking-tight">
            Per route · {from} → {to}
          </h2>
        </div>
        {sorted.length === 0 ? (
          <p className="p-6 text-sm text-slate-400">
            No trips recorded in this date range yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50/60">
                <tr>
                  <th className={TH}>Route</th>
                  <th className={TH}>Trip</th>
                  <th className={TH}>Days</th>
                  <th className={TH}>Going</th>
                  <th className={TH}>Not going</th>
                  <th className={TH}>No response</th>
                  <th className={TH}>Guest requests</th>
                  <th className={TH}>Manager approved</th>
                  <th className={TH}>Published plans</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sorted.map((r) => (
                  <tr key={`${r.routeCode}-${r.tripType}`} className="hover:bg-slate-50/50">
                    <td className={`${TD} font-semibold`}>{r.routeCode}</td>
                    <td className={TD}>
                      {r.tripType === "MORNING_PICKUP" ? (
                        <Badge color="amber">
                          <Sunrise size={11} />
                          morning
                        </Badge>
                      ) : (
                        <Badge color="purple">
                          <Sunset size={11} />
                          evening
                        </Badge>
                      )}
                    </td>
                    <td className={`${TD} tabular-nums`}>{r.trips}</td>
                    <td className={`${TD} tabular-nums text-emerald-700`}>{r.going}</td>
                    <td className={`${TD} tabular-nums text-rose-700`}>{r.notGoing}</td>
                    <td className={`${TD} tabular-nums text-amber-700`}>{r.noResponse}</td>
                    <td className={`${TD} tabular-nums`}>{r.guestRequests}</td>
                    <td className={`${TD} tabular-nums`}>{r.guestApproved}</td>
                    <td className={`${TD} tabular-nums`}>{r.published}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
