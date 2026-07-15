import { useState } from "react";
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet,
  Text, TextInput, View,
} from "react-native";
import { router } from "expo-router";
import { signIn } from "../lib/api";
import { C, radius } from "../lib/theme";

export default function Login() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!identifier.trim() || !password || busy) return;
    setBusy(true);
    setError(null);
    try {
      await signIn(identifier.trim(), password);
      router.replace("/(tabs)/home");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.logo}>
        <Text style={styles.logoText}>🚐</Text>
      </View>
      <Text style={styles.title}>RouteMate</Text>
      <Text style={styles.subtitle}>Sign in to manage your daily trips.</Text>

      <View style={styles.card}>
        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
        <Text style={styles.label}>Employee ID or mobile number</Text>
        <TextInput
          style={styles.input}
          value={identifier}
          onChangeText={setIdentifier}
          placeholder="E001 or 01710000001"
          placeholderTextColor={C.inkFaint}
          autoCapitalize="characters"
          autoCorrect={false}
        />
        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          placeholderTextColor={C.inkFaint}
          secureTextEntry
          onSubmitEditing={submit}
        />
        <Pressable style={[styles.button, busy && { opacity: 0.7 }]} onPress={submit}>
          {busy ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.buttonText}>Sign in</Text>
          )}
        </Pressable>
      </View>
      <Text style={styles.hint}>Forgot your password? Contact the transport admin.</Text>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg, justifyContent: "center", padding: 24 },
  logo: {
    alignSelf: "center", width: 56, height: 56, borderRadius: radius.lg,
    backgroundColor: C.ink, alignItems: "center", justifyContent: "center",
  },
  logoText: { fontSize: 26 },
  title: { textAlign: "center", fontSize: 24, fontWeight: "700", color: C.ink, marginTop: 12 },
  subtitle: { textAlign: "center", fontSize: 13, color: C.inkMid, marginTop: 4, marginBottom: 20 },
  card: {
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    borderRadius: radius.xl, padding: 18, gap: 8,
  },
  errorBox: {
    backgroundColor: C.notGoingSoft, borderRadius: radius.md, padding: 10,
    borderWidth: 1, borderColor: "#fecdd3",
  },
  errorText: { color: "#9f1239", fontSize: 13 },
  label: { fontSize: 12, fontWeight: "600", color: C.inkMid, marginTop: 4 },
  input: {
    borderWidth: 1, borderColor: C.border, borderRadius: radius.md,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: C.ink,
    backgroundColor: C.card,
  },
  button: {
    backgroundColor: C.ink, borderRadius: radius.md, paddingVertical: 13,
    alignItems: "center", marginTop: 10,
  },
  buttonText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  hint: { textAlign: "center", fontSize: 12, color: C.inkSoft, marginTop: 16 },
});
