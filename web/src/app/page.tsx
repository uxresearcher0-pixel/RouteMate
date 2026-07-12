import Link from "next/link";
import {
  Armchair, ArrowRight, Bus, Sunrise, Sunset, Users,
} from "lucide-react";
import { dbConnect } from "@/lib/db";
import { Route, type IRoute, type TripType } from "@/lib/models";
import { computeTripPlan, todayStr } from "@/lib/trips";
import type { TripPlan } from "@/lib/allocation";
import { requireUser } from "@/lib/auth";
import { Badge, Card, ProgressBar } from "@/components/ui";
import { AttendanceToggle } from "@/components/attendance-toggle";

export const dynamic = "force-dynamic";

/* ------------------------------------------------- my trip quick card */

function MyTripCard({
  route, date, morning, evening, userId, myStop,
}: {
  route: IRoute;
  date: string;
  morning: { plan: TripPlan; status: string; locked: boolean };
  evening: { plan: TripPlan; status: string; locked: boolean };
  userId: string;
  myStop?: { name: string; morningTime?: string; eveningTime?: string };
}) {
  const trips = [
    {
      tripType: "MORNING_PICKUP" as TripType,
      label: "Morning",
      icon: <Sunrise size={14} className="text-amber-500" />,
      hint: myStop
        ? `${myStop.morningTime ? `pickup ~${myStop.morningTime} · ` : "pickup · "}${myStop.name}`
        : undefined,
      ...morning,
    },
    {
      tripType: "EVENING_DROPOFF" as TripType,
      label: "Evening",
      icon: <Sunset size={14} className="text-indigo-500" />,
      hint: myStop
        ? `${myStop.eveningTime ? `drop ~${myStop.eveningTime} · ` : "drop · "}${myStop.name}`
        : undefined,
      ...evening,
    },
  ];
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 border-b border-slate-100 bg-gradient-to-r from-indigo-50/80 to-white px-4 py-3">
        <h2 className="font-bold tracking-tight">My trip today</h2>
        <Link
          href={`/routes/${route.code}`}
          className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-indigo-600"
        >
          {route.code}
          <ArrowRight size={12} />
        </Link>
      </div>
      <div className="divide-y divide-slate-100">
        {trips.map((t) => (
          <div key={t.tripType} className="flex items-center gap-2 px-4 py-3">
            <span className="flex w-24 items-center gap-1.5 text-sm font-semibold text-slate-600">
              {t.icon}
              {t.label}
            </span>
            <span className="min-w-0 flex-1 truncate text-xs text-slate-400">
              {t.hint ?? `${t.plan.vehicle?.code} · ${t.plan.availableSeatsForGuests} open`}
            </span>
            <AttendanceToggle
              routeCode={route.code}
              date={date}
              tripType={t.tripType}
              employeeId={userId}
              status={t.status as "GOING" | "NOT_GOING" | "NO_RESPONSE"}
              disabled={t.locked}
            />
          </div>
        ))}
      </div>
    </Card>
  );
}

/* --------------------------------------------------- open seats cards */

function OpenSeatsRow({
  label, icon, plan,
}: {
  label: string;
  icon: React.ReactNode;
  plan: TripPlan;
}) {
  const cap = plan.vehicle?.capacity ?? 0;
  const used = plan.confirmed.length + plan.reserved.length + plan.approvedGuests.length;
  const open = Math.max(0, cap - used);
  return (
    <div className="flex-1 rounded-2xl bg-slate-50/80 p-3.5">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {icon}
        {label}
      </div>
      <div className="mt-1.5 flex items-baseline gap-1.5">
        <span
          className={`text-2xl font-bold tabular-nums ${
            open > 0 ? "text-emerald-600" : "text-slate-300"
          }`}
        >
          {open}
        </span>
        <span className="text-xs text-slate-400">open of {cap}</span>
      </div>
      <div className="mt-2">
        <ProgressBar used={used} total={cap} />
      </div>
      {plan.waitlist.length > 0 && (
        <div className="mt-1.5 text-[11px] text-slate-400">
          {plan.waitlist.length} on waitlist
        </div>
      )}
    </div>
  );
}

