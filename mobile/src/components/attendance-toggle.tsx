import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { api } from "../lib/api";
import { C, radius } from "../lib/theme";

type Status = "GOING" | "NOT_GOING" | "NO_RESPONSE" | "ON_LEAVE";

/** Optimistic Going / Not-going pills — flips instantly, reverts on error. */
export function AttendanceToggle({
  routeCode,
  date,
  tripType,
  status,
  disabled,
  onError,
}: {
  routeCode: string;
  date: string;
  tripType: string;
  status: Status;
  disabled?: boolean;
  onError?: (message: string) => void;
}) {
  const [current, setCurrent] = useState<Status>(status);
  const locked = disabled || current === "ON_LEAVE";

  const choose = async (s: "GOING" | "NOT_GOING") => {
    if (locked || s === current) return;
    const prev = current;
    setCurrent(s); // optimistic
    try {
      await api("/api/attendance", {
        method: "POST",
        body: { routeCode, date, tripType, status: s },
      });
    } catch (err) {
      setCurrent(prev);
      onError?.(err instanceof Error ? err.message : "Failed to update");
    }
  };

  return (
    <View style={[styles.wrap, locked && styles.locked]}>
      {(["GOING", "NOT_GOING"] as const).map((s) => {
        const active = current === s;
        return (
          <Pressable
            key={s}
            disabled={locked}
            onPress={() => choose(s)}
            style={[
              styles.pill,
              active && { backgroundColor: s === "GOING" ? C.going : C.notGoing },
            ]}
          >
            <Text style={[styles.label, active ? styles.labelActive : null]}>
              {s === "GOING" ? "Going" : "Not going"}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: radius.full,
    overflow: "hidden",
    backgroundColor: C.card,
  },
  locked: { opacity: 0.45 },
  pill: { paddingHorizontal: 12, paddingVertical: 7 },
  label: { fontSize: 12, fontWeight: "600", color: C.inkSoft },
  labelActive: { color: "#fff" },
});
