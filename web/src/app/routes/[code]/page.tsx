import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle, ArrowLeft, Bus, CheckCircle2, ChevronDown, Lock, Megaphone,
  Route as RouteIcon, Send, Sunrise, Sunset, UserPlus, Users,
} from "lucide-react";
import { dbConnect } from "@/lib/db";
import { Announcement, Employee, type IDailyTrip } from "@/lib/models";
import { computeTripPlan, getRouteByCode, todayStr } from "@/lib/trips";
import type { TripPlan } from "@/lib/allocation";
import type { TripType } from "@/lib/models";
import { canManageRoute, requireUser } from "@/lib/auth";
import {
  addGuestRequest, cancelGuestRequest, createAnnouncement, publishSeatPlan,
  setAttendance, toggleGuestApproval,
} from "@/app/actions";
import { Avatar, Badge, Card, SeatMap, SectionTitle } from "@/components/ui";
import { TripTabs } from "@/components/trip-tabs";

export const dynamic = "force-dynamic";

const INPUT_CLS =
  "w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100";

function AttendanceList({
  routeCode, date, tripType, trip, namesById, currentUserId, canManage, locked,
}: {
  routeCode: string;
  date: string;
  tripType: TripType;
  trip: IDailyTrip;
  namesById: Map<string, { name: string; empCode: string }>;
  currentUserId: string;
  canManage: boolean;
  locked: boolean;
}) {
  return (
    <ul className="divide-y divide-slate-100">
      {trip.attendance.map((a) => {
        const id = String(a.employeeId);
        const emp = namesById.get(id);
        if (!emp) return null;
        const current = a.status;
        const editable = canManage || (id === currentUserId && !locked);
        return (
          <li key={id} className="flex items-center gap-2 py-2">
            <Avatar name={emp.name} size="sm" />
            <div className="min-w-0 flex-1">
              <span className="text-sm font-medium">{emp.name}</span>
              <span className="ml-1.5 text-[11px] text-slate-400">{emp.empCode}</span>
              {id === currentUserId && <Badge color="blue">you</Badge>}
            </div>
            {current === "NO_RESPONSE" && <Badge color="amber">no response</Badge>}
            <div className="flex overflow-hidden rounded-full border border-slate-200 bg-white">
              {(["GOING", "NOT_GOING"] as const).map((s) => (
                <form key={s} action={setAttendance}>
                  <input type="hidden" name="routeCode" value={routeCode} />
                  <input type="hidden" name="date" value={date} />
                  <input type="hidden" name="tripType" value={tripType} />
                  <input type="hidden" name="employeeId" value={id} />
                  <input type="hidden" name="status" value={s} />
                  <button
                    type="submit"
                    disabled={!editable}
                    className={`px-2.5 py-1 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
                      current === s
                        ? s === "GOING"
                          ? "bg-emerald-500 text-white"
                          : "bg-rose-500 text-white"
                        : "text-slate-400 hover:bg-slate-50 hover:text-slate-700"
                    }`}
                  >
                    {s === "GOING" ? "Going" : "Not going"}
                  </button>
                </form>
              ))}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function GuestList({
  routeCode, trip, plan, canManage,
}: {
  routeCode: string;
  trip: IDailyTrip;
  plan: TripPlan;
  canManage: boolean;
}) {
  const activeGuests = trip.guestRequests.filter((g) => g.status !== "CANCELLED");
  const approvedNames = new Set(plan.approvedGuests.map((g) => g.name));
  if (activeGuests.length === 0)
    return <p className="py-2 text-sm text-slate-400">No guest requests yet.</p>;
  return (
    <ul className="divide-y divide-slate-100">
      {activeGuests.map((g) => {
        const waitReason = plan.waitlist.find((w) => w.name === g.name)?.reason;
        const seated = approvedNames.has(g.name);
        return (
          <li key={String(g._id)} className="flex items-center gap-2 py-2">
            <Avatar name={g.name} size="sm" />
            <div className="min-w-0 flex-1">
              <span className="text-sm font-medium">{g.name}</span>
              <div className="truncate text-[11px] text-slate-400">
                {g.homeRouteCode || "no home route"} → {g.pointName}
              </div>
            </div>
            {seated ? (
              <Badge color="green">seat allocated</Badge>
            ) : (
              <Badge color="amber" title={waitReason}>
                {waitReason?.includes("manual review") ? "manual review" : "waitlist"}
              </Badge>
            )}
            {canManage && (
              <>
                <form action={toggleGuestApproval}>
                  <input type="hidden" name="routeCode" value={routeCode} />
                  <input type="hidden" name="tripId" value={String(trip._id)} />
                  <input type="hidden" name="guestId" value={String(g._id)} />
                  <button
                    type="submit"
                    title="Route manager approval (adds score / allows off-route points)"
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${
                      g.managerApproved
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "border border-slate-200 text-slate-400 hover:border-indigo-300 hover:text-indigo-600"
                    }`}
                  >
                    {g.managerApproved ? "Approved ✓" : "Approve"}
                  </button>
                </form>
                <form action={cancelGuestRequest}>
                  <input type="hidden" name="routeCode" value={routeCode} />
                  <input type="hidden" name="tripId" value={String(trip._id)} />
                  <input type="hidden" name="guestId" value={String(g._id)} />
                  <button
                    type="submit"
                    className="rounded-full border border-slate-200 px-2 py-1 text-xs text-slate-400 transition hover:border-rose-300 hover:text-rose-600"
                  >
                    ✕
                  </button>
                </form>
              </>
            )}
            {!canManage && g.managerApproved && <Badge color="blue">approved</Badge>}
          </li>
        );
      })}
    </ul>
  );
}

type StopInfo = { name: string; morningTime?: string; eveningTime?: string };

function GuestForm({
  routeCode, date, tripType, stopInfos,
}: {
  routeCode: string;
  date: string;
  tripType: TripType;
  stopInfos: StopInfo[];
}) {
  return (
    <details className="group mt-1 rounded-xl border border-dashed border-slate-200 open:border-solid open:border-indigo-200 open:bg-indigo-50/30">
      <summary className="flex cursor-pointer items-center gap-1.5 px-3 py-2 text-sm font-semibold text-indigo-600 marker:content-none">
        <UserPlus size={14} />
        Add guest request
        <ChevronDown size={14} className="ml-auto transition group-open:rotate-180" />
      </summary>
      <form action={addGuestRequest} className="grid grid-cols-2 gap-2 p-3 pt-1">
        <input type="hidden" name="routeCode" value={routeCode} />
        <input type="hidden" name="date" value={date} />
        <input type="hidden" name="tripType" value={tripType} />
        <input name="name" required placeholder="Guest name" className={INPUT_CLS} />
        <select name="gender" className={INPUT_CLS}>
          <option value="M">Male</option>
          <option value="F">Female</option>
        </select>
        <input name="homeRouteCode" placeholder="Home route (e.g. R-PAN)" className={INPUT_CLS} />
        <select name="pointName" className={INPUT_CLS}>
          {stopInfos.map((s) => {
            const t = tripType === "MORNING_PICKUP" ? s.morningTime : s.eveningTime;
            return (
              <option key={s.name} value={s.name}>
                {s.name}
                {t ? ` (~${t})` : ""}
              </option>
            );
          })}
        </select>
        <label className="flex items-center gap-1.5 text-xs text-slate-600">
          <input type="checkbox" name="emergency" className="accent-indigo-600" /> Emergency
        </label>
        <label className="flex items-center gap-1.5 text-xs text-slate-600">
          <input type="checkbox" name="frontSeatPriority" className="accent-indigo-600" /> Front-seat priority
        </label>
        <button
          type="submit"
          className="col-span-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
        >
          Submit for {tripType === "MORNING_PICKUP" ? "morning pickup" : "evening drop-off"}
        </button>
      </form>
    </details>
  );
}

function TripPanel({
  label, icon, accent, routeCode, date, tripType, trip, plan, cutoff, afterCutoff,
  namesById, stopInfos, currentUserId, canManage,
}: {
  label: string;
  icon: React.ReactNode;
  accent: string;
  routeCode: string;
  date: string;
  tripType: TripType;
  trip: IDailyTrip;
  plan: TripPlan;
  cutoff: string;
  afterCutoff: boolean;
  namesById: Map<string, { name: string; empCode: string }>;
  stopInfos: StopInfo[];
  currentUserId: string;
  canManage: boolean;
}) {
  const used = plan.confirmed.length + plan.reserved.length + plan.approvedGuests.length;
  const published = trip.publishedPlan;
  const drift =
    published && JSON.stringify(published.seatPlan) !== JSON.stringify(plan.seatPlan);
  return (
    <Card className="overflow-hidden">
      <div className={`flex items-center gap-2 border-b border-slate-100 bg-gradient-to-r px-5 py-3.5 ${accent}`}>
        {icon}
        <h2 className="font-bold tracking-tight">{label}</h2>
        {afterCutoff ? (
          <Badge color="red" title="Self-service attendance is locked; manager/admin can still edit">
            <Lock size={10} />
            locked {cutoff}
          </Badge>
        ) : (
          <Badge color="slate">locks {cutoff}</Badge>
        )}
        <span className="ml-auto text-sm font-semibold tabular-nums">
          {used}/{plan.vehicle?.capacity ?? 0}
          <span className="ml-1 text-xs font-normal opacity-70">seats</span>
        </span>
      </div>

      <div className="space-y-5 p-5">
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
          <Bus size={14} className="text-slate-400" />
          <span className="font-medium text-slate-700">{plan.vehicle?.code ?? "—"}</span>
          · {plan.availableSeatsForGuests} seat(s) open for guests
          <span className="ml-auto flex items-center gap-2">
            {published && (
              <Badge color={drift ? "amber" : "green"} title={`Published by ${published.by}`}>
                <CheckCircle2 size={11} />
                {drift ? "published · outdated" : "published"}{" "}
                {new Date(published.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </Badge>
            )}
            {canManage && (
              <form action={publishSeatPlan}>
                <input type="hidden" name="routeCode" value={routeCode} />
                <input type="hidden" name="date" value={date} />
                <input type="hidden" name="tripType" value={tripType} />
                <button
                  type="submit"
                  className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white transition hover:bg-slate-700"
                >
                  <Send size={11} />
                  {published ? "Republish" : "Publish seat plan"}
                </button>
              </form>
            )}
          </span>
        </div>

        {plan.alerts.map((a) => (
          <div
            key={a}
            className={`flex items-start gap-2 rounded-xl px-3.5 py-2.5 text-sm ${
              plan.blocking
                ? "bg-rose-50 text-rose-800 ring-1 ring-inset ring-rose-200"
                : "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200"
            }`}
          >
            <AlertTriangle size={15} className="mt-0.5 shrink-0" />
            {a}
          </div>
        ))}

        {/* booking first: seats, then guest requests, then attendance */}
        <section>
          <SectionTitle>Seats</SectionTitle>
          <div className="mt-2">
            <SeatMap
              seatPlan={plan.seatPlan}
              capacity={plan.vehicle?.capacity ?? 0}
              layout={plan.vehicle?.seatLayout}
            />
          </div>
        </section>

        <section>
          <SectionTitle>Guest requests</SectionTitle>
          <GuestList routeCode={routeCode} trip={trip} plan={plan} canManage={canManage} />
          <GuestForm
            routeCode={routeCode}
            date={date}
            tripType={tripType}
            stopInfos={stopInfos}
          />
        </section>

        <section>
          <SectionTitle>Regular passengers</SectionTitle>
          <AttendanceList
            routeCode={routeCode}
            date={date}
            tripType={tripType}
            trip={trip}
            namesById={namesById}
            currentUserId={currentUserId}
            canManage={canManage}
            locked={afterCutoff}
          />
        </section>
      </div>
    </Card>
  );
}

export default async function RouteCard({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const user = await requireUser();
  const { code } = await params;
  const sp = await searchParams;
  await dbConnect();
  const route = await getRouteByCode(code.toUpperCase());
  if (!route) notFound();

  const date = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? "") ? sp.date! : todayStr();
  const canManage = canManageRoute(user, route);

  const [morning, evening] = await Promise.all([
    computeTripPlan(route, date, "MORNING_PICKUP"),
    computeTripPlan(route, date, "EVENING_DROPOFF"),
  ]);

  const employees = await Employee.find({
    _id: { $in: route.passengers.map((p) => p.employeeId) },
  });
  const namesById = new Map(
    employees.map((e) => [String(e._id), { name: e.name, empCode: e.empCode }]),
  );
  const manager = route.routeManagerId
    ? await Employee.findById(route.routeManagerId)
    : null;
  const announcements = await Announcement.find({
    $or: [{ routeId: route._id }, { routeId: null }, { routeId: { $exists: false } }],
  })
    .sort({ createdAt: -1 })
    .limit(3);

  const stops = [...route.stops].sort((a, b) => a.seq - b.seq);
  const currentUserId = String(user._id);

  const panelProps = {
    routeCode: route.code,
    date,
    namesById,
    stopInfos: stops.map((s) => ({
      name: s.name,
      morningTime: s.morningTime,
      eveningTime: s.eveningTime,
    })),
    currentUserId,
    canManage,
  };

  return (
    <div>
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-indigo-600"
      >
        <ArrowLeft size={14} />
        Dashboard
      </Link>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight">{route.name}</h1>
          <Badge color="slate">{route.code}</Badge>
        </div>
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <Users size={14} className="text-slate-400" />
            Manager: <span className="font-medium text-slate-700">{manager?.name ?? "—"}</span>
          </span>
          <form method="GET" className="flex items-center gap-1.5">
            <input
              type="date"
              name="date"
              defaultValue={date}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs outline-none focus:border-indigo-400"
            />
            <button
              type="submit"
              className="rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white hover:bg-slate-700"
            >
              Go
            </button>
          </form>
        </div>
      </div>

      <details className="group mt-4 rounded-2xl border border-slate-200/70 bg-white shadow-sm">
        <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-sm font-semibold text-slate-600 marker:content-none">
          <RouteIcon size={14} className="shrink-0 text-slate-400" />
          Route &amp; stops
          <span className="ml-1 text-xs font-normal text-slate-400">
            {stops.length} stops
          </span>
          <ChevronDown size={14} className="ml-auto text-slate-400 transition group-open:rotate-180" />
        </summary>
        <div className="px-4 pb-4 text-xs leading-relaxed text-slate-500">
          <span className="font-semibold uppercase tracking-wide text-slate-400">
            Evening drop order · morning boards in reverse
          </span>
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            {stops.map((s, i) => (
              <span key={s.seq} className="inline-flex items-center gap-1">
                <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-medium text-slate-600">
                  {s.name}
                  {s.morningTime && (
                    <span className="ml-1 font-normal text-amber-600">
                      ↑{s.morningTime}
                    </span>
                  )}
                  {s.eveningTime && (
                    <span className="ml-1 font-normal text-indigo-500">
                      ↓{s.eveningTime}
                    </span>
                  )}
                </span>
                {i < stops.length - 1 && <span className="text-slate-300">→</span>}
              </span>
            ))}
          </div>
          <p className="mt-1.5 text-[10px] text-slate-400">
            ↑ approx morning pickup · ↓ approx evening drop
          </p>
        </div>
      </details>

      {announcements.length > 0 && (
        <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4 text-sm">
          <Megaphone size={16} className="mt-0.5 shrink-0 text-indigo-500" />
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-indigo-900">{announcements[0].title}</div>
            <div className="mt-0.5 text-indigo-800/80">{announcements[0].body}</div>
          </div>
        </div>
      )}

      {canManage && (
        <details className="group mt-3 rounded-2xl border border-dashed border-slate-200 open:border-solid open:bg-white">
          <summary className="flex cursor-pointer items-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-slate-500 marker:content-none hover:text-indigo-600">
            <Megaphone size={14} />
            Send announcement to this route
            <ChevronDown size={14} className="ml-auto transition group-open:rotate-180" />
          </summary>
          <form action={createAnnouncement} className="grid gap-2 p-4 pt-1">
            <input type="hidden" name="routeCode" value={route.code} />
            <input name="title" required placeholder="Title" className={INPUT_CLS} />
            <textarea name="body" required placeholder="Message" rows={2} className={INPUT_CLS} />
            <button
              type="submit"
              className="justify-self-start rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              Send
            </button>
          </form>
        </details>
      )}

      <div className="mt-6">
        <TripTabs
          morning={
            <TripPanel
              label="Morning Pickup"
              icon={<Sunrise size={17} className="text-amber-600" />}
              accent="from-amber-50 to-white"
              tripType="MORNING_PICKUP"
              trip={morning.trip}
              plan={morning.plan}
              cutoff={morning.cutoff}
              afterCutoff={morning.afterCutoff}
              {...panelProps}
            />
          }
          evening={
            <TripPanel
              label="Evening Drop-off"
              icon={<Sunset size={17} className="text-indigo-600" />}
              accent="from-indigo-50 to-white"
              tripType="EVENING_DROPOFF"
              trip={evening.trip}
              plan={evening.plan}
              cutoff={evening.cutoff}
              afterCutoff={evening.afterCutoff}
              {...panelProps}
            />
          }
        />
      </div>
    </div>
  );
}
