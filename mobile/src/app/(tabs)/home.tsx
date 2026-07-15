import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet,
  Text, View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { api, getCachedUser, type HomeRoute, type User } from "../../lib/api";
import { AttendanceToggle } from "../../components/attendance-toggle";
import { C, radius } from "../../lib/theme";

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [date, setDate] = useState("");
  const [routes, setRoutes] = useState<HomeRoute[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api<{ date: string; routes: HomeRoute[] }>("/api/home");
      setDate(data.date);
      setRoutes(data.routes);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load";
      if (msg.includes("sign in")) router.replace("/login");
      else Alert.alert("RouteMate", msg);
    }
  }, []);

  useEffect(() => {
    getCachedUser().then(setUser);
  }, []);
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

  const mine = routes?.find((r) => r.mine) ?? null;

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        <Text style={styles.hello}>Hi, {user?.name.split(" ")[0] ?? "there"} 👋</Text>
        <Text style={styles.date}>{date || " "} · Banani 11</Text>

        {routes === null && <ActivityIndicator color={C.ink} style={{ marginTop: 40 }} />}

        {mine && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>My trip today</Text>
              <Pressable onPress={() => router.push(`/route/${mine.code}`)}>
                <Text style={styles.link}>{mine.code} →</Text>
              </Pressable>
            </View>
            {(
              [
                ["Morning", mine.morning, mine.myStop?.morningTime, "MORNING_PICKUP"],
                ["Evening", mine.evening, mine.myStop?.eveningTime, "EVENING_DROPOFF"],
              ] as const
            ).map(([label, trip, time, tripType]) => (
              <View key={label} style={styles.tripRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.tripLabel}>{label}</Text>
                  <Text style={styles.tripHint} numberOfLines={1}>
                    {time ? `~${time} · ` : ""}
                    {mine.myStop?.name ?? trip.vehicle ?? ""}
                    {trip.afterCutoff ? " · locked" : ` · changes until ${trip.cutoff}`}
                  </Text>
                </View>
                {trip.myStatus === "ON_LEAVE" ? (
                  <View style={styles.leaveBadge}>
                    <Text style={styles.leaveText}>on leave</Text>
                  </View>
                ) : (
                  <AttendanceToggle
                    routeCode={mine.code}
                    date={date}
                    tripType={tripType}
                    status={trip.myStatus ?? "NO_RESPONSE"}
                    disabled={trip.afterCutoff}
                    onError={(m) => Alert.alert("RouteMate", m)}
                  />
                )}
              </View>
            ))}
          </View>
        )}

        {routes && (
          <>
            <Text style={styles.section}>Open seats today</Text>
            {routes.map((r) => (
              <Pressable
                key={r.code}
                style={styles.card}
                onPress={() => router.push(`/route/${r.code}`)}
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {r.name}
                  </Text>
                  <Text style={styles.chip}>{r.code}</Text>
                </View>
                <View style={styles.openRow}>
                  {(
                    [
                      ["Morning", r.morning],
                      ["Evening", r.evening],
                    ] as const
                  ).map(([label, t]) => (
                    <View key={label} style={styles.openBox}>
                      <Text style={styles.openLabel}>{label.toUpperCase()}</Text>
                      <Text style={[styles.openNum, t.open === 0 && { color: C.inkFaint }]}>
                        {t.open}
                        <Text style={styles.openOf}> / {t.capacity} open</Text>
                      </Text>
                      {t.alerts.length > 0 && <Text style={styles.alertDot}>⚠ alert</Text>}
                    </View>
                  ))}
                </View>
                <Text style={styles.request}>Request a seat →</Text>
              </Pressable>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 16, paddingBottom: 32, gap: 10 },
  hello: { fontSize: 22, fontWeight: "700", color: C.ink },
  date: { fontSize: 13, color: C.inkSoft, marginBottom: 8 },
  section: { fontSize: 15, fontWeight: "700", color: C.ink, marginTop: 10, marginBottom: 2 },
  card: {
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    borderRadius: radius.xl, padding: 14, gap: 10,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  cardTitle: { fontSize: 15, fontWeight: "700", color: C.ink, flexShrink: 1 },
  link: { fontSize: 13, fontWeight: "600", color: C.ink },
  chip: {
    fontSize: 11, color: C.inkMid, backgroundColor: C.chip, borderRadius: radius.full,
    paddingHorizontal: 8, paddingVertical: 2, overflow: "hidden",
  },
  tripRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  tripLabel: { fontSize: 14, fontWeight: "600", color: C.ink },
  tripHint: { fontSize: 11, color: C.inkSoft, marginTop: 1 },
  leaveBadge: {
    backgroundColor: C.warnSoft, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 5,
  },
  leaveText: { fontSize: 11, color: "#92400e", fontWeight: "600" },
  openRow: { flexDirection: "row", gap: 10 },
  openBox: { flex: 1, backgroundColor: C.bg, borderRadius: radius.lg, padding: 10 },
  openLabel: { fontSize: 9, fontWeight: "700", color: C.inkSoft, letterSpacing: 0.8 },
  openNum: { fontSize: 20, fontWeight: "700", color: C.open, marginTop: 2 },
  openOf: { fontSize: 11, fontWeight: "400", color: C.inkSoft },
  alertDot: { fontSize: 10, color: "#92400e", marginTop: 2 },
  request: { fontSize: 13, fontWeight: "600", color: C.ink },
});
