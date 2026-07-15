/** RouteMate minimalist palette — slate monochrome, color only for meaning. */
export const C = {
  bg: "#f8fafc", // slate-50
  card: "#ffffff",
  border: "#e2e8f0", // slate-200
  borderSoft: "#f1f5f9", // slate-100
  ink: "#0f172a", // slate-900 — the only accent
  inkMid: "#475569", // slate-600
  inkSoft: "#94a3b8", // slate-400
  inkFaint: "#cbd5e1", // slate-300
  chip: "#f1f5f9", // slate-100
  // semantic only
  going: "#10b981", // emerald-500
  goingSoft: "#ecfdf5",
  notGoing: "#f43f5e", // rose-500
  notGoingSoft: "#fff1f2",
  warn: "#f59e0b", // amber-500
  warnSoft: "#fffbeb",
  open: "#059669", // emerald-600
  openBorder: "#6ee7b7", // emerald-300
} as const;

export const radius = { md: 12, lg: 16, xl: 20, full: 999 } as const;
