import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft, Bus, CalendarX, CheckCircle2, KeyRound, MapPin, Phone, Shield,
  Sunrise, Sunset,
} from "lucide-react";
import { dbConnect } from "@/lib/db";
import { DailyTrip, Employee, LeaveRecord, Route } from "@/lib/models";
import { todayStr } from "@/lib/trips";
import { requireUser } from "@/lib/auth";
import { changePassword } from "@/app/actions";
import { Avatar, Badge, Card } from "@/components/ui";

export const dynamic = "force-dynamic";

const ROLE_META: Record<string, { label: string; color: "red" | "blue" | "slate" }> = {
  ADMIN: { label: "Admin", color: "red" },
  ROUTE_MANAGER: { label: "Route Manager", color: "blue" },
  EMPLOYEE: { label: "Employee", color: "slate" },
};

export default async function PersonPage({
  params,
  searchParams,
}: {
  params: Promise<{ empCode: string }>;
  searchParams: Promise<{ pw?: string }>;
}) {
  const viewer = await requireUser();
  const { empCode } = await params;
  const { pw } = await searchParams;
  await dbConnect();
  const person = await Employee.findOne({ empCode: empCode.toUpperCase() });
  if (!person) notFound();

  const date = todayStr();
  const route = await Route.findOne({ "passengers.employeeId": person._id });
  const managedRoute = await Route.findOne({ routeManagerId: person._id });
  const stopSeq = route?.passengers.find(
    (p) => String(p.employeeId) === String(person._id),
  )?.stopSeq;
  const stop = route?.stops.find((s) => s.seq === stopSeq);

  const trips = route
    ? await DailyTrip.find({ routeId: route._id, date })
    : [];
  const statusFor = (tripType: string) =>
    trips
      .find((t) => t.tripType === tripType)
      ?.attendance.find((a) => String(a.employeeId) === String(person._id))
      ?.status ?? "NO_RESPONSE";

  const leaves = await LeaveRecord.find({ employeeId: person._id })
    .sort({ dateFrom: -1 })
    .limit(5);
  const onLeaveToday = leaves.some((l) => l.dateFrom <= date && l.dateTo >= date);
  const meta = ROLE_META[person.role] ?? ROLE_META.EMPLOYEE;

  const STATUS_BADGE: Record<string, { label: string; color: "green" | "red" | "amber" }> = {
    GOING: { label: "Going", color: "green" },
    NOT_GOING: { label: "Not going", color: "red" },
    NO_RESPONSE: { label: "No response", color: "amber" },
  };

  return (
    <div className="mx-auto max-w-md">
      <Link
        href={route ? `/routes/${route.code}` : "/"}
        className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-indigo-600"
      >
        <ArrowLeft size={14} />
        Back
      </Link>

      <Card className="mt-3 p-5">
        <div className="flex items-center gap-4">
          <span className="scale-150 pl-1.5">
            <Avatar name={person.name} />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold tracking-tight">{person.name}</h1>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-slate-400">{person.empCode}</span>
              <Badge color={meta.color}>{meta.label}</Badge>
              {person.frontSeatPriority && (
                <Badge color="purple">
                  <Shield size={10} />
                  priority seating
                </Badge>
              )}
              {onLeaveToday && (
                <Badge color="amber">
                  <CalendarX size={10} />
                  on leave today
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div className="mt-5 space-y-3 text-sm">
          <div className="flex items-center gap-2.5">
            <Phone size={15} className="shrink-0 text-slate-400" />
            {person.phone ? (
              <a href={`tel:${person.phone}`} className="font-medium text-indigo-600">
                {person.phone}
              </a>
            ) : (
              <span className="text-slate-400">no contact number</span>
            )}
          </div>
          <div className="flex items-center gap-2.5">
            <Bus size={15} className="shrink-0 text-slate-400" />
            {route ? (
              <Link href={`/routes/${route.code}`} className="font-medium text-indigo-600">
                {route.name} <span className="text-xs text-slate-400">{route.code}</span>
              </Link>
            ) : managedRoute ? (
              <span>
                Manages{" "}
                <Link
                  href={`/routes/${managedRoute.code}`}
                  className="font-medium text-indigo-600"
                >
                  {managedRoute.name}
                </Link>
              </span>
            ) : (
              <span className="text-slate-400">not assigned to a route</span>
            )}
          </div>
          {stop && (
            <div className="flex items-center gap-2.5">
              <MapPin size={15} className="shrink-0 text-slate-400" />
              <span>
                <span className="font-medium">{stop.name}</span>
                {stop.morningTime && (
                  <span className="ml-1.5 text-xs text-amber-600">↑{stop.morningTime}</span>
                )}
                {stop.eveningTime && (
                  <span className="ml-1.5 text-xs text-indigo-500">↓{stop.eveningTime}</span>
                )}
              </span>
            </div>
          )}
        </div>
      </Card>

      {route && (
        <Card className="mt-4 p-5">
          <h2 className="text-sm font-bold tracking-tight">Today · {date}</h2>
          <div className="mt-3 space-y-2.5">
            {(
              [
                ["MORNING_PICKUP", "Morning pickup", <Sunrise key="m" size={14} className="text-amber-500" />],
                ["EVENING_DROPOFF", "Evening drop-off", <Sunset key="e" size={14} className="text-indigo-500" />],
              ] as const
            ).map(([tripType, label, icon]) => {
              const s = STATUS_BADGE[statusFor(tripType)];
              return (
                <div key={tripType} className="flex items-center gap-2 text-sm">
                  {icon}
                  <span className="flex-1 text-slate-600">{label}</span>
                  <Badge color={onLeaveToday ? "amber" : s.color}>
                    {onLeaveToday ? "on leave" : s.label}
                  </Badge>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {String(viewer._id) === String(person._id) && (
        <Card className="mt-4 p-5">
          <h2 className="flex items-center gap-1.5 text-sm font-bold tracking-tight">
            <KeyRound size={14} className="text-slate-400" />
            Change password
          </h2>
          {pw === "done" && (
            <div className="mt-2 flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800 ring-1 ring-inset ring-emerald-200">
              <CheckCircle2 size={14} />
              Password updated.
            </div>
          )}
          {pw === "wrong" && (
            <div className="mt-2 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800 ring-1 ring-inset ring-rose-200">
              Current password is incorrect.
            </div>
          )}
          {pw === "short" && (
            <div className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800 ring-1 ring-inset ring-amber-200">
              New password must be at least 6 characters.
            </div>
          )}
          <form action={changePassword} className="mt-3 space-y-2">
            <input
              type="password"
              name="current"
              required
              autoComplete="current-password"
              placeholder="Current password"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
            <input
              type="password"
              name="next"
              required
              minLength={6}
              autoComplete="new-password"
              placeholder="New password (min 6 characters)"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
            <button
              type="submit"
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              Update password
            </button>
          </form>
        </Card>
      )}

      {leaves.length > 0 && (
        <Card className="mt-4 p-5">
          <h2 className="text-sm font-bold tracking-tight">Leave records</h2>
          <ul className="mt-2 divide-y divide-slate-100 text-sm">
            {leaves.map((l) => (
              <li key={String(l._id)} className="flex items-center gap-2 py-2">
                <CalendarX size={14} className="shrink-0 text-slate-400" />
                <span className="tabular-nums">
                  {l.dateFrom}
                  {l.dateTo !== l.dateFrom && ` → ${l.dateTo}`}
                </span>
                <Badge color="slate">{l.source}</Badge>
                {l.note && <span className="truncate text-xs text-slate-400">{l.note}</span>}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
