import React, { useEffect, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, ActivityIndicator, RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { apiFetch } from "@/src/utils/api";
import { getToken, getUser, clearAuth } from "@/src/utils/storage";

const BENEFITS = [
  { icon: "🩺", title: "Free Health Check-up", desc: "1 complete health check-up absolutely free" },
  { icon: "🏠", title: "Free Home Collection", desc: "3 free home sample collection visits" },
  { icon: "💊", title: "Free Vital Checks", desc: "3 free vital check sessions" },
  { icon: "🎁", title: "BOGO Package", desc: "1+1 offer on advance or premium health package" },
  { icon: "❤️", title: "Support Elderly", desc: "4 referrals — free basic testing for cardiac, kidney, gastro or cancer patients" },
  { icon: "🔬", title: "IntenCiv 30% Off", desc: "30% discount on all in-house testing" },
  { icon: "🤰", title: "Maternity 35% Off", desc: "35% discount on all tests for pregnant women" },
  { icon: "💙", title: "Intenshe 20% Off", desc: "20% off any Intenshe health package" },
];

export default function HomeScreen() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [membership, setMembership] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    try {
      const u = await getUser();
      const token = await getToken();
      setUser(u);
      if (token) {
        const data = await apiFetch("/customer/me", {}, token);
        setMembership(data?.card || null);
      }
    } catch {
      // membership may not exist yet
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleLogout() {
    await clearAuth();
    router.replace("/login");
  }

  function daysLeft() {
    if (!membership?.expires_at) return null;
    const diff = new Date(membership.expires_at).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0A5C9B" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); load(); }}
        />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>
            Hello, {user?.full_name?.split(" ")[0] || "Member"} 👋
          </Text>
          <Text style={styles.headerSub}>IntenCiv Health Privilege</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {/* Membership Card */}
      {membership && (
        <View style={styles.memberCard}>
          <View style={styles.memberCardTop}>
            <Text style={styles.memberCardTitle}>HEALTH PRIVILEGE CARD</Text>
            <View style={styles.activeBadge}>
              <Text style={styles.activeBadgeText}>ACTIVE</Text>
            </View>
          </View>
          <Text style={styles.memberName}>{user?.full_name}</Text>
          <Text style={styles.memberCardNo}>{membership.number}</Text>
          <View style={styles.memberCardBottom}>
            <View>
              <Text style={styles.memberLabel}>Valid till</Text>
              <Text style={styles.memberValue}>
                {new Date(membership.expires_at).toLocaleDateString("en-IN", {
                  day: "2-digit", month: "short", year: "numeric",
                })}
              </Text>
            </View>
            <View style={styles.daysBox}>
              <Text style={styles.daysNum}>{daysLeft()}</Text>
              <Text style={styles.daysLabel}>days left</Text>
            </View>
          </View>
        </View>
      )}

      {/* My Coupons Button */}
      <TouchableOpacity
        style={styles.couponBtn}
        onPress={() => router.push("/(tabs)/coupons")}
      >
        <Text style={styles.couponBtnText}>🎫  View My Coupons</Text>
      </TouchableOpacity>

      {/* About IntenCiv */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About IntenCiv</Text>
        <Text style={styles.aboutText}>
          IntenCiv Diagnostics is a trusted diagnostic centre offering
          comprehensive health testing, home collection services, and
          specialized packages for individuals and families. With
          state-of-the-art equipment and experienced professionals, we
          are committed to delivering accurate results and compassionate care.
        </Text>
      </View>

      {/* Membership Benefits */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Your Membership Benefits</Text>
        {BENEFITS.map((b, i) => (
          <View key={i} style={styles.benefitCard}>
            <Text style={styles.benefitIcon}>{b.icon}</Text>
            <View style={styles.benefitInfo}>
              <Text style={styles.benefitTitle}>{b.title}</Text>
              <Text style={styles.benefitDesc}>{b.desc}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Latest Offers */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Latest Offers</Text>
        <View style={styles.offerCard}>
          <Text style={styles.offerEmoji}>🌟</Text>
          <View style={styles.offerInfo}>
            <Text style={styles.offerTitle}>Intenshe Women's Health</Text>
            <Text style={styles.offerDesc}>20% off on all Intenshe packages — exclusive for members</Text>
          </View>
        </View>
        <View style={styles.offerCard}>
          <Text style={styles.offerEmoji}>👴</Text>
          <View style={styles.offerInfo}>
            <Text style={styles.offerTitle}>Senior Care Program</Text>
            <Text style={styles.offerDesc}>Refer elderly patients for free basic testing with medical records</Text>
          </View>
        </View>
        <View style={styles.offerCard}>
          <Text style={styles.offerEmoji}>🤰</Text>
          <View style={styles.offerInfo}>
            <Text style={styles.offerTitle}>Maternity Care</Text>
            <Text style={styles.offerDesc}>35% off on all tests for pregnant women — use your maternity coupon</Text>
          </View>
        </View>
      </View>

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f4f7fb" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    backgroundColor: "#0A5C9B",
    paddingTop: 56, paddingBottom: 20, paddingHorizontal: 20,
    flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end",
  },
  greeting: { color: "#fff", fontSize: 20, fontWeight: "700" },
  headerSub: { color: "#cce4f7", fontSize: 13, marginTop: 2 },
  logoutBtn: {
    borderWidth: 1, borderColor: "#fff",
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6,
  },
  logoutText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  memberCard: {
    margin: 16, borderRadius: 16,
    backgroundColor: "#0A5C9B",
    padding: 20,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 8, elevation: 6,
  },
  memberCardTop: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", marginBottom: 12,
  },
  memberCardTitle: { color: "#cce4f7", fontSize: 11, fontWeight: "700", letterSpacing: 1.5 },
  activeBadge: {
    backgroundColor: "#0FF4C6", borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  activeBadgeText: { color: "#050C18", fontSize: 10, fontWeight: "800" },
  memberName: { color: "#fff", fontSize: 20, fontWeight: "700", marginBottom: 4 },
  memberCardNo: { color: "#90caf9", fontSize: 13, fontFamily: "monospace", marginBottom: 16 },
  memberCardBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  memberLabel: { color: "#cce4f7", fontSize: 10, marginBottom: 2 },
  memberValue: { color: "#fff", fontSize: 14, fontWeight: "600" },
  daysBox: { alignItems: "center" },
  daysNum: { color: "#0FF4C6", fontSize: 28, fontWeight: "800" },
  daysLabel: { color: "#cce4f7", fontSize: 11 },
  couponBtn: {
    marginHorizontal: 16, marginBottom: 8,
    backgroundColor: "#fff", borderRadius: 12,
    padding: 16, alignItems: "center",
    borderWidth: 2, borderColor: "#0A5C9B",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 4, elevation: 3,
  },
  couponBtnText: { color: "#0A5C9B", fontSize: 15, fontWeight: "700" },
  section: { margin: 16, marginTop: 8 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#1a2940", marginBottom: 12 },
  aboutText: { fontSize: 14, color: "#555", lineHeight: 22 },
  benefitCard: {
    flexDirection: "row", alignItems: "flex-start",
    backgroundColor: "#fff", borderRadius: 12, padding: 14,
    marginBottom: 8,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 3, elevation: 2,
  },
  benefitIcon: { fontSize: 24, marginRight: 12, marginTop: 2 },
  benefitInfo: { flex: 1 },
  benefitTitle: { fontSize: 14, fontWeight: "700", color: "#1a2940", marginBottom: 2 },
  benefitDesc: { fontSize: 13, color: "#666", lineHeight: 18 },
  offerCard: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#fff", borderRadius: 12, padding: 14,
    marginBottom: 8,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 3, elevation: 2,
  },
  offerEmoji: { fontSize: 28, marginRight: 12 },
  offerInfo: { flex: 1 },
  offerTitle: { fontSize: 14, fontWeight: "700", color: "#1a2940", marginBottom: 2 },
  offerDesc: { fontSize: 13, color: "#666", lineHeight: 18 },
});
