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
        const data = await apiFetch("/customer/membership", {}, token);
        setMembership(data);
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
          <Text style={styles.memberCardNo}>{membership.card_number}</Text>
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
            <Text style={styles.offerDesc}>
              20% off on all Intenshe packages — exclusive for members
            </Text>
          </View>
        </View>
        <View style={styles.offerCard}>
          <Text style={styles.offerEmoji}>👴</Text>
          <View style={styles.offerInfo}>
            <Text style={styles.offerTitle}>Senior Care Program</Text>
            <Text style={styles.offerDesc}>
              Refer elderly patients for free basic testing with medical records
            </Text>
          </View>
        </View>
        <View style={styles.offerCard}>
          <Text style={styles.offerEmoji}>🤰</Text>
          <View style={styles.offerInfo}>
            <Text style={styles.offerTitle}>Maternity Care</Text>
            <Text style={styles.offerDesc}>
              35% off on all tests for pregnant women — use your maternity coupon
            </Text>
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
