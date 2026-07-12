"use client";

import { useState, type ReactNode } from "react";
import { Sunrise, Sunset } from "lucide-react";

/** On small screens show one trip at a time behind tabs; on xl show both
 *  side-by-side. Panels stay mounted (server-rendered) — tabs only toggle
 *  visibility. */
export function TripTabs({
  morning,
  evening,
}: {
  morning: ReactNode;
  evening: ReactNode;
}) {
  const [tab, setTab] = useState<"m" | "e">("m");
  return (
    <div>
      <div className="mb-4 flex rounded-full border border-slate-200 bg-white p-1 shadow-sm xl:hidden">
        <button
          type="button"
          onClick={() => setTab("m")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-1.5 text-sm font-semibold transition ${
            tab === "m" ? "bg-amber-100 text-amber-800" : "text-slate-400"
          }`}
        >
          <Sunrise size={14} />
          Morning
        </button>
        <button
          type="button"
          onClick={() => setTab("e")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-1.5 text-sm font-semibold transition ${
            tab === "e" ? "bg-indigo-100 text-indigo-800" : "text-slate-400"
          }`}
        >
          <Sunset size={14} />
          Evening
        </button>
      </div>
      <div className="flex flex-col gap-6 xl:flex-row">
        <div className={`min-w-0 flex-1 ${tab === "m" ? "" : "hidden"} xl:block`}>
          {morning}
        </div>
        <div className={`min-w-0 flex-1 ${tab === "e" ? "" : "hidden"} xl:block`}>
          {evening}
        </div>
      </div>
    </div>
  );
}
