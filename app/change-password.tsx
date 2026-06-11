/**
 * Change password while logged in — no email required. Re-verifies the current
 * password against Supabase, then updates to the new one on the live session.
 */
import React, { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  KeyboardAvoidingView, Platform, SafeAreaView, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/services/supabase';
import { updatePassword } from '@/services/auth';
import { useAuthStore } from '@/store/useAuthStore';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { C } from '@/constants/theme';

export default function ChangePasswordScreen() {
  const router = useRouter();
  const toast = useToast();
  const email = useAuthStore((s) => s.user?.email ?? '');

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!current) { toast.error('Enter your current password'); return; }
    if (next.length < 6) { toast.error('New password must be at least 6 characters'); return; }
    if (next !== confirm) { toast.error('New passwords don’t match'); return; }
    if (next === current) { toast.error('New password must be different'); return; }

    setSaving(true);
    // Re-verify current password before allowing the change.
    const { error: verifyErr } = await supabase.auth.signInWithPassword({ email, password: current });
    if (verifyErr) {
      setSaving(false);
      toast.error('Current password is incorrect');
      return;
    }
    const res = await updatePassword(next);
    setSaving(false);
    if (res.success) {
      toast.success('Password updated');
      router.back();
    } else {
      toast.error(res.error || 'Could not update password.');
    }
  };

  return (
    <SafeAreaView style={s.root}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={s.header}>
          <TouchableOpacity style={s.back} onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="chevron-back" size={22} color={C.textPrimary} />
          </TouchableOpacity>
          <Text style={s.title}>CHANGE PASSWORD</Text>
          <View style={{ width: 38 }} />
        </View>

        <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
          <Text style={s.sub}>Update the password for {email || 'your account'}.</Text>

          <View style={s.field}>
            <Text style={s.label}>CURRENT PASSWORD</Text>
            <TextInput style={s.input} placeholder="••••••••" placeholderTextColor="rgba(255,255,255,0.3)" secureTextEntry value={current} onChangeText={setCurrent} selectionColor={C.green} />
          </View>
          <View style={s.field}>
            <Text style={s.label}>NEW PASSWORD</Text>
            <TextInput style={s.input} placeholder="6+ characters" placeholderTextColor="rgba(255,255,255,0.3)" secureTextEntry value={next} onChangeText={setNext} selectionColor={C.green} />
          </View>
          <View style={s.field}>
            <Text style={s.label}>CONFIRM NEW PASSWORD</Text>
            <TextInput style={s.input} placeholder="Re-enter new password" placeholderTextColor="rgba(255,255,255,0.3)" secureTextEntry value={confirm} onChangeText={setConfirm} returnKeyType="done" onSubmitEditing={handleSave} selectionColor={C.green} />
          </View>

          <Button label="Update password" onPress={handleSave} loading={saving} fullWidth size="lg" />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16,
  },
  back: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: C.surface,
    borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center',
  },
  title: { color: C.textPrimary, fontSize: 16, fontWeight: '900', letterSpacing: 1.2 },
  body: { padding: 20, gap: 18 },
  sub: { color: 'rgba(255,255,255,0.5)', fontSize: 13, lineHeight: 20 },
  field: { gap: 7 },
  label: { color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  input: {
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 14,
    padding: 14, color: C.textPrimary, fontSize: 16, height: 52,
  },
});
