import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { Redirect } from "expo-router";
import { getToken } from "../lib/api";
import { C } from "../lib/theme";

/** Entry gate: route to the app or the login screen based on stored token. */
export default function Index() {
  const [state, setState] = useState<"loading" | "in" | "out">("loading");

  useEffect(() => {
    getToken().then((t) => setState(t ? "in" : "out"));
  }, []);

  if (state === "loading") {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: C.bg }}>
        <ActivityIndicator color={C.ink} />
      </View>
    );
  }
  return <Redirect href={state === "in" ? "/(tabs)/home" : "/login"} />;
}
