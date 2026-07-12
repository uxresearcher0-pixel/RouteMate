import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle, ArrowLeft, Bus, CheckCircle2, ChevronDown, Clock3, Lock,
  Megaphone, Phone, Route as RouteIcon, Send, Sunrise, Sunset, Timer,
  UserPlus, Users,
} from "lucide-react";
import { dbConnect } from "@/lib/db";
import {
  Announcement, DriverDelay, Employee, LateNotice, type IDailyTrip,
} from "@/lib/models";
import { computeTripPlan, getRouteByCode, todayStr } from "@/lib/trips";
import type { TripPlan } from "@/lib/allocation";
import type { TripType } from "@/lib/models";
import { canManageRoute, requireUser } from "@/lib/auth";
import {
  addGuestRequest, cancelGuestRequest, createAnnouncement, publishSeatPlan,
  reportDriverDelay, reportLate, resolveLateNotice, toggleGuestApproval,
} from "@/app/actions";
import { Avatar, Badge, Card, SeatMap, SectionTitle } from "@/components/ui";
import { TripTabs } from "@/components/trip-tabs";
import { AttendanceToggle } from "@/components/attendance-toggle";
import { SubmitButton } from "@/components/pending";

export const dynamic = "force-dynamic";

const INPUT_CLS =
  "w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100";

type EmpInfo = { name: string; empCode: string; phone?: string };

function AttendanceList({
  routeCode, date, tripType, trip, namesById, currentUserId, canManage, locked, leaveIds,
}: {
  routeCode: string;
  date: string;
  tripType: TripType;
  trip: IDailyTrip;
  namesById: Map<string, EmpInfo>;
  currentUserId: string;
  canManage: boolean;
  locked: boolean;
  leaveIds: string[];
}) {
  const onLeave = new Set(leaveIds);
  return (
    <ul className="divide-y divide-slate-100">
      {trip.attendance.map((a) => {
        const id = String(a.employeeId);
        const emp = namesById.get(id);
        if (!emp) return null;
        const leave = onLeave.has(id);
        const current = leave ? "NOT_GOING" : a.status;
        const editable = !leave && (canManage || (id === currentUserId && !locked));
        return (
          <li key={id} className="flex items-center gap-2 py-2">
            <Link href={`/people/${emp.empCode}`} title="Open profile">
              <Avatar name={emp.name} size="sm" />
            </Link>
            <div className="min-w-0 flex-1">
              <Link
                href={`/people/${emp.empCode}`}
                className="text-sm font-medium hover:text-indigo-600"
              >
                {emp.name}
              </Link>
              {id === currentUserId && <Badge color="blue">you</Badge>}
              <div className="text-[11px] text-slate-400">
                {emp.phone ? (
                  <a href={`tel:${emp.phone}`} className="hover:text-indigo-600">
                    {emp.phone}
                  </a>
                ) : (
                  emp.empCode
                )}
              </div>
            </div>
            {leave && <Badge color="amber">on leave (HRM)</Badge>}
            {!leave && current === "NO_RESPONSE" && <Badge color="amber">no response</Badge>}
            <AttendanceToggle
              routeCode={routeCode}
              date={date}
              tripType={tripType}
              employeeId={id}
              status={current}
              disabled={!editable}
              compact
            />
          </li>
        );
      })}
    </ul>
  );
}

/* --------------------------------------------- running-late notices */

type LateInfo = {
  id: string;
  employeeId: string;
  minutes: number;
  note?: string;
  status: string;
};

