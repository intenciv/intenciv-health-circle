import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { apiFetch } from "@/src/utils/api";
import { saveAuth } from "@/src/utils/storage";

export default function OTPScreen() {
  const router = useRouter();
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(30);
  const inputs = useRef<TextInput[]>([]);

  useEffect(() => {
    if (resendTimer > 0) {
      const t = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [resendTimer]);

  function handleChange(val: string, idx: number) {
    const newOtp = [...otp];
    newOtp[idx] = val;
    setOtp(newOtp);
    if (val && idx < 5) inputs.current[idx + 1]?.focus();
  }

  function handleKeyPress(e: any, idx: number) {
    if (e.nativeEvent.key === "Backspace" && !otp[idx] && idx > 0) {
      inputs.current[idx - 1]?.focus();
    }
  }

  async function handleVerify() {
    const code = otp.join("");
    if (code.length !== 6) {
      Alert.alert("Enter OTP", "Please enter the 6-digit OTP.");
      return;
    }
    setLoading(true);
    try {
      const data = await apiFetch("/auth/customer/verify-otp", {
        method: "POST",
        body: JSON.stringify({ phone, otp: code }),
      });
      await saveAuth(data.access_token, data.refresh_token, data.user);
      router.replace("/(tabs)/home");
    } catch (err: any) {
      Alert.alert(
        "Invalid OTP",
        "The OTP you entered is incorrect or expired. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    try {
      await apiFetch("/auth/customer/send-otp", {
        method: "POST",
        body: JSON.stringify({ phone }),
      });
      setResendTimer(30);
      setOtp(["", "", "", "", "", ""]);
      inputs.current[0]?.focus();
      Alert.alert("OTP Sent", "A new OTP has been sent to your number.");
    } catch {
      Alert.alert("Error", "Could not resend OTP. Please try again.");
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.inner}>
        <Text style={styles.logoText}>IntenCiv</Text>

        <View style={styles.card}>
          <Text style={styles.title}>Verify OTP</Text>
          <Text style={styles.subtitle}>
            Enter the 6-digit OTP sent to{"\n"}
            <Text style={styles.phone}>{phone}</Text>
          </Text>

          <View style={styles.otpRow}>
            {otp.map((digit, idx) => (
              <TextInput
                key={idx}
                ref={(r) => { if (r) inputs.current[idx] = r; }}
                style={[styles.otpBox, digit ? styles.otpBoxFilled : null]}
                maxLength={1}
                keyboardType="number-pad"
                value={digit}
                onChangeText={(val) => handleChange(val, idx)}
                onKeyPress={(e) => handleKeyPress(e, idx)}
              />
            ))}
          </View>

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleVerify}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>Verify & Login</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleResend}
            disabled={resendTimer > 0}
            style={styles.resendRow}
          >
            <Text style={[styles.resendText, resendTimer > 0 && styles.resendDisabled]}>
              {resendTimer > 0
                ? `Resend OTP in ${resendTimer}s`
                : "Resend OTP"
              }
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backRow}
          >
            <Text style={styles.backText}>← Change number</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0A5C9B" },
  inner: { flex: 1, justifyContent: "center", padding: 24 },
  logoText: {
    fontSize: 32, fontWeight: "700", color: "#fff",
    textAlign: "center", marginBottom: 28,
  },
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 24 },
  title: { fontSize: 22, fontWeight: "700", color: "#0A5C9B", marginBottom: 6 },
  subtitle: { fontSize: 13, color: "#666", marginBottom: 24, lineHeight: 20 },
  phone: { fontWeight: "700", color: "#333" },
  otpRow: {
    flexDirection: "row", justifyContent: "space-between", marginBottom: 24,
  },
  otpBox: {
    width: 46, height: 54, borderWidth: 2, borderColor: "#d0dce8",
    borderRadius: 10, textAlign: "center", fontSize: 22,
    fontWeight: "700", color: "#0A5C9B", backgroundColor: "#f9fbfc",
  },
  otpBoxFilled: {
    borderColor: "#0A5C9B", backgroundColor: "#e8f0f9",
  },
  btn: {
    backgroundColor: "#0A5C9B", borderRadius: 10,
    paddingVertical: 14, alignItems: "center", marginBottom: 16,
  },
  btnDisabled: { opacity: 0.7 },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  resendRow: { alignItems: "center", marginBottom: 12 },
  resendText: { color: "#0A5C9B", fontSize: 13, fontWeight: "600" },
  resendDisabled: { color: "#aaa" },
  backRow: { alignItems: "center" },
  backText: { color: "#999", fontSize: 13 },
});
