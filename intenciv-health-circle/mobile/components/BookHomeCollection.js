import { TouchableOpacity, Text, View, StyleSheet, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS } from '../constants/colors';
import { CONFIG } from '../constants/config';

export default function BookHomeCollection({ compact = false }) {
  const open = () => Linking.openURL(CONFIG.WEBSITE_URL);

  return (
    <TouchableOpacity onPress={open} activeOpacity={0.85} testID="book-home-collection-btn">
      <View style={[styles.btn, compact && { paddingVertical: 12 }]}>
        <Ionicons name="home" size={20} color={COLORS.white} />
        <Text style={styles.btnText}>Book Home Collection</Text>
      </View>
      <Text style={styles.subtitle}>Get tests done at home — book on our website</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    height: 48,
    backgroundColor: COLORS.primaryCyan,
    borderRadius: RADIUS.button,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  btnText: { color: COLORS.white, fontWeight: '700', fontSize: 16 },
  subtitle: { color: COLORS.textMid, fontSize: 13, textAlign: 'center', marginTop: 8 },
});
