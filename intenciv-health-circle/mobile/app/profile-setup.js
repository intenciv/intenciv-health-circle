import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { COLORS, RADIUS } from '../constants/colors';
import { api } from '../services/api';
import { useAuth } from '../hooks/useAuth';

export default function ProfileSetup() {
  const { user, updateUser } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({
    full_name: user?.full_name || '',
    address:   user?.address   || '',
    city:      user?.city      || '',
    pincode:   user?.pincode   || '',
    email:     user?.email     || '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const valid = form.full_name.trim().length >= 2
    && form.address.trim().length > 0
    && form.city.trim().length > 0
    && /^\d{4,10}$/.test(form.pincode.trim());

  async function save() {
    if (!valid) { setError('Please fill all required fields.'); return; }
    setLoading(true); setError('');
    try {
      const payload = { ...form };
      if (!payload.email) delete payload.email;
      const { data } = await api.put('/client/profile', payload);
      await updateUser(data.user);
      router.replace('/(tabs)/home');
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to save profile');
    } finally { setLoading(false); }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.h1}>Tell us a little about you</Text>
          <Text style={styles.sub}>So we can deliver your reports correctly.</Text>

          <Field testID="name-input"    label="Full name *"        value={form.full_name} onChangeText={v => setForm({ ...form, full_name: v })} />
          <Field testID="address-input" label="Address line 1 *"   value={form.address}   onChangeText={v => setForm({ ...form, address: v })} multiline />
          <Field testID="city-input"    label="City *"             value={form.city}      onChangeText={v => setForm({ ...form, city: v })} />
          <Field testID="pincode-input" label="Pincode *"          value={form.pincode}   onChangeText={v => setForm({ ...form, pincode: v.replace(/\D/g, '') })} keyboardType="number-pad" maxLength={10} />
          <Field testID="email-input"   label="Email (optional)"   value={form.email}     onChangeText={v => setForm({ ...form, email: v })} keyboardType="email-address" autoCapitalize="none" />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            testID="save-profile-btn"
            onPress={save}
            disabled={!valid || loading}
            style={[styles.btn, (!valid || loading) && { backgroundColor: COLORS.disabledBg }]}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color={COLORS.white} />
              : <Text style={[styles.btnText, !valid && { color: COLORS.textMid }]}>Save & Continue</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, multiline, ...props }) {
  return (
    <View style={{ marginTop: 16 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...props}
        placeholderTextColor={COLORS.textMid}
        multiline={multiline}
        style={[styles.input, multiline && { height: 92, paddingTop: 12, textAlignVertical: 'top' }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.lightBlueBg },
  scroll: { padding: 24, paddingBottom: 60 },
  h1:     { fontSize: 24, fontWeight: '700', color: COLORS.deepNavy },
  sub:    { color: COLORS.textMid, marginTop: 6, fontSize: 14 },
  label:  { color: COLORS.textMid, marginBottom: 6, fontSize: 13, fontWeight: '500' },
  input:  {
    backgroundColor: COLORS.surfaceBlue, borderRadius: RADIUS.button,
    borderWidth: 1.5, borderColor: COLORS.border, height: 48,
    paddingHorizontal: 14, fontSize: 15, color: COLORS.textDark,
  },
  error:  { color: COLORS.dangerRed, marginTop: 14, fontSize: 13 },
  btn:    {
    marginTop: 24, height: 48, backgroundColor: COLORS.primaryCyan,
    borderRadius: RADIUS.button, alignItems: 'center', justifyContent: 'center',
  },
  btnText:{ color: COLORS.white, fontSize: 16, fontWeight: '700' },
});
