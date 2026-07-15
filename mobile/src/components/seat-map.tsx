import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { SeatCell } from "../lib/api";
import { resolveSeatRows, rowSlots, seatRowGroups, parseArrangement } from "../lib/seats";
import { C, radius } from "../lib/theme";

/** True Hiace floor plan: benches packed to the window/driver side (right),
 *  sliding-door walkway on the left, P1 beside the driver. */
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
      <View style={styles.canvas}>
        {/* front row: P1 window-side left, driver right */}
        <View style={styles.row}>
          {groups[0].map((l) => (
            <Seat key={l} label={l} cell={bySeat.get(l)} />
          ))}
          {Array.from({ length: Math.max(0, width - groups[0].length - 1) }).map((_, i) => (
            <View key={i} style={styles.blank} />
          ))}
          <View style={[styles.cell, styles.driver]}>
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
                <View key={`g${j}`} style={[styles.blank, styles.gap]} />
              ),
            )}
          </View>
        ))}
        <View style={styles.legend}>
          <Dot color={C.inkFaint} label="Regular" />
          <Dot color={C.ink} label="Guest" />
          <Dot color={C.notGoing} label="Priority" />
          <Dot color={C.openBorder} label="Open" />
        </View>
      </View>
    </ScrollView>
  );
}

function Seat({ label, cell }: { label: string; cell?: SeatCell }) {
  if (!cell) {
    return (
      <View style={[styles.cell, styles.openSeat]}>
        <Text style={styles.openLabel}>{label}</Text>
        <Text style={styles.openSub}>open</Text>
      </View>
    );
  }
  const safety = cell.reason.includes("Safety");
  const dot = safety ? C.notGoing : cell.ptype === "Regular" ? C.inkFaint : C.ink;
  return (
    <View style={styles.cell}>
      <View style={[styles.dot, { backgroundColor: dot }]} />
      <Text style={styles.name} numberOfLines={1}>
        {cell.name}
      </Text>
      <Text style={styles.sub} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function Dot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const CELL = 62;

const styles = StyleSheet.create({
  canvas: {
    backgroundColor: C.card,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: 12,
    gap: 8,
  },
  row: { flexDirection: "row", gap: 8 },
  cell: {
    width: CELL,
    height: 46,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  blank: { width: CELL, height: 46 },
  gap: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: C.borderSoft,
  },
  driver: { backgroundColor: C.bg },
  driverText: { fontSize: 9, fontWeight: "700", color: C.inkSoft, letterSpacing: 1 },
  doorRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingLeft: 2 },
  doorBar: { width: 34, height: 3, borderRadius: 2, backgroundColor: C.openBorder },
  doorText: { fontSize: 8, fontWeight: "700", color: C.open, letterSpacing: 0.5 },
  dot: { position: "absolute", top: 5, right: 6, width: 5, height: 5, borderRadius: 3 },
  name: { fontSize: 11, fontWeight: "600", color: C.ink, maxWidth: CELL - 8 },
  sub: { fontSize: 8, color: C.inkSoft },
  openSeat: { borderStyle: "dashed", borderColor: C.openBorder },
  openLabel: { fontSize: 10, fontWeight: "700", color: C.open },
  openSub: { fontSize: 8, color: C.open },
  legend: { flexDirection: "row", gap: 12, justifyContent: "center", paddingTop: 2 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot: { width: 7, height: 7, borderRadius: 4 },
  legendText: { fontSize: 10, color: C.inkMid },
});
