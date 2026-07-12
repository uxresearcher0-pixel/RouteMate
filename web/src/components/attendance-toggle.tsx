"use client";

import { useOptimistic, useTransition } from "react";
import { setAttendance } from "@/app/actions";

type Status = "GOING" | "NOT_GOING" | "NO_RESPONSE";

/** Going / Not-going pill pair with optimistic UI: the pill flips the
 *  instant it's tapped, then settles when the server action confirms. */
export function AttendanceToggle({
  routeCode,
  date,
  tripType,
  employeeId,
  status,
  disabled,
  compact,
}: {
  routeCode: string;
  date: string;
  tripType: string;
  employeeId: string;
  status: Status;
  disabled?: boolean;
  compact?: boolean;
}) {
  const [optimistic, setOptimistic] = useOptimistic<Status>(status);
  const [pending, startTransition] = useTransition();

  const choose = (s: Status) => {
    if (disabled || s === optimistic) return;
    startTransition(async () => {
      setOptimistic(s);
      const fd = new FormData();
      fd.set("routeCode", routeCode);
      fd.set("date", date);
      fd.set("tripType", tripType);
      fd.set("employeeId", employeeId);
      fd.set("status", s);
      await setAttendance(fd);
    });
  };

  const pad = compact ? "px-2.5 py-1" : "px-3 py-1.5";
  return (
    <div
      className={`flex overflow-hidden rounded-full border border-slate-200 bg-white transition-opacity ${
        pending ? "opacity-80" : ""
      }`}
    >
      {(["GOING", "NOT_GOING"] as const).map((s) => (
        <button
          key={s}
          type="button"
          disabled={disabled}
          onClick={() => choose(s)}
          className={`${pad} text-xs font-semibold transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-40 ${
            optimistic === s
              ? s === "GOING"
                ? "bg-emerald-500 text-white"
                : "bg-rose-500 text-white"
              : "text-slate-400 hover:bg-slate-50 hover:text-slate-700"
          }`}
        >
          {s === "GOING" ? "Going" : "Not going"}
        </button>
      ))}
    </div>
  );
}
