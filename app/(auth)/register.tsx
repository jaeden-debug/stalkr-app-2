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
      toast.success('Account created! Welcome to ' + APP_CONFIG.name);
      router.replace('/(tabs)/map');
    } else {
      toast.error('Registration failed. Try a different email.');
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
        <View style={styles.brand}>
          <View style={styles.logoMark}><Ionicons name="navigate" size={34} color="#22c55e" /></View>
          <Text style={styles.brandName}>Create Account</Text>
          <Text style={styles.brandTagline}>Join the crew</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Display Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Your name or call sign"
              placeholderTextColor="rgba(255,255,255,0.35)"
              value={displayName}
              onChangeText={setDisplayName}
              autoCapitalize="words"
              returnKeyType="next"
              selectionColor="#22c55e"
            />
          </View>
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
              returnKeyType="next"
              selectionColor="#22c55e"
            />
          </View>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="6+ characters"
              placeholderTextColor="rgba(255,255,255,0.35)"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              returnKeyType="done"
              onSubmitEditing={handleRegister}
              selectionColor="#22c55e"
            />
          </View>
          <Button label="Create Account" onPress={handleRegister} loading={loading} fullWidth size="lg" />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <Link href="/(auth)/login" asChild>
            <TouchableOpacity>
              <Text style={styles.footerLink}>Sign In</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0a0f' },
  container: { flexGrow: 1, padding: 24, justifyContent: 'center', gap: 32 },
  brand: { alignItems: 'center', gap: 8 },
  logoMark: { width: 72, height: 72, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(34,197,94,0.12)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.4)' },
  brandName: { color: '#e8e8f0', fontSize: 32, fontWeight: '800', letterSpacing: 1 },
  brandTagline: { color: '#8888aa', fontSize: 14 },
  form: { gap: 16 },
  fieldGroup: { gap: 6 },
  label: { color: '#8888aa', fontSize: 13, fontWeight: '600', letterSpacing: 0.5 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12,
    padding: 14,
    color: '#e8e8f0',
    fontSize: 16,
    height: 52,
  },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  footerText: { color: '#8888aa', fontSize: 14 },
  footerLink: { color: '#22c55e', fontSize: 14, fontWeight: '700' },
});
