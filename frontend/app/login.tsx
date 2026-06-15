import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, KeyboardAvoidingView,
  Platform, ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { apiFetch } from "@/src/utils/api";

export default function LoginScreen() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSendOTP() {
    const digits = phone.replace(/\D/g, "");
    if (digits.length !== 10) {
      Alert.alert("Invalid Number", "Please enter a valid 10-digit mobile number.");
      return;
    }
    setLoading(true);
    try {
      await apiFetch("/auth/customer/send-otp", {
        method: "POST",
        body: JSON.stringify({ phone: `+91${digits}` }),
      });
      router.push({ pathname: "/otp", params: { phone: `+91${digits}` } });
    } catch (err: any) {
      if (err.error === "mobile_not_registered") {
        Alert.alert(
          "Not Registered",
          "This number is not linked to any membership.\nPlease contact your IntenCiv sales representative."
        );
      } else {
        Alert.alert("Error", "Could not send OTP. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.inner}>
        <View style={styles.logoBox}>
          <Text style={styles.logoText}>IntenCiv</Text>
          <Text style={styles.tagline}>Health Privilege Membership</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>Welcome</Text>
          <Text style={styles.subtitle}>
            Enter your registered mobile number to access your membership
          </Text>

          <View style={styles.phoneRow}>
            <View style={styles.prefix}>
              <Text style={styles.prefixText}>+91</Text>
            </View>
            <TextInput
              style={styles.input}
              placeholder="10-digit mobile number"
              placeholderTextColor="#999"
              keyboardType="phone-pad"
              maxLength={10}
              value={phone}
              onChangeText={setPhone}
            />
          </View>

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleSendOTP}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>Send OTP</Text>
            }
          </TouchableOpacity>

          <Text style={styles.note}>
            Only numbers registered at the time of card activation will work.
          </Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0A5C9B" },
  inner: { flex: 1, justifyContent: "center", padding: 24 },
  logoBox: { alignItems: "center", marginBottom: 32 },
  logoText: { fontSize: 36, fontWeight: "700", color: "#fff", letterSpacing: 1 },
  tagline: { fontSize: 14, color: "#cce4f7", marginTop: 4 },
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 24 },
  title: { fontSize: 22, fontWeight: "700", color: "#0A5C9B", marginBottom: 6 },
  subtitle: { fontSize: 13, color: "#666", marginBottom: 20, lineHeight: 18 },
  phoneRow: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  prefix: {
    backgroundColor: "#f0f4f8", borderWidth: 1, borderColor: "#d0dce8",
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 13, marginRight: 8,
  },
  prefixText: { fontSize: 15, color: "#333", fontWeight: "600" },
  input: {
    flex: 1, borderWidth: 1, borderColor: "#d0dce8",
    borderRadius: 8, paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 16, color: "#222", backgroundColor: "#f9fbfc",
  },
  btn: {
    backgroundColor: "#0A5C9B", borderRadius: 10,
    paddingVertical: 14, alignItems: "center", marginBottom: 16,
  },
  btnDisabled: { opacity: 0.7 },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  note: { fontSize: 11, color: "#999", textAlign: "center", lineHeight: 16 },
});
