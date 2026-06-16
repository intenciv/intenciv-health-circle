import React, { useEffect, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, ActivityIndicator, RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { apiFetch } from "@/src/utils/api";
import { getToken } from "@/src/utils/storage";

type Coupon = {
  coupon_code: string;
  status: "unused" | "used";
};

type CouponGroup = {
  benefit_name: string;
  benefit_code: string;
  coupons: Coupon[];
};

const ICONS: Record<string, string> = {
  HC: "🩺", HM: "🏠", VC: "💊", BG: "🎁",
  SE: "❤️", IC: "🔬", MT: "🤰", IS: "💙",
};

export default function CouponsScreen() {
  const router = useRouter();
  const [groups, setGroups] = useState<CouponGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    try {
      const token = await getToken();
      const data = await apiFetch("/customer/coupons", {}, token || undefined);
      setGroups(data.benefits || []);  // ✅ fixed from data.groups
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { load(); }, []);

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
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Coupons</Text>
        <Text style={styles.headerSub}>Show coupon code at IntenCiv reception</Text>
      </View>

      <View style={styles.body}>
        {groups.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🎫</Text>
            <Text style={styles.emptyTitle}>No coupons found</Text>
            <Text style={styles.emptyText}>
              Your coupons will appear here once your membership is activated.
            </Text>
          </View>
        )}

        {groups.map((group, gi) => {
          const used = group.coupons.filter((c) => c.status === "used").length;
          const total = group.coupons.length;
          const icon = ICONS[group.benefit_code] || "🎫";
          const allUsed = used === total;

          return (
            <View key={gi} style={[styles.groupCard, allUsed && styles.groupCardUsed]}>
              <View style={styles.groupHeader}>
                <Text style={styles.groupIcon}>{icon}</Text>
                <View style={styles.groupInfo}>
                  <Text style={styles.groupTitle}>{group.benefit_name}</Text>
                  <Text style={styles.groupCount}>
                    {total - used} of {total} remaining
                  </Text>
                </View>
                <View style={[styles.badge, allUsed && styles.badgeUsed]}>
                  <Text style={[styles.badgeText, allUsed && styles.badgeTextUsed]}>
                    {allUsed ? "All Used" : `${total - used} left`}
                  </Text>
                </View>
              </View>

              <View style={styles.couponList}>
                {group.coupons.map((c, ci) => (
                  <TouchableOpacity
                    key={ci}
                    style={[
                      styles.couponRow,
                      c.status === "used" && styles.couponRowUsed,
                      ci === group.coupons.length - 1 && styles.couponRowLast,
                    ]}
                    onPress={() =>
                      c.status === "unused" &&
                      router.push(`/coupon/${c.coupon_code}`)
                    }
                    disabled={c.status === "used"}
                  >
                    <Text style={[
                      styles.couponCode,
                      c.status === "used" && styles.couponCodeUsed,
                    ]}>
                      {c.coupon_code}
                    </Text>
                    <View style={[
                      styles.statusBadge,
                      c.status === "used" ? styles.statusUsed : styles.statusUnused,
                    ]}>
                      <Text style={[
                        styles.statusText,
                        c.status === "used" && styles.statusTextUsed,
                      ]}>
                        {c.status === "used" ? "Used" : "Valid ›"}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          );
        })}
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
  },
  headerTitle: { fontSize: 22, fontWeight: "700", color: "#fff" },
  headerSub: { fontSize: 12, color: "#cce4f7", marginTop: 4 },
  body: { padding: 16 },
  empty: { alignItems: "center", marginTop: 60, paddingHorizontal: 32 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#333", marginBottom: 6 },
  emptyText: { fontSize: 13, color: "#999", textAlign: "center", lineHeight: 18 },
  groupCard: {
    backgroundColor: "#fff", borderRadius: 14, marginBottom: 14,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 4, elevation: 3, overflow: "hidden",
  },
  groupCardUsed: { opacity: 0.7 },
  groupHeader: {
    flexDirection: "row", alignItems: "center", padding: 14,
    borderBottomWidth: 1, borderBottomColor: "#f0f4f8",
  },
  groupIcon: { fontSize: 26, marginRight: 12 },
  groupInfo: { flex: 1 },
  groupTitle: { fontSize: 14, fontWeight: "700", color: "#1a2940" },
  groupCount: { fontSize: 11, color: "#666", marginTop: 2 },
  badge: {
    backgroundColor: "#e8f5e9", borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  badgeUsed: { backgroundColor: "#f5f5f5" },
  badgeText: { fontSize: 10, fontWeight: "700", color: "#2e7d32" },
  badgeTextUsed: { color: "#999" },
  couponList: { paddingHorizontal: 14, paddingTop: 4, paddingBottom: 8 },
  couponRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#f5f5f5",
  },
  couponRowLast: { borderBottomWidth: 0 },
  couponRowUsed: { opacity: 0.5 },
  couponCode: {
    fontFamily: "SpaceMono-Regular", fontSize: 12,
    color: "#0A5C9B", fontWeight: "600",
  },
  couponCodeUsed: { color: "#999", textDecorationLine: "line-through" },
  statusBadge: { borderRadius: 5, paddingHorizontal: 8, paddingVertical: 3 },
  statusUnused: { backgroundColor: "#e3f2fd" },
  statusUsed: { backgroundColor: "#f5f5f5" },
  statusText: { fontSize: 10, fontWeight: "700", color: "#1565c0" },
  statusTextUsed: { color: "#999" },
});
