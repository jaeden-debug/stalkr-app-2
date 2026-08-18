import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useAuthStore } from '@/store/useAuthStore';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { useAnalytics } from '@/hooks/useAnalytics';
import { APP_CONFIG } from '@/config/app';
import { AuthScaffold, AuthField, authInputStyle } from '@/components/auth/AuthScaffold';
import { C } from '@/constants/theme';

export default function RegisterScreen() {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { signUp, loading } = useAuthStore();
  const toast = useToast();
  const router = useRouter();
  const { track } = useAnalytics();

  const handleRegister = async () => {
    if (!displayName.trim()) { toast.error('Enter a display name'); return; }
    if (!email.trim()) { toast.error('Enter your email'); return; }
    if (password.length < 6) { toast.error('Password must be 6+ characters'); return; }

    const success = await signUp(email.trim(), password, displayName.trim());
    if (success) {
      track({ name: 'signed_up' });
      toast.success(`Account created! Welcome to ${APP_CONFIG.name}`);
      router.replace('/(tabs)/map');
    } else {
      toast.error('Registration failed. Try a different email.');
    }
  };

  return (
    <AuthScaffold
      eyebrow="CREATE ACCOUNT"
      title="Join your crew"
      subtitle="Real-time location awareness for the people you move with."
      footer={
        <>
          <Text style={s.footerText}>Already have an account? </Text>
          <Link href="/(auth)/login" asChild>
            <TouchableOpacity>
              <Text style={s.footerLink}>Sign in</Text>
            </TouchableOpacity>
          </Link>
        </>
      }
    >
      <AuthField label="Display name">
        <TextInput
          style={authInputStyle}
          placeholder="How your crew sees you"
          placeholderTextColor={C.textMuted}
          value={displayName}
          onChangeText={setDisplayName}
          autoCapitalize="words"
          returnKeyType="next"
          selectionColor={C.green}
        />
      </AuthField>

      <AuthField label="Email">
        <TextInput
          style={authInputStyle}
          placeholder="you@example.com"
          placeholderTextColor={C.textMuted}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          returnKeyType="next"
          selectionColor={C.green}
        />
      </AuthField>

      <AuthField label="Password">
        <TextInput
          style={authInputStyle}
          placeholder="At least 6 characters"
          placeholderTextColor={C.textMuted}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="new-password"
          returnKeyType="done"
          onSubmitEditing={handleRegister}
          selectionColor={C.green}
        />
      </AuthField>

      <Button label="Create Account" onPress={handleRegister} loading={loading} fullWidth size="lg" />

      <Text style={s.legal}>
        By creating an account you agree to share your location with crews you join.
        You can go dark at any time.
      </Text>
    </AuthScaffold>
  );
}

const s = StyleSheet.create({
  legal: { color: C.textMuted, fontSize: 11.5, lineHeight: 16, textAlign: 'center' },
  footerText: { color: C.textSub, fontSize: 13.5 },
  footerLink: { color: C.green, fontSize: 13.5, fontWeight: '800' },
});
