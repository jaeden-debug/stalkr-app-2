import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useAuthStore } from '@/store/useAuthStore';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { useAnalytics } from '@/hooks/useAnalytics';
import { AuthScaffold, AuthField, authInputStyle } from '@/components/auth/AuthScaffold';
import { C } from '@/constants/theme';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { signIn, loading, error } = useAuthStore();
  const toast = useToast();
  const router = useRouter();
  const { track } = useAnalytics();

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      toast.error('Enter your email and password');
      return;
    }
    const success = await signIn(email.trim(), password);
    if (success) {
      track({ name: 'signed_in' });
      router.replace('/(tabs)/map');
    } else {
      toast.error(error || 'Sign in failed. Check your credentials.');
    }
  };

  return (
    <AuthScaffold
      eyebrow="SIGN IN"
      title="Welcome back"
      subtitle="Sign in to see where your crew is."
      footer={
        <>
          <Text style={s.footerText}>No account yet? </Text>
          <Link href="/(auth)/register" asChild>
            <TouchableOpacity>
              <Text style={s.footerLink}>Create one</Text>
            </TouchableOpacity>
          </Link>
        </>
      }
    >
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
          placeholder="••••••••"
          placeholderTextColor={C.textMuted}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="current-password"
          returnKeyType="done"
          onSubmitEditing={handleLogin}
          selectionColor={C.green}
        />
      </AuthField>

      <TouchableOpacity
        onPress={() => router.push('/(auth)/forgot-password')}
        style={s.forgot}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={s.forgotText}>Forgot password?</Text>
      </TouchableOpacity>

      <Button label="Sign In" onPress={handleLogin} loading={loading} fullWidth size="lg" />
    </AuthScaffold>
  );
}

const s = StyleSheet.create({
  forgot: { alignSelf: 'flex-end', marginTop: -4 },
  forgotText: { color: C.green, fontSize: 12.5, fontWeight: '700' },
  footerText: { color: C.textSub, fontSize: 13.5 },
  footerLink: { color: C.green, fontSize: 13.5, fontWeight: '800' },
});
