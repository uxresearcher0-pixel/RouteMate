import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { SeatCell } from "../lib/api";
import { resolveSeatRows, rowSlots, seatRowGroups, parseArrangement } from "../lib/seats";
import { SeatIcon } from "./seat-icon";
import { C, radius } from "../lib/theme";

const TINT = {
  regular: "#94a3b8", // slate-400
  guest: "#0f172a", // slate-900
  safety: "#fb7185", // rose-400
  open: "#a7f3d0", // emerald-200
  driver: "#cbd5e1", // slate-300
} as const;

/** True Hiace floor plan drawn with the real seat icon inside a vehicle
 *  outline: benches packed to the window/driver side (right), sliding-door
 *  walkway on the left, P1 beside the driver.
 *  Keep in sync with web/src/components/ui.tsx SeatMap. */
export function SeatMap({
  seatPlan,
  capacity,
  layout,
  arrangement,
}: {
  seatPlan: SeatCell[];
  capacity: number;
  layout?: number[];
  arrangement?: string[];
}) {
  if (capacity <= 0) return null;
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
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={styles.wrap}>
        <View style={styles.body}>
          <View style={styles.windshield} />
          {/* front row: P1 window-side left, driver right */}
          <View style={styles.row}>
            {groups[0].map((l) => (
              <Seat key={l} label={l} cell={bySeat.get(l)} />
            ))}
            {Array.from({ length: Math.max(0, width - groups[0].length - 1) }).map((_, i) => (
              <View key={i} style={styles.blank} />
            ))}
            <View style={styles.cell}>
              <SeatIcon fill={TINT.driver} size={34} />
              <Text style={styles.driverText}>DRIVER</Text>
            </View>
          </View>
          <View style={styles.doorRow}>
            <View style={styles.doorBar} />
            <Text style={styles.doorText}>DOOR · WALKWAY ON THIS SIDE</Text>
          </View>
          {groups.slice(1).map((g, i) => (
            <View key={i} style={styles.row}>
              {rowSlots(g, arrangement?.[i + 1], width, coaster).map((slot, j) =>
                slot.kind === "seat" ? (
                  <Seat key={slot.label} label={slot.label} cell={bySeat.get(slot.label)} />
                ) : (
                  <View key={`g${j}`} style={styles.blank} />
                ),
              )}
            </View>
          ))}
        </View>
        <View style={styles.legend}>
          <LegendItem fill={TINT.regular} label="Regular" />
          <LegendItem fill={TINT.guest} label="Guest" />
          <LegendItem fill={TINT.safety} label="Priority" />
          <LegendItem fill={TINT.open} label="Open" />
        </View>
      </View>
    </ScrollView>
  );
}

function Seat({ label, cell }: { label: string; cell?: SeatCell }) {
  if (!cell) {
    return (
      <View style={styles.cell}>
        <SeatIcon fill={TINT.open} size={34} />
        <Text style={styles.openLabel}>
          {label} · open
        </Text>
      </View>
    );
  }
  const safety = cell.reason.includes("Safety");
  const fill = safety ? TINT.safety : cell.ptype === "Regular" ? TINT.regular : TINT.guest;
  return (
    <View style={styles.cell}>
      <SeatIcon fill={fill} size={34} />
      <Text style={styles.name} numberOfLines={1}>
        {cell.name}
      </Text>
      <Text style={styles.sub}>{label}</Text>
    </View>
  );
}

function LegendItem({ fill, label }: { fill: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <SeatIcon fill={fill} size={12} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const CELL = 60;

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: C.card,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: 12,
    gap: 10,
  },
  body: {
    borderWidth: 1,
    borderColor: C.border,
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    paddingHorizontal: 12,
    paddingBottom: 12,
    paddingTop: 8,
    gap: 8,
  },
  windshield: {
    alignSelf: "center",
    width: "55%",
    height: 5,
    borderRadius: 3,
    backgroundColor: C.borderSoft,
    marginBottom: 4,
  },
  row: { flexDirection: "row", gap: 8 },
  cell: { width: CELL, alignItems: "center" },
  blank: { width: CELL },
  driverText: { fontSize: 8, fontWeight: "700", color: C.inkSoft, letterSpacing: 1, marginTop: 1 },
  doorRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingLeft: 2 },
  doorBar: { width: 34, height: 3, borderRadius: 2, backgroundColor: C.openBorder },
  doorText: { fontSize: 8, fontWeight: "700", color: C.open, letterSpacing: 0.5 },
  name: { fontSize: 10, fontWeight: "600", color: C.ink, maxWidth: CELL - 4, marginTop: 1 },
  sub: { fontSize: 8, color: C.inkSoft },
  openLabel: { fontSize: 9, fontWeight: "700", color: C.open, marginTop: 1 },
  legend: { flexDirection: "row", gap: 14, justifyContent: "center" },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendText: { fontSize: 10, color: C.inkMid },
});