function LateSection({
  routeCode, date, tripType, lateNotices, namesById, currentUserId, canManage, isRegular,
}: {
  routeCode: string;
  date: string;
  tripType: TripType;
  lateNotices: LateInfo[];
  namesById: Map<string, EmpInfo>;
  currentUserId: string;
  canManage: boolean;
  isRegular: boolean;
}) {
  const mine = lateNotices.find((n) => n.employeeId === currentUserId);
  const STATUS_COLOR: Record<string, "amber" | "green" | "red"> = {
    PENDING: "amber",
    ACKNOWLEDGED: "green",
    REJECTED: "red",
  };
  return (
    <section>
      <SectionTitle>Running late</SectionTitle>
      {lateNotices.length === 0 && (
        <p className="py-1.5 text-sm text-slate-400">No late notices for this trip.</p>
      )}
      {lateNotices.length > 0 && (
        <ul className="divide-y divide-slate-100">
          {lateNotices.map((n) => {
            const emp = namesById.get(n.employeeId);
            return (
              <li key={n.id} className="flex items-center gap-2 py-2 text-sm">
                <Timer size={14} className="shrink-0 text-amber-500" />
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-medium">{emp?.name ?? "Unknown"}</span>
                  <span className="text-slate-500"> · ~{n.minutes} min late</span>
                  {n.note && <span className="text-xs text-slate-400"> — {n.note}</span>}
                </span>
                <Badge color={STATUS_COLOR[n.status] ?? "slate"}>
                  {n.status.toLowerCase()}
                </Badge>
                {canManage && n.status === "PENDING" && (
                  <span className="flex gap-1">
                    {(["ACKNOWLEDGED", "REJECTED"] as const).map((s) => (
                      <form key={s} action={resolveLateNotice}>
                        <input type="hidden" name="routeCode" value={routeCode} />
                        <input type="hidden" name="noticeId" value={n.id} />
                        <input type="hidden" name="status" value={s} />
                        <SubmitButton
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                            s === "ACKNOWLEDGED"
                              ? "bg-emerald-500 text-white hover:bg-emerald-600"
                              : "border border-slate-200 text-slate-400 hover:border-rose-300 hover:text-rose-600"
                          }`}
                          title={
                            s === "ACKNOWLEDGED"
                              ? "Hold briefly (5-10 min max)"
                              : "The micro must start"
                          }
                        >
                          {s === "ACKNOWLEDGED" ? "Hold" : "Can't wait"}
                        </SubmitButton>
                      </form>
                    ))}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {isRegular && !mine && (
        <form action={reportLate} className="mt-1 flex items-center gap-2">
          <input type="hidden" name="routeCode" value={routeCode} />
          <input type="hidden" name="date" value={date} />
          <input type="hidden" name="tripType" value={tripType} />
          <Clock3 size={14} className="shrink-0 text-slate-400" />
          <select name="minutes" className={INPUT_CLS} style={{ maxWidth: 110 }}>
            <option value="5">~5 min</option>
            <option value="10">~10 min</option>
          </select>
          <input name="note" placeholder="Optional note" className={INPUT_CLS} />
          <SubmitButton className="shrink-0 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600">
            I&apos;m late
          </SubmitButton>
        </form>
      )}
      <p className="mt-1.5 text-[11px] text-slate-400">
        Only 5–10 minutes can be held — beyond that the micro must start.
      </p>
    </section>
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
                {g.phone && (
                  <>
                    {" · "}
                    <a href={`tel:${g.phone}`} className="hover:text-indigo-600">
                      {g.phone}
                    </a>
                  </>
                )}
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
                  <SubmitButton
                    title="Route manager approval (adds score / allows off-route points)"
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      g.managerApproved
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "border border-slate-200 text-slate-400 hover:border-indigo-300 hover:text-indigo-600"
                    }`}
                  >
                    {g.managerApproved ? "Approved ✓" : "Approve"}
                  </SubmitButton>
                </form>
                <form action={cancelGuestRequest}>
                  <input type="hidden" name="routeCode" value={routeCode} />
                  <input type="hidden" name="tripId" value={String(trip._id)} />
                  <input type="hidden" name="guestId" value={String(g._id)} />
                  <SubmitButton className="rounded-full border border-slate-200 px-2 py-1 text-xs text-slate-400 hover:border-rose-300 hover:text-rose-600">
                    ✕
                  </SubmitButton>
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
        <input name="phone" placeholder="Contact number" className={INPUT_CLS} />
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
        <SubmitButton className="col-span-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700">
          Submit for {tripType === "MORNING_PICKUP" ? "morning pickup" : "evening drop-off"}
        </SubmitButton>
      </form>
    </details>
  );
}

type DelayInfo = { id: string; minutes: number; note?: string; reportedBy: string };

function TripPanel({
  label, icon, accent, routeCode, date, tripType, trip, plan, cutoff, afterCutoff,
  startsAt, leaveIds, lateNotices, driverDelays, namesById, stopInfos,
  currentUserId, canManage, isRegular,
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
  startsAt: string | null;
  leaveIds: string[];
  lateNotices: LateInfo[];
  driverDelays: DelayInfo[];
  namesById: Map<string, EmpInfo>;
  stopInfos: StopInfo[];
  currentUserId: string;
  canManage: boolean;
  isRegular: boolean;
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
        {startsAt && <Badge color="slate">starts ~{startsAt}</Badge>}
        {afterCutoff ? (
          <Badge color="red" title="Plan changes closed 10 min before start; manager/admin can still edit">
            <Lock size={10} />
            locked {cutoff}
          </Badge>
        ) : (
          <Badge color="green" title="You can change your plan until 10 min before the micro starts">
            changes until {cutoff}
          </Badge>
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
          {plan.vehicle?.driverName && (
            <span className="inline-flex items-center gap-1">
              · {plan.vehicle.driverName}
              {plan.vehicle.driverPhone && (
                <a
                  href={`tel:${plan.vehicle.driverPhone}`}
                  className="inline-flex items-center gap-0.5 font-medium text-indigo-600"
                >
                  <Phone size={11} />
                  {plan.vehicle.driverPhone}
                </a>
              )}
            </span>
          )}
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
                <SubmitButton className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-700">
                  <Send size={11} />
                  {published ? "Republish" : "Publish seat plan"}
                </SubmitButton>
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

        {driverDelays.map((d) => (
          <div
            key={d.id}
            className="flex items-start gap-2 rounded-xl bg-orange-50 px-3.5 py-2.5 text-sm text-orange-800 ring-1 ring-inset ring-orange-200"
          >
            <Timer size={15} className="mt-0.5 shrink-0" />
            Driver running ~{d.minutes} min late to the first stop
            {d.note && <span className="text-orange-700/80"> — {d.note}</span>}
            <span className="ml-auto shrink-0 text-xs text-orange-600/70">
              by {d.reportedBy}
            </span>
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
              arrangement={plan.vehicle?.seatArrangement}
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
            leaveIds={leaveIds}
          />
        </section>

        <LateSection
          routeCode={routeCode}
          date={date}
          tripType={tripType}
          lateNotices={lateNotices}
          namesById={namesById}
          currentUserId={currentUserId}
          canManage={canManage}
          isRegular={isRegular}
        />

        {canManage && (
          <details className="group rounded-xl border border-dashed border-slate-200 open:border-solid open:bg-orange-50/30">
            <summary className="flex cursor-pointer items-center gap-1.5 px-3 py-2 text-sm font-semibold text-slate-500 marker:content-none hover:text-orange-600">
              <Timer size={14} />
              Report driver delay
              <ChevronDown size={14} className="ml-auto transition group-open:rotate-180" />
            </summary>
            <form action={reportDriverDelay} className="flex items-center gap-2 p-3 pt-1">
              <input type="hidden" name="routeCode" value={routeCode} />
              <input type="hidden" name="date" value={date} />
              <input type="hidden" name="tripType" value={tripType} />
              <input
                type="number"
                name="minutes"
                min={1}
                defaultValue={10}
                className={INPUT_CLS}
                style={{ maxWidth: 90 }}
              />
              <input name="note" placeholder="Reason (e.g. traffic)" className={INPUT_CLS} />
              <SubmitButton className="shrink-0 rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-600">
                Report
              </SubmitButton>
            </form>
          </details>
        )}
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
    employees.map((e) => [
      String(e._id),
      { name: e.name, empCode: e.empCode, phone: e.phone },
    ]),
  );
  const manager = route.routeManagerId
    ? await Employee.findById(route.routeManagerId)
    : null;

  const [morningLate, eveningLate, delays] = await Promise.all([
    LateNotice.find({ tripId: morning.trip._id }).sort({ createdAt: 1 }),
    LateNotice.find({ tripId: evening.trip._id }).sort({ createdAt: 1 }),
    DriverDelay.find({ routeId: route._id, date }).sort({ createdAt: 1 }),
  ]);
  const serializeLate = (
    xs: typeof morningLate,
  ): LateInfo[] =>
    xs.map((n) => ({
      id: String(n._id),
      employeeId: String(n.employeeId),
      minutes: n.minutes,
      note: n.note,
      status: n.status,
    }));
  const serializeDelays = (tripType: TripType): DelayInfo[] =>
    delays
      .filter((d) => d.tripType === tripType)
      .map((d) => ({
        id: String(d._id),
        minutes: d.minutes,
        note: d.note,
        reportedBy: d.reportedBy,
      }));
  const isRegular = route.passengers.some(
    (p) => String(p.employeeId) === String(user._id),
  );
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
    isRegular,
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
            <SubmitButton className="justify-self-start rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700">
              Send
            </SubmitButton>
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
              startsAt={morning.startsAt}
              leaveIds={morning.leaveEmployeeIds}
              lateNotices={serializeLate(morningLate)}
              driverDelays={serializeDelays("MORNING_PICKUP")}
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
              startsAt={evening.startsAt}
              leaveIds={evening.leaveEmployeeIds}
              lateNotices={serializeLate(eveningLate)}
              driverDelays={serializeDelays("EVENING_DROPOFF")}
              {...panelProps}
            />
          }
        />
      </div>
    </div>
  );
}
