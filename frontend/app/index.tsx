import { useEffect } from "react";
import { useRouter } from "expo-router";
import { View, ActivityIndicator } from "react-native";
import * as SecureStore from "expo-secure-store";

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      try {
        const token = await SecureStore.getItemAsync("access_token");
        const user = await SecureStore.getItemAsync("user");
        if (token && user) {
          router.replace("/(tabs)/home");
        } else {
          router.replace("/login");
        }
      } catch {
        router.replace("/login");
      }
    })();
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0A5C9B" }}>
      <ActivityIndicator color="#fff" size="large" />
    </View>
  );
}
