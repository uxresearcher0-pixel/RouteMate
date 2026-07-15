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
 * True floor plan driven by the vehicle's row structure + arrangement,
 * drawn with the real seat icon (headrest / backrest / cushion) inside a
 * vehicle-body outline. Benches pack toward the right (window/driver
 * side); the walkway and sliding door run along the LEFT, exactly like
 * the Hiace diagrams:
 *   12-seated: P1|Driver / bench 3 / single+walkthrough+bench 2 / bench 4
 * Arrangement strings are per row, left→right; "_" marks a walkway gap. */

const BLANK_CELL = "h-[74px] w-16 sm:w-20";

/** Bucket-seat glyph traced from design-assets/vecteezy car-seat icon:
 *  headrest + neck posts, backrest with inner panel, wide cushion. */
export function SeatIcon({ fill, className }: { fill: string; className?: string }) {
  return (
    <svg viewBox="0 0 96 104" className={className} aria-hidden>
      <path
        d="M33 2h30c6.6 0 11 4.4 11 11v4c0 5.5-4.5 10-10 10H32c-5.5 0-10-4.5-10-10v-4c0-6.6 4.4-11 11-11z"
        fill={fill}
      />
      <rect x="35" y="25" width="7" height="9" fill={fill} />
      <rect x="54" y="25" width="7" height="9" fill={fill} />
      <path
        d="M25 33h46c7.7 0 13 5.3 13 13v29c0 7.7-5.3 13-13 13H25c-7.7 0-13-5.3-13-13V46c0-7.7 5.3-13 13-13z"
        fill={fill}
      />
      <rect x="28" y="41" width="40" height="47" rx="11" fill="none" stroke="#fff" strokeWidth="3.5" />
      <path
        d="M13 82h70c5.5 0 9 3.8 9 9.5S88.5 101 83 101H13c-5.5 0-9-3.8-9-9.5S7.5 82 13 82z"
        fill={fill}
        stroke="#fff"
        strokeWidth="3"
      />
    </svg>
  );
}

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
      {/* van body outline — top view, front (windshield) at the top */}
      <div className="relative mx-auto w-fit px-2.5">
        {/* side mirrors */}
        <span
          aria-hidden
          className="absolute -left-0 top-10 h-5 w-2.5 rotate-[24deg] rounded-full border border-slate-300 bg-slate-100"
        />
        <span
          aria-hidden
          className="absolute -right-0 top-10 h-5 w-2.5 -rotate-[24deg] rounded-full border border-slate-300 bg-slate-100"
        />
        <div className="rounded-t-[64px] rounded-b-[26px] border-[1.5px] border-slate-300 bg-white px-4 pb-3 pt-2">
          {/* windshield arc */}
          <div
            aria-hidden
            className="mx-auto mb-3 h-4 w-[82%] rounded-b-[40px] border-b-[1.5px] border-slate-200"
          />
        <div className="flex w-fit flex-col gap-2">
          {/* front row: P1 window-side left, driver right (right-hand drive) */}
          <div className="flex gap-2">
            {groups[0].map((l) => (
              <Seat key={l} label={l} row={bySeat.get(l)} />
            ))}
            {Array.from({ length: Math.max(0, width - groups[0].length - 1) }).map((_, i) => (
              <div key={i} className={BLANK_CELL} aria-hidden />
            ))}
            <div className={`flex ${BLANK_CELL} flex-col items-center`}>
              <SeatIcon fill="#cbd5e1" className="h-10 w-10 sm:h-11 sm:w-11" />
              <span className="mt-0.5 text-[8px] font-semibold uppercase tracking-wide text-slate-400">
                Driver
              </span>
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
                  <div key={`gap-${j}`} aria-hidden className={BLANK_CELL} />
                ),
              )}
            </div>
          ))}
          </div>
          {/* rear window line */}
          <div
            aria-hidden
            className="mx-auto mt-3 h-2 w-[70%] rounded-t-[20px] border-t-[1.5px] border-slate-200"
          />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap justify-center gap-3 text-[11px] text-slate-500">
        <span className="inline-flex items-center gap-1">
          <SeatIcon fill="#94a3b8" className="h-3.5 w-3.5" /> Regular
        </span>
        <span className="inline-flex items-center gap-1">
          <SeatIcon fill="#0f172a" className="h-3.5 w-3.5" /> Guest
        </span>
        <span className="inline-flex items-center gap-1">
          <SeatIcon fill="#fb7185" className="h-3.5 w-3.5" /> Safety priority
        </span>
        <span className="inline-flex items-center gap-1">
          <SeatIcon fill="#a7f3d0" className="h-3.5 w-3.5" /> Open seat
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
        className={`flex ${BLANK_CELL} flex-col items-center`}
      >
        <SeatIcon fill="#a7f3d0" className="h-10 w-10 sm:h-11 sm:w-11" />
        <span className="text-[9px] font-bold leading-tight text-emerald-600">
          {label} · open
        </span>
      </div>
    );
  }
  const safety = row.reason.includes("Safety");
  const fill = safety ? "#fb7185" : row.ptype === "Regular" ? "#94a3b8" : "#0f172a";
  return (
    <div
      title={`${label} · ${row.name} · ${row.reason}`}
      className={`flex ${BLANK_CELL} flex-col items-center`}
    >
      <SeatIcon fill={fill} className="h-10 w-10 sm:h-11 sm:w-11" />
      <span className="w-full truncate text-center text-[10px] font-semibold leading-tight text-slate-800">
        {row.name}
      </span>
      <span className="w-full truncate text-center text-[8px] leading-tight text-slate-400">
        {label}
      </span>
    </div>
  );
}
