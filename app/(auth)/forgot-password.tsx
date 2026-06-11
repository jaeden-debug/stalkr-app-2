import React, { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { resetPassword } from '@/services/auth';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSend = async () => {
    if (!email.trim()) { toast.error('Enter your email'); return; }
    setLoading(true);
    const res = await resetPassword(email.trim());
    setLoading(false);
    if (res.success) setSent(true);
    else toast.error(res.error || 'Could not send reset email.');
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.container}>
        <View style={styles.brand}>
          <Image source={require('../../assets/stalkr-logo.png')} style={styles.logo} resizeMode="contain" />
          <Text style={styles.title}>Reset password</Text>
        </View>

        {sent ? (
          <View style={styles.sentBox}>
            <Text style={styles.sentTitle}>Check your email</Text>
            <Text style={styles.sentText}>
              If an account exists for {email.trim()}, we&rsquo;ve sent a link to reset your password.
              Open it on this device to set a new one.
            </Text>
            <Button label="Back to sign in" onPress={() => router.replace('/(auth)/login')} fullWidth size="lg" />
          </View>
        ) : (
          <View style={styles.form}>
            <Text style={styles.sub}>Enter your email and we&rsquo;ll send you a reset link.</Text>
            <TextInput
              style={styles.input}
              placeholder="your@email.com"
              placeholderTextColor="rgba(255,255,255,0.35)"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              returnKeyType="send"
              onSubmitEditing={handleSend}
              selectionColor="#22c55e"
            />
            <Button label="Send reset link" onPress={handleSend} loading={loading} fullWidth size="lg" />
            <TouchableOpacity onPress={() => router.replace('/(auth)/login')} style={styles.backLink}>
              <Text style={styles.backText}>‹ Back to sign in</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0a0f' },
  container: { flex: 1, padding: 24, justifyContent: 'center', gap: 28 },
  brand: { alignItems: 'center', gap: 10 },
  logo: { width: 84, height: 84 },
  title: { color: '#f8fafc', fontSize: 26, fontWeight: '900', letterSpacing: 2 },
  form: { gap: 14 },
  sub: { color: 'rgba(255,255,255,0.55)', fontSize: 14, textAlign: 'center' },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 14, padding: 14, color: '#f8fafc', fontSize: 16, height: 52,
  },
  backLink: { alignItems: 'center', paddingVertical: 6 },
  backText: { color: '#22c55e', fontSize: 14, fontWeight: '600' },
  sentBox: { gap: 14, alignItems: 'center' },
  sentTitle: { color: '#f8fafc', fontSize: 20, fontWeight: '800' },
  sentText: { color: 'rgba(255,255,255,0.6)', fontSize: 14, textAlign: 'center', lineHeight: 21 },
});
