/**
 * Password reset screen — deep-link target for stalkr://reset (the link in the
 * Supabase recovery email). Parses the recovery token from the URL, establishes
 * the session, then lets the user set a new password.
 */
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { supabase } from '@/services/supabase';
import { updatePassword } from '@/services/auth';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';

function parseAuthParams(url: string): Record<string, string> {
  const out: Record<string, string> = {};
  const grab = (q: string) =>
    q.split('&').forEach((kv) => {
      const [k, v] = kv.split('=');
      if (k) out[decodeURIComponent(k)] = decodeURIComponent(v ?? '');
    });
  const hashIdx = url.indexOf('#');
  const qIdx = url.indexOf('?');
  if (qIdx >= 0) grab(url.slice(qIdx + 1, hashIdx >= 0 ? hashIdx : undefined));
  if (hashIdx >= 0) grab(url.slice(hashIdx + 1));
  return out;
}

export default function ResetScreen() {
  const router = useRouter();
  const toast = useToast();
  const url = Linking.useURL();

  const [ready, setReady] = useState(false);
  const [checked, setChecked] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!url || ready) return;
    const p = parseAuthParams(url);
    (async () => {
      try {
        if (p.access_token && p.refresh_token) {
          const { error } = await supabase.auth.setSession({ access_token: p.access_token, refresh_token: p.refresh_token });
          if (!error) setReady(true);
        } else if (p.code) {
          const { error } = await supabase.auth.exchangeCodeForSession(p.code);
          if (!error) setReady(true);
        }
      } catch {
        /* invalid / expired link */
      } finally {
        setChecked(true);
      }
    })();
  }, [url, ready]);

  const handleSave = async () => {
    if (password.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    if (password !== confirm) { toast.error('Passwords don’t match'); return; }
    setSaving(true);
    const res = await updatePassword(password);
    setSaving(false);
    if (res.success) {
      toast.success('Password updated');
      router.replace('/(tabs)/map');
    } else {
      toast.error(res.error || 'Could not update password.');
    }
  };

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={s.container}>
        <View style={s.brand}>
          <Image source={require('../assets/stalkr-logo.png')} style={s.logo} resizeMode="contain" />
          <Text style={s.title}>New password</Text>
        </View>

        {!ready && !checked && (
          <View style={s.center}><ActivityIndicator color="#22c55e" /><Text style={s.sub}>Opening your reset link…</Text></View>
        )}

        {!ready && checked && (
          <View style={s.center}>
            <Text style={s.sub}>This reset link is invalid or has expired. Request a new one from the sign-in screen.</Text>
            <Button label="Back to sign in" onPress={() => router.replace('/(auth)/login')} fullWidth size="lg" />
          </View>
        )}

        {ready && (
          <View style={s.form}>
            <Text style={s.sub}>Choose a new password for your account.</Text>
            <TextInput style={s.input} placeholder="New password" placeholderTextColor="rgba(255,255,255,0.35)" secureTextEntry value={password} onChangeText={setPassword} selectionColor="#22c55e" />
            <TextInput style={s.input} placeholder="Confirm new password" placeholderTextColor="rgba(255,255,255,0.35)" secureTextEntry value={confirm} onChangeText={setConfirm} returnKeyType="done" onSubmitEditing={handleSave} selectionColor="#22c55e" />
            <Button label="Update password" onPress={handleSave} loading={saving} fullWidth size="lg" />
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0a0f' },
  container: { flex: 1, padding: 24, justifyContent: 'center', gap: 28 },
  brand: { alignItems: 'center', gap: 10 },
  logo: { width: 84, height: 84 },
  title: { color: '#f8fafc', fontSize: 26, fontWeight: '900', letterSpacing: 2 },
  center: { alignItems: 'center', gap: 16 },
  form: { gap: 14 },
  sub: { color: 'rgba(255,255,255,0.55)', fontSize: 14, textAlign: 'center', lineHeight: 21 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 14, padding: 14, color: '#f8fafc', fontSize: 16, height: 52,
  },
});
