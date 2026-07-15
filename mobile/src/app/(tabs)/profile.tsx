import { useCallback, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { api, signOut } from "../../lib/api";
import { C, radius } from "../../lib/theme";

type Me = {
  user: {
    empCode: string;
    name: string;
    role: string;
    phone: string | null;
    routeCode: string | null;
    routeName: string | null;
    stop: { name: string; morningTime: string | null; eveningTime: string | null } | null;
  };
};

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Admin",
  ROUTE_MANAGER: "Route Manager",
  EMPLOYEE: "Employee",
};

export default function Profile() {
  const [me, setMe] = useState<Me["user"] | null>(null);

  useFocusEffect(
    useCallback(() => {
      api<Me>("/api/me")
        .then((d) => setMe(d.user))
        .catch(() => router.replace("/login"));
    }, []),
  );

  const logout = async () => {
    await signOut();
    router.replace("/login");
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {me?.name
              .split(" ")
              .map((w) => w[0])
              .slice(0, 2)
              .join("")
              .toUpperCase() ?? "–"}
          </Text>
        </View>
        <Text style={styles.name}>{me?.name ?? " "}</Text>
        <Text style={styles.role}>
          {me ? `${me.empCode} · ${ROLE_LABEL[me.role] ?? me.role}` : " "}
        </Text>

        <View style={styles.card}>
          <Row label="Phone" value={me?.phone ?? "—"} />
          <Row label="Route" value={me?.routeName ?? "Not assigned"} />
          <Row
            label="Home stop"
            value={
              me?.stop
                ? `${me.stop.name}${me.stop.morningTime ? ` · ↑${me.stop.morningTime}` : ""}${me.stop.eveningTime ? ` · ↓${me.stop.eveningTime}` : ""}`
                : "—"
            }
          />
        </View>

        {me?.routeCode && (
          <Pressable
            style={styles.secondary}
            onPress={() => router.push(`/route/${me.routeCode}`)}
          >
            <Text style={styles.secondaryText}>Open my route card</Text>
          </Pressable>
        )}
        <Pressable
          style={styles.secondary}
          onPress={() =>
            Alert.alert(
              "Change password",
              "Use the web app (routemate.shahriarshanto.online) → your profile → Change password.",
            )
          }
        >
          <Text style={styles.secondaryText}>Change password</Text>
        </Pressable>
        <Pressable style={styles.logout} onPress={logout}>
          <Text style={styles.logoutText}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 20, gap: 10, alignItems: "stretch" },
  avatar: {
    alignSelf: "center", width: 64, height: 64, borderRadius: 32,
    backgroundColor: C.chip, alignItems: "center", justifyContent: "center", marginTop: 12,
  },
  avatarText: { fontSize: 20, fontWeight: "700", color: C.inkMid },
  name: { textAlign: "center", fontSize: 20, fontWeight: "700", color: C.ink, marginTop: 8 },
  role: { textAlign: "center", fontSize: 12, color: C.inkSoft, marginBottom: 10 },
  card: {
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    borderRadius: radius.xl, padding: 14, gap: 10,
  },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  rowLabel: { fontSize: 13, color: C.inkSoft },
  rowValue: { fontSize: 13, fontWeight: "600", color: C.ink, flexShrink: 1, textAlign: "right" },
  secondary: {
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    borderRadius: radius.md, paddingVertical: 12, alignItems: "center",
  },
  secondaryText: { fontSize: 14, fontWeight: "600", color: C.ink },
  logout: {
    backgroundColor: C.ink, borderRadius: radius.md, paddingVertical: 12,
    alignItems: "center", marginTop: 6,
  },
  logoutText: { fontSize: 14, fontWeight: "600", color: "#fff" },
});
