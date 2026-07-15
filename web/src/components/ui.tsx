import type { ReactNode } from "react";
import { resolveSeatRows, seatRowGroups, type SeatRow } from "@/lib/allocation";

/* ------------------------------------------------------------ Avatar */

const AVATAR_COLORS = ["bg-slate-100 text-slate-600"];

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
  blue: "bg-slate-100 text-slate-700 ring-slate-500/20",
  purple: "bg-white text-slate-500 ring-slate-300",
  slate: "bg-white text-slate-500 ring-slate-200",
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
    used > total ? "bg-rose-500" : pct === 100 ? "bg-amber-400" : "bg-slate-900";
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
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="text-slate-300">{icon}</div>
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
    <div className={`rounded-2xl border border-slate-200 bg-white ${className}`}>
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
 * True floor plan driven by the vehicle's row structure + arrangement.
 * Benches pack toward the right (window/driver side); the walkway and
 * sliding door run along the LEFT, exactly like the Hiace diagrams:
 *   12-seated: P1|Driver / bench 3 / single+walkthrough+bench 2 / bench 4
 * Arrangement strings are per row, left→right; "_" marks a walkway gap. */

const BLANK_CELL = "h-12 w-16 sm:h-14 sm:w-20";

/** Parse "1_2" → [1,2]; invalid/missing → null. */
function parseArrangement(s: string | undefined, expected: number): number[] | null {
  if (!s) return null;
  const segs = s
    .split("_")
    .map((x) => parseInt(x, 10))
    .filter((n) => Number.isFinite(n) && n > 0);
  return segs.length > 0 && segs.reduce((a, b) => a + b, 0) === expected ? segs : null;
}

type Slot = { kind: "seat"; label: string } | { kind: "gap" };

/** Build left→right slots for a row: seats packed right, walkway left. */
function rowSlots(
  labels: string[],
  arrangement: string | undefined,
  width: number,
  coaster: boolean,
): Slot[] {
  const segs =
    parseArrangement(arrangement, labels.length) ??
    (coaster && labels.length === 4 ? [2, 2] : [labels.length]);
  const slots: Slot[] = [];
  let li = 0;
  segs.forEach((n, i) => {
    if (i > 0) slots.push({ kind: "gap" });
    for (let k = 0; k < n; k++) slots.push({ kind: "seat", label: labels[li++] });
  });
  while (slots.length < width) slots.unshift({ kind: "gap" }); // left walkway
  return slots;
}

export function SeatMap({
  seatPlan,
  capacity,
  layout,
  arrangement,
}: {
  seatPlan: SeatRow[];
  capacity: number;
  layout?: number[];
  arrangement?: string[];
}) {
  const bySeat = new Map(seatPlan.map((s) => [s.seat, s]));
  const rows = resolveSeatRows(capacity, layout);
  const groups = seatRowGroups(rows);
  const coaster = capacity >= 20;

  const slotCount = (i: number) => {
    const segs =
      parseArrangement(arrangement?.[i], rows[i]) ??
      (coaster && rows[i] === 4 ? [2, 2] : [rows[i]]);
    return rows[i] + segs.length - 1;
  };
  const width = Math.max(2, ...groups.slice(1).map((_, i) => slotCount(i + 1)));

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white p-4">
      <div className="mx-auto flex w-fit flex-col gap-2">
        {/* front row: P1 window-side left, driver right (right-hand drive) */}
        <div className="flex gap-2">
          {groups[0].map((l) => (
            <Seat key={l} label={l} row={bySeat.get(l)} />
          ))}
          {Array.from({ length: Math.max(0, width - groups[0].length - 1) }).map((_, i) => (
            <div key={i} className={BLANK_CELL} aria-hidden />
          ))}
          <div className={`flex ${BLANK_CELL} flex-col items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-400`}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="9" />
              <circle cx="12" cy="12" r="2.5" />
              <path d="M12 14.5V21M4 10l5.5 1.5M20 10l-5.5 1.5" />
            </svg>
            <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-wide">Driver</span>
          </div>
        </div>
        {/* sliding door + walkway run along the left side */}
        <div className="flex items-center gap-1.5 pl-0.5 text-[9px] font-semibold uppercase tracking-wide text-emerald-500">
          <span className="h-1 w-10 rounded-full bg-emerald-300" />
          door · walkway on this side
        </div>
        {groups.slice(1).map((g, i) => (
          <div key={i} className="flex gap-2">
            {rowSlots(g, arrangement?.[i + 1], width, coaster).map((slot, j) =>
              slot.kind === "seat" ? (
                <Seat key={slot.label} label={slot.label} row={bySeat.get(slot.label)} />
              ) : (
                <div
                  key={`gap-${j}`}
                  aria-hidden
                  className={`${BLANK_CELL} rounded-2xl border border-dashed border-slate-100`}
                />
              ),
            )}
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap justify-center gap-3 text-[11px] text-slate-500">
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-slate-300" /> Regular
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-slate-900" /> Guest
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-rose-400" /> Safety priority
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
        className="flex h-12 w-16 flex-col items-center justify-center rounded-2xl border border-dashed border-emerald-300 bg-white text-emerald-600 sm:h-14 sm:w-20"
      >
        <span className="text-[10px] font-bold">{label}</span>
        <span className="text-[9px]">open</span>
      </div>
    );
  }
  const safety = row.reason.includes("Safety");
  const dot = safety
    ? "bg-rose-400"
    : row.ptype === "Regular"
      ? "bg-slate-300"
      : "bg-slate-900";
  return (
    <div
      title={`${label} · ${row.name} · ${row.reason}`}
      className="relative flex h-12 w-16 flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white px-1 text-slate-800 sm:h-14 sm:w-20"
    >
      <span className={`absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full ${dot}`} aria-hidden />
      <span className="w-full truncate text-center text-[11px] font-semibold sm:text-xs">
        {row.name}
      </span>
      <span className="w-full truncate text-center text-[8px] text-slate-400 sm:text-[9px]">
        {label} · {row.reason.replace("Drop order: ", "").replace("Boards at ", "").replace("Safety priority (rows behind driver)", "priority").replace("Safety priority (front seat)", "priority")}
      </span>
    </div>
  );
}
