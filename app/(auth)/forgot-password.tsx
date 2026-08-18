import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { resetPassword } from '@/services/auth';
import { AuthScaffold, AuthField, authInputStyle } from '@/components/auth/AuthScaffold';
import { C } from '@/constants/theme';

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

  if (sent) {
    return (
      <AuthScaffold
        eyebrow="PASSWORD RESET"
        title="Check your email"
        subtitle={`If an account exists for ${email.trim()}, we've sent a link to reset your password. It expires shortly.`}
        showBrand={false}
      >
        <View style={s.sentBadge}>
          <Ionicons name="mail-open-outline" size={26} color={C.green} />
        </View>
        <Button
          label="Back to sign in"
          onPress={() => router.replace('/(auth)/login')}
          fullWidth
          size="lg"
        />
      </AuthScaffold>
    );
  }

  return (
    <AuthScaffold
      eyebrow="PASSWORD RESET"
      title="Reset your password"
      subtitle="Enter your email and we'll send you a link to set a new one."
      showBrand={false}
      footer={
        <TouchableOpacity onPress={() => router.replace('/(auth)/login')}>
          <Text style={s.footerLink}>Back to sign in</Text>
        </TouchableOpacity>
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
          returnKeyType="send"
          onSubmitEditing={handleSend}
          selectionColor={C.green}
        />
      </AuthField>

      <Button label="Send reset link" onPress={handleSend} loading={loading} fullWidth size="lg" />
    </AuthScaffold>
  );
}

const s = StyleSheet.create({
  sentBadge: {
    alignSelf: 'center',
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.greenDim,
    borderWidth: 1,
    borderColor: C.greenBorder,
    marginBottom: 4,
  },
  footerLink: { color: C.green, fontSize: 13.5, fontWeight: '800' },
});
