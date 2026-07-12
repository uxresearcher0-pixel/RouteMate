import type { ReactNode } from "react";
import { resolveSeatRows, seatRowGroups, type SeatRow } from "@/lib/allocation";

/* ------------------------------------------------------------ Avatar */

const AVATAR_COLORS = [
  "bg-violet-100 text-violet-700",
  "bg-sky-100 text-sky-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
  "bg-indigo-100 text-indigo-700",
];

export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const color = AVATAR_COLORS[
    [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length
  ];
  const sz = size === "sm" ? "h-6 w-6 text-[10px]" : "h-8 w-8 text-xs";
  return (
    <span
      className={`inline-flex ${sz} shrink-0 items-center justify-center rounded-full font-semibold ${color}`}
    >
      {initials}
    </span>
  );
}

/* ------------------------------------------------------------- Badge */

const BADGE_STYLES = {
  green: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  red: "bg-rose-50 text-rose-700 ring-rose-600/20",
  amber: "bg-amber-50 text-amber-700 ring-amber-600/20",
  blue: "bg-sky-50 text-sky-700 ring-sky-600/20",
  purple: "bg-violet-50 text-violet-700 ring-violet-600/20",
  slate: "bg-slate-50 text-slate-600 ring-slate-500/20",
} as const;

export function Badge({
  color = "slate",
  children,
  title,
}: {
  color?: keyof typeof BADGE_STYLES;
  children: ReactNode;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${BADGE_STYLES[color]}`}
    >
      {children}
    </span>
  );
}

/* ------------------------------------------------------ ProgressBar */

export function ProgressBar({ used, total }: { used: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
  const color =
    used > total ? "bg-rose-500" : pct === 100 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
      <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
}

/* --------------------------------------------------------- StatCard */

export function StatCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</div>
        <div className="truncate text-xl font-bold text-slate-900">{value}</div>
        {hint && <div className="truncate text-xs text-slate-500">{hint}</div>}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------- Card */

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-slate-200/70 bg-white shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
      {children}
    </h3>
  );
}

/* ---------------------------------------------------------- SeatMap
 * Visual vehicle layout driven by the vehicle's real row structure
 * (Hiace 12: 2/3/3/4 · Hiace 10: 2/3/2/3 · coaster: 2+2 aisle rows).
 * Row 1 (front bench) renders beside the driver.                     */

function SeatCells({
  labels,
  bySeat,
  aisle,
}: {
  labels: string[];
  bySeat: Map<string, SeatRow>;
  aisle: boolean;
}) {
  if (aisle && labels.length === 4) {
    return (
      <>
        {labels.slice(0, 2).map((l) => (
          <Seat key={l} label={l} row={bySeat.get(l)} />
        ))}
        <div className="w-6" aria-hidden />
        {labels.slice(2).map((l) => (
          <Seat key={l} label={l} row={bySeat.get(l)} />
        ))}
      </>
    );
  }
  return (
    <>
      {labels.map((l) => (
        <Seat key={l} label={l} row={bySeat.get(l)} />
      ))}
    </>
  );
}

export function SeatMap({
  seatPlan,
  capacity,
  layout,
}: {
  seatPlan: SeatRow[];
  capacity: number;
  layout?: number[];
}) {
  const bySeat = new Map(seatPlan.map((s) => [s.seat, s]));
  const groups = seatRowGroups(resolveSeatRows(capacity, layout));
  const coaster = capacity >= 20;
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white p-4">
      <div className="mx-auto flex w-fit flex-col gap-2">
        {/* front row: P1 beside the driver (driver right — right-hand drive) */}
        <div className="flex justify-between gap-2">
          <SeatCells labels={groups[0]} bySeat={bySeat} aisle={false} />
          <div className="flex h-12 w-16 flex-col items-center justify-center rounded-2xl border-2 border-slate-200 bg-slate-100 text-slate-400 sm:h-14 sm:w-20">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="9" />
              <circle cx="12" cy="12" r="2.5" />
              <path d="M12 14.5V21M4 10l5.5 1.5M20 10l-5.5 1.5" />
            </svg>
            <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-wide">Driver</span>
          </div>
        </div>
        {/* entrance is on the left side */}
        <div className="flex items-center gap-1.5 pl-0.5 text-[9px] font-semibold uppercase tracking-wide text-emerald-500">
          <span className="h-1 w-10 rounded-full bg-emerald-300" />
          entry · left door
        </div>
        {groups.slice(1).map((g, i) => (
          <div key={i} className="flex justify-start gap-2">
            <SeatCells labels={g} bySeat={bySeat} aisle={coaster} />
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap justify-center gap-3 text-[11px] text-slate-500">
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-sky-400" /> Regular
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-violet-400" /> Guest
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-400" /> Safety priority
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-md border-2 border-dashed border-emerald-300 bg-emerald-50" /> Open seat
        </span>
      </div>
    </div>
  );
}

function Seat({ label, row }: { label: string; row?: SeatRow }) {
  if (!row) {
    return (
      <div
        title={`${label} — empty seat, open for booking`}
        className="flex h-12 w-16 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-emerald-200 bg-emerald-50/40 text-emerald-500 sm:h-14 sm:w-20"
      >
        <span className="text-[10px] font-bold">{label}</span>
        <span className="text-[9px]">open</span>
      </div>
    );
  }
  const safety = row.reason.includes("Safety");
  const style = safety
    ? "border-rose-200 bg-rose-50 text-rose-800"
    : row.ptype === "Regular"
      ? "border-sky-200 bg-sky-50 text-sky-900"
      : "border-violet-200 bg-violet-50 text-violet-900";
  return (
    <div
      title={`${label} · ${row.name} · ${row.reason}`}
      className={`flex h-12 w-16 flex-col items-center justify-center rounded-2xl border-2 px-1 sm:h-14 sm:w-20 ${style}`}
    >
      <span className="w-full truncate text-center text-[11px] font-semibold sm:text-xs">
        {row.name}
      </span>
      <span className="w-full truncate text-center text-[8px] opacity-60 sm:text-[9px]">
        {label} · {row.reason.replace("Drop order: ", "").replace("Boards at ", "").replace("Safety priority (front seat)", "front")}
      </span>
    </div>
  );
}
