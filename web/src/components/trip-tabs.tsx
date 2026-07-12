"use client";

import { useState, type ReactNode } from "react";
import { Sunrise, Sunset } from "lucide-react";

/** On small screens show one trip at a time behind animated tabs; on xl show
 *  both side-by-side. The active mobile panel remounts with a fade-up so tab
 *  switches feel like a native app. */
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
      <div className="relative mb-4 flex rounded-full border border-slate-200 bg-white p-1 shadow-sm xl:hidden">
        {/* sliding highlight */}
        <span
          className={`absolute inset-y-1 w-[calc(50%-4px)] rounded-full transition-transform duration-300 ease-out ${
            tab === "m" ? "translate-x-0 bg-amber-100" : "translate-x-full bg-indigo-100"
          }`}
          aria-hidden
        />
        <button
          type="button"
          onClick={() => setTab("m")}
          className={`relative z-10 flex flex-1 items-center justify-center gap-1.5 rounded-full py-1.5 text-sm font-semibold transition-colors duration-200 ${
            tab === "m" ? "text-amber-800" : "text-slate-400"
          }`}
        >
          <Sunrise size={14} />
          Morning
        </button>
        <button
          type="button"
          onClick={() => setTab("e")}
          className={`relative z-10 flex flex-1 items-center justify-center gap-1.5 rounded-full py-1.5 text-sm font-semibold transition-colors duration-200 ${
            tab === "e" ? "text-indigo-800" : "text-slate-400"
          }`}
        >
          <Sunset size={14} />
          Evening
        </button>
      </div>

      {/* mobile: one animated panel at a time */}
      <div key={tab} className="animate-fade-in-up xl:hidden">
        {tab === "m" ? morning : evening}
      </div>

      {/* desktop: both side-by-side */}
      <div className="hidden gap-6 xl:flex">
        <div className="min-w-0 flex-1">{morning}</div>
        <div className="min-w-0 flex-1">{evening}</div>
      </div>
    </div>
  );
}
