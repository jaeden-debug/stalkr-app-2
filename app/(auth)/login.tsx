import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/useAuthStore';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { APP_CONFIG } from '@/config/app';
import { useAnalytics } from '@/hooks/useAnalytics';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { signIn, loading, error } = useAuthStore();
  const toast = useToast();
  const router = useRouter();
  const { track } = useAnalytics();

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      toast.error('Please enter email and password');
      return;
    }
    const success = await signIn(email.trim(), password);
    if (success) {
      track({ name: 'signed_in' });
      router.replace('/(tabs)/map');
    } else {
      toast.error(error || 'Login failed. Check your credentials.');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo / branding */}
        <View style={styles.brand}>
          <View style={styles.logoMark}>
            <Ionicons name="navigate" size={34} color="#22c55e" />
          </View>
          <Text style={styles.brandName}>{APP_CONFIG.name}</Text>
          <Text style={styles.brandTagline}>Real-time location awareness & safety</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="your@email.com"
              placeholderTextColor="rgba(255,255,255,0.35)"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              returnKeyType="next"
              selectionColor="#22c55e"
            />
          </View>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor="rgba(255,255,255,0.35)"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              returnKeyType="done"
              onSubmitEditing={handleLogin}
              selectionColor="#22c55e"
            />
          </View>
          <Button
            label="Sign In"
            onPress={handleLogin}
            loading={loading}
            fullWidth
            size="lg"
          />
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Don't have an account? </Text>
          <Link href="/(auth)/register" asChild>
            <TouchableOpacity>
              <Text style={styles.footerLink}>Sign Up</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0a0f' },
  container: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
    gap: 32,
  },
  brand: { alignItems: 'center', gap: 10 },
  logoMark: {
    width: 72, height: 72, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(34,197,94,0.12)',
    borderWidth: 1, borderColor: 'rgba(34,197,94,0.4)',
    shadowColor: '#22c55e', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5, shadowRadius: 16,
  },
  brandName: {
    color: '#f8fafc',
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: 4,
  },
  brandTagline: { color: 'rgba(255,255,255,0.5)', fontSize: 13 },
  form: { gap: 16 },
  fieldGroup: { gap: 6 },
  label: { color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '600', letterSpacing: 0.5 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 14,
    padding: 14,
    color: '#f8fafc',
    fontSize: 16,
    height: 52,
  },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  footerText: { color: '#8888aa', fontSize: 14 },
  footerLink: { color: '#22c55e', fontSize: 14, fontWeight: '700' },
});
