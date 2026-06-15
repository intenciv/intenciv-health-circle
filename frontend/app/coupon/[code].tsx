import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, ScrollView, Share, Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { apiFetch } from "@/src/utils/api";
import { getToken } from "@/src/utils/storage";

const CONDITIONS: Record<string, string> = {
  HC: "Valid for one health check-up. Walk-in or appointment. One-time use only.",
  HM: "Valid for one home sample collection visit. Book via IntenCiv reception.",
  VC: "Valid for one vital check session at IntenCiv centre.",
  BG: "Choose any advance or premium package from intenciv.com. 1+1 — bring a companion.",
  SE: "Refer a known patient of Cardiac, Kidney, Gastro or Cancer. Patient must carry medical history records.",
  IC: "30% discount on all in-house testing at IntenCiv. Cannot be combined with other offers.",
  MT: "35% discount on all tests for a pregnant woman. Proof of pregnancy may be required.",
  IS: "20% discount on any Intenshe health package. Visit intenciv.com to browse packages.",
};

const ICONS: Record<string, string> = {
  HC: "🩺", HM: "🏠", VC: "💊", BG: "🎁",
  SE: "❤️", IC: "🔬", MT: "🤰", IS: "💙",
};

export default function CouponDetailScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();
  const [coupon, setCoupon] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        const data = await apiFetch(
          `/customer/coupons/${code}`,
          {},
          token || undefined
        );
        setCoupon(data);
      } catch {
        Alert.alert("Error", "Could not load coupon details.");
      } finally {
        setLoading(false);
      }
    })();
  }, [code]);

  function getBenefitCode() {
    if (!code) return "";
    const parts = (code as string).split("-");
    if (parts.length >= 4) return parts[3].replace(/\d+$/, "");
    return "";
  }

  async function handleShare() {
    try {
      await Share.share({
        message: `My IntenCiv Health Privilege coupon:\n${coupon?.benefit_name}\nCode: ${code}\n\nShow this at IntenCiv reception.`,
      });
    } catch { }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0A5C9B" />
      </View>
    );
  }

  const benefitCode = getBenefitCode();
  const condition = CONDITIONS[benefitCode] || "Show this coupon code at IntenCiv reception.";
  const icon = ICONS[benefitCode] || "🎫";
  const isUsed = coupon?.status === "used";

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Coupon Detail</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.body}>
        {/* Coupon Card */}
        <View style={[styles.couponCard, isUsed && styles.couponCardUsed]}>
          <View style={styles.couponCardHeader}>
            <Text style={styles.brandName}>IntenCiv</Text>
            <Text style={styles.brandSub}>Health Privilege</Text>
          </View>

          <View style={styles.couponCardBody}>
            <Text style={styles.couponIcon}>{icon}</Text>
            <Text style={styles.benefitName}>
              {coupon?.benefit_name || "Benefit Coupon"}
            </Text>

            <View style={styles.codeBox}>
              <Text style={styles.codeLabel}>COUPON CODE</Text>
              <Text style={[styles.codeText, isUsed && styles.codeTextUsed]}>
                {code}
              </Text>
            </View>

            <View style={[
              styles.statusPill,
              isUsed ? styles.statusPillUsed : styles.statusPillValid,
            ]}>
              <Text style={[
                styles.statusPillText,
                isUsed ? styles.statusPillTextUsed : styles.statusPillTextValid,
              ]}>
                {isUsed ? "✗  Already Used" : "✓  Valid — Not Used"}
              </Text>
            </View>
          </View>

          {coupon?.expires_at && (
            <View style={styles.couponCardFooter}>
              <Text style={styles.expiryLabel}>Valid till</Text>
              <Text style={styles.expiryValue}>
                {new Date(coupon.expires_at).toLocaleDateString("en-IN", {
                  day: "2-digit", month: "long", year: "numeric",
                })}
              </Text>
            </View>
          )}
        </View>

        {/* How to use */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>📋  How to use</Text>
          <Text style={styles.infoStep}>1. Visit IntenCiv Diagnostics centre</Text>
          <Text style={styles.infoStep}>2. Show this coupon code to the receptionist</Text>
          <Text style={styles.infoStep}>3. Receptionist verifies and applies the benefit</Text>
          <Text style={styles.infoStep}>4. Enjoy your health benefit!</Text>
        </View>

        {/* Terms */}
        <View style={styles.termsCard}>
          <Text style={styles.termsTitle}>⚠️  Terms & Conditions</Text>
          <Text style={styles.termsText}>• {condition}</Text>
          <Text style={styles.termsText}>• Valid for 1 year from membership activation date.</Text>
          <Text style={styles.termsText}>• Non-transferable. Cannot be exchanged for cash.</Text>
          <Text style={styles.termsText}>• One coupon per visit unless stated otherwise.</Text>
        </View>

        {/* Share Button */}
        {!isUsed && (
          <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
            <Text style={styles.shareBtnText}>Share Coupon Code</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.backBtnBottom}
          onPress={() => router.back()}
        >
          <Text style={styles.backBtnBottomText}>← Back to My Coupons</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f4f7fb" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    backgroundColor: "#0A5C9B",
    paddingTop: 56, paddingBottom: 16, paddingHorizontal: 20,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  backBtn: { width: 60 },
  backText: { color: "#cce4f7", fontSize: 14 },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "700" },
  body: { padding: 16 },
  couponCard: {
    backgroundColor: "#fff", borderRadius: 16, overflow: "hidden",
    shadowColor: "#000", shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1, shadowRadius: 6, elevation: 4, marginBottom: 14,
  },
  couponCardUsed: { opacity: 0.7 },
  couponCardHeader: {
    backgroundColor: "#0A5C9B", padding: 16, alignItems: "center",
  },
  brandName: { color: "#fff", fontSize: 22, fontWeight: "700" },
  brandSub: { color: "#cce4f7", fontSize: 12, marginTop: 2 },
  couponCardBody: { padding: 20, alignItems: "center" },
  couponIcon: { fontSize: 40, marginBottom: 8 },
  benefitName: {
    fontSize: 16, fontWeight: "700", color: "#1a2940",
    textAlign: "center", marginBottom: 16,
  },
  codeBox: {
    alignItems: "center", padding: 16, backgroundColor: "#f8fafc",
    width: "100%", borderRadius: 10,
    borderWidth: 2, borderColor: "#0A5C9B", borderStyle: "dashed",
    marginBottom: 16,
  },
  codeLabel: {
    fontSize: 10, color: "#999", letterSpacing: 2,
    fontWeight: "600", marginBottom: 6,
  },
  codeText: {
    fontSize: 16, fontWeight: "700", color: "#0A5C9B",
    fontFamily: "SpaceMono-Regular", letterSpacing: 1,
  },
  codeTextUsed: { color: "#999", textDecorationLine: "line-through" },
  statusPill: {
    borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8,
  },
  statusPillValid: { backgroundColor: "#e8f5e9" },
  statusPillUsed: { backgroundColor: "#ffebee" },
  statusPillText: { fontSize: 13, fontWeight: "700" },
  statusPillTextValid: { color: "#2e7d32" },
  statusPillTextUsed: { color: "#c62828" },
  couponCardFooter: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", paddingHorizontal: 20, paddingVertical: 12,
    backgroundColor: "#f8fafc", borderTopWidth: 1, borderTopColor: "#f0f4f8",
  },
  expiryLabel: { fontSize: 11, color: "#999" },
  expiryValue: { fontSize: 13, fontWeight: "600", color: "#333" },
  infoCard: {
    backgroundColor: "#fff", borderRadius: 12, padding: 16,
    marginBottom: 12,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 3, elevation: 2,
  },
  infoTitle: { fontSize: 14, fontWeight: "700", color: "#1a2940", marginBottom: 10 },
  infoStep: { fontSize: 13, color: "#555", marginBottom: 6, lineHeight: 18 },
  termsCard: {
    backgroundColor: "#fff8e1", borderRadius: 12, padding: 16,
    marginBottom: 16, borderLeftWidth: 4, borderLeftColor: "#f9a825",
  },
  termsTitle: { fontSize: 13, fontWeight: "700", color: "#e65100", marginBottom: 8 },
  termsText: { fontSize: 12, color: "#666", marginBottom: 4, lineHeight: 18 },
  shareBtn: {
    backgroundColor: "#0A5C9B", borderRadius: 12,
    paddingVertical: 14, alignItems: "center", marginBottom: 10,
  },
  shareBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  backBtnBottom: {
    borderRadius: 12, paddingVertical: 14,
    alignItems: "center", marginBottom: 8,
  },
  backBtnBottomText: { color: "#0A5C9B", fontSize: 14, fontWeight: "600" },
});