export default async function Home() {
  const user = await requireUser();
  await dbConnect();
  const date = todayStr();
  const routes = await Route.find({ status: "ACTIVE" }).sort({ code: 1 });

  const cards = await Promise.all(
    routes.map(async (route) => {
      const [m, e] = await Promise.all([
        computeTripPlan(route, date, "MORNING_PICKUP"),
        computeTripPlan(route, date, "EVENING_DROPOFF"),
      ]);
      return { route, m, e };
    }),
  );

  const userId = String(user._id);
  const myCard = cards.find(({ route }) =>
    route.passengers.some((p) => String(p.employeeId) === userId),
  );
  const statusOf = (trip: { attendance: { employeeId: unknown; status: string }[] }) =>
    trip.attendance.find((a) => String(a.employeeId) === userId)?.status ?? "NO_RESPONSE";

  return (
    <div className="mx-auto max-w-xl space-y-6 xl:max-w-6xl">
      <div>
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
          Hi, {user.name.split(" ")[0]} 👋
        </h1>
        <p className="mt-0.5 text-sm text-slate-500">{date} · Banani 11</p>
      </div>

      {myCard && (
        <MyTripCard
          route={myCard.route}
          date={date}
          userId={userId}
          myStop={(() => {
            const seq = myCard.route.passengers.find(
              (p) => String(p.employeeId) === userId,
            )?.stopSeq;
            const s = myCard.route.stops.find((x) => x.seq === seq);
            return s
              ? { name: s.name, morningTime: s.morningTime, eveningTime: s.eveningTime }
              : undefined;
          })()}
          morning={{
            plan: myCard.m.plan,
            status: statusOf(myCard.m.trip),
            locked: myCard.m.afterCutoff && user.role === "EMPLOYEE",
          }}
          evening={{
            plan: myCard.e.plan,
            status: statusOf(myCard.e.trip),
            locked: myCard.e.afterCutoff && user.role === "EMPLOYEE",
          }}
        />
      )}

      <section>
        <div className="flex items-center gap-2">
          <Armchair size={16} className="text-emerald-500" />
          <h2 className="font-bold tracking-tight">Open seats today</h2>
        </div>
        <p className="mt-0.5 text-xs text-slate-400">
          Need a ride on another route? Pick one with open seats and send a guest
          request.
        </p>
        <div className="mt-3 grid gap-3 xl:grid-cols-2">
          {cards.map(({ route, m, e }) => (
            <Card key={route.code} className="p-4 transition hover:shadow-md">
              <div className="flex items-center gap-2">
                <span className="min-w-0 truncate font-bold tracking-tight">
                  {route.name}
                </span>
                <Badge color="slate">{route.code}</Badge>
                <span className="ml-auto flex items-center gap-1 text-xs text-slate-400">
                  <Bus size={13} />
                  {m.plan.vehicle?.code ?? "—"}
                </span>
              </div>
              <div className="mt-3 flex gap-3">
                <OpenSeatsRow
                  label="Morning"
                  icon={<Sunrise size={12} className="text-amber-500" />}
                  plan={m.plan}
                />
                <OpenSeatsRow
                  label="Evening"
                  icon={<Sunset size={12} className="text-indigo-500" />}
                  plan={e.plan}
                />
              </div>
              <Link
                href={`/routes/${route.code}`}
                className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
              >
                Request a seat
                <ArrowRight size={14} />
              </Link>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center gap-2">
          <Users size={16} className="text-slate-400" />
          <h2 className="font-bold tracking-tight">Routes</h2>
        </div>
        <Card className="mt-3 divide-y divide-slate-100">
          {cards.map(({ route, m }) => (
            <Link
              key={route.code}
              href={`/routes/${route.code}`}
              className="flex items-center gap-3 px-4 py-3 transition hover:bg-slate-50/70"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                <Bus size={16} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{route.name}</span>
                <span className="text-xs text-slate-400">
                  {route.passengers.length} regulars · {m.plan.vehicle?.code ?? "no vehicle"}
                </span>
              </span>
              {m.plan.alerts.length > 0 && <Badge color="amber">alert</Badge>}
              <ArrowRight size={15} className="text-slate-300" />
            </Link>
          ))}
        </Card>
      </section>
    </div>
  );
}
