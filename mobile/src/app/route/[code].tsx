import { useCallback, useState } from "react";
import {
  ActivityIndicator, Alert, Linking, Pressable, RefreshControl, ScrollView,
  StyleSheet, Text, TextInput, View,
} from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { api, type RouteDetail, type TripDetail } from "../../lib/api";
import { AttendanceToggle } from "../../components/attendance-toggle";
import { SeatMap } from "../../components/seat-map";
import { C, radius } from "../../lib/theme";

export default function RouteScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const [data, setData] = useState<RouteDetail | null>(null);
  const [tab, setTab] = useState<"morning" | "evening">("morning");
  const [refreshing, setRefreshing] = useState(false);
  const [point, setPoint] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await api<RouteDetail>(`/api/routes/${code}`));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load";
      if (msg.includes("sign in")) router.replace("/login");
      else Alert.alert("RouteMate", msg);
    }
  }, [code]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const requestSeat = async (trip: TripDetail) => {
    if (!data || sending) return;
    const stop = point ?? data.route.stops.find((s) => s.seq > 0)?.name;
    if (!stop) return;
    setSending(true);
    try {
      await api("/api/guest-requests", {
        method: "POST",
        body: {
          routeCode: data.route.code,
          date: data.date,
          tripType: trip.tripType,
          pointName: stop,
        },
      });
      Alert.alert("RouteMate", "Seat request sent — the route manager will review it.");
      await load();
    } catch (err) {
      Alert.alert("RouteMate", err instanceof Error ? err.message : "Failed");
    } finally {
      setSending(false);
    }
  };

  if (!data) {
    return (
      <SafeAreaView style={styles.screen}>
        <ActivityIndicator color={C.ink} style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  const trip = data[tab];
  const timeFor = (s: { morningTime: string | null; eveningTime: string | null }) =>
    tab === "morning" ? s.morningTime : s.eveningTime;
  const me = trip.attendance.find((a) => a.isMe);

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>{data.route.name}</Text>
        <Text style={styles.subtitle}>
          {data.route.code} · {data.date}
          {data.route.manager
            ? ` · Manager: ${data.route.manager.name}`
            : ""}
        </Text>

        {/* trip switch */}
        <View style={styles.tabs}>
          {(["morning", "evening"] as const).map((t) => (
            <Pressable
              key={t}
              onPress={() => setTab(t)}
              style={[styles.tab, tab === t && styles.tabActive]}
            >
              <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                {t === "morning" ? "Morning" : "Evening"}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* status line */}
        <View style={styles.card}>
          <Text style={styles.meta}>
            {trip.vehicle?.code ?? "no vehicle"}
            {trip.vehicle?.driverName ? ` · ${trip.vehicle.driverName}` : ""}
            {trip.startsAt ? ` · starts ~${trip.startsAt}` : ""}
          </Text>
          {trip.vehicle?.driverPhone && (
            <Pressable onPress={() => Linking.openURL(`tel:${trip.vehicle!.driverPhone}`)}>
              <Text style={styles.phone}>📞 {trip.vehicle.driverPhone}</Text>
            </Pressable>
          )}
          <Text style={[styles.meta, { color: trip.afterCutoff ? "#9f1239" : C.open }]}>
            {trip.afterCutoff
              ? `Locked — plan changes closed ${trip.cutoff}`
              : `Plan changes open until ${trip.cutoff}`}
          </Text>
          {trip.alerts.map((a) => (
            <Text key={a} style={styles.alert}>
              ⚠ {a}
            </Text>
          ))}
          {trip.driverDelays.map((d, i) => (
            <Text key={i} style={styles.alert}>
              ⚠ Driver ~{d.minutes} min late{d.note ? ` — ${d.note}` : ""}
            </Text>
          ))}
        </View>

        {/* seat map first — booking-first */}
        <Text style={styles.section}>Seats · {trip.openSeats} open for guests</Text>
        <SeatMap
          seatPlan={trip.seatPlan}
          capacity={trip.vehicle?.capacity ?? 0}
          layout={trip.vehicle?.seatLayout}
          arrangement={trip.vehicle?.seatArrangement}
        />

        {/* guest request */}
        {!data.isRegular && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Request a seat ({tab})</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: "row", gap: 6 }}>
                {data.route.stops
                  .filter((s) => s.seq > 0)
                  .map((s) => {
                    const active = (point ?? "") === s.name;
                    return (
                      <Pressable
                        key={s.seq}
                        onPress={() => setPoint(s.name)}
                        style={[styles.stopChip, active && styles.stopChipActive]}
                      >
                        <Text style={[styles.stopChipText, active && { color: "#fff" }]}>
                          {s.name}
                          {timeFor(s) ? ` ~${timeFor(s)}` : ""}
                        </Text>
                      </Pressable>
                    );
                  })}
              </View>
            </ScrollView>
            <Pressable
              style={[styles.button, (sending || !point) && { opacity: 0.5 }]}
              disabled={sending || !point}
              onPress={() => requestSeat(trip)}
            >
              {sending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.buttonText}>Send request</Text>
              )}
            </Pressable>
          </View>
        )}

        {/* my attendance quick toggle */}
        {me && (
          <View style={[styles.card, styles.rowBetween]}>
            <Text style={styles.cardTitle}>My status</Text>
            <AttendanceToggle
              routeCode={data.route.code}
              date={data.date}
              tripType={trip.tripType}
              status={me.onLeave ? "ON_LEAVE" : (me.status as "GOING" | "NOT_GOING" | "NO_RESPONSE")}
              disabled={trip.afterCutoff && !data.canManage}
              onError={(m) => Alert.alert("RouteMate", m)}
            />
          </View>
        )}

        {/* passengers */}
        <Text style={styles.section}>Passengers</Text>
        <View style={styles.card}>
          {trip.attendance.map((a) => (
            <View key={a.employeeId} style={styles.personRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.personName}>
                  {a.name}
                  {a.isMe ? "  (you)" : ""}
                </Text>
                {a.phone && (
                  <Pressable onPress={() => Linking.openURL(`tel:${a.phone}`)}>
                    <Text style={styles.personPhone}>{a.phone}</Text>
                  </Pressable>
                )}
              </View>
              <Text
                style={[
                  styles.status,
                  a.onLeave
                    ? { color: "#92400e" }
                    : a.status === "GOING"
                      ? { color: C.going }
                      : a.status === "NOT_GOING"
                        ? { color: C.notGoing }
                        : { color: C.inkSoft },
                ]}
              >
                {a.onLeave
                  ? "on leave"
                  : a.status === "GOING"
                    ? "going"
                    : a.status === "NOT_GOING"
                      ? "not going"
                      : "no response"}
              </Text>
            </View>
          ))}
          {trip.guests.length > 0 && <View style={styles.divider} />}
          {trip.guests.map((g) => (
            <View key={g.id} style={styles.personRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.personName}>{g.name}</Text>
                <Text style={styles.personPhone}>guest → {g.pointName}</Text>
              </View>
              <Text style={[styles.status, { color: g.seated ? C.going : C.inkSoft }]}>
                {g.seated ? "seat allocated" : "waitlist"}
              </Text>
            </View>
          ))}
        </View>

        {/* stops */}
        <Text style={styles.section}>Stops</Text>
        <View style={styles.card}>
          {data.route.stops.map((s) => (
            <View key={s.seq} style={styles.personRow}>
              <Text style={styles.stopName}>{s.name}</Text>
              <Text style={styles.stopTime}>{timeFor(s) ? `~${timeFor(s)}` : ""}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 16, paddingBottom: 40, gap: 10 },
  back: { fontSize: 14, color: C.inkMid, marginBottom: 4 },
  title: { fontSize: 20, fontWeight: "700", color: C.ink },
  subtitle: { fontSize: 12, color: C.inkSoft, marginBottom: 6 },
  tabs: {
    flexDirection: "row", backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    borderRadius: radius.full, padding: 3, marginBottom: 4,
  },
  tab: { flex: 1, paddingVertical: 8, borderRadius: radius.full, alignItems: "center" },
  tabActive: { backgroundColor: C.chip },
  tabText: { fontSize: 13, fontWeight: "600", color: C.inkSoft },
  tabTextActive: { color: C.ink },
  card: {
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    borderRadius: radius.xl, padding: 14, gap: 6,
  },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardTitle: { fontSize: 14, fontWeight: "700", color: C.ink },
  meta: { fontSize: 12, color: C.inkMid },
  phone: { fontSize: 12, color: C.ink, fontWeight: "600" },
  alert: {
    fontSize: 12, color: "#92400e", backgroundColor: C.warnSoft,
    borderRadius: radius.md, padding: 8, overflow: "hidden",
  },
  section: { fontSize: 14, fontWeight: "700", color: C.ink, marginTop: 8 },
  stopChip: {
    borderWidth: 1, borderColor: C.border, borderRadius: radius.full,
    paddingHorizontal: 10, paddingVertical: 6, backgroundColor: C.card,
  },
  stopChipActive: { backgroundColor: C.ink, borderColor: C.ink },
  stopChipText: { fontSize: 12, color: C.inkMid },
  button: {
    backgroundColor: C.ink, borderRadius: radius.md, paddingVertical: 11,
    alignItems: "center", marginTop: 6,
  },
  buttonText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  personRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingVertical: 6, gap: 8,
  },
  personName: { fontSize: 14, fontWeight: "600", color: C.ink },
  personPhone: { fontSize: 11, color: C.inkSoft },
  status: { fontSize: 12, fontWeight: "600" },
  divider: { height: 1, backgroundColor: C.borderSoft, marginVertical: 4 },
  stopName: { fontSize: 13, color: C.ink },
  stopTime: { fontSize: 12, color: C.inkSoft },
});
