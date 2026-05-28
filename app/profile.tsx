import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/useAuthStore';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { useToast } from '@/components/ui/Toast';

export default function ProfileScreen() {
  const router = useRouter();
  const toast = useToast();
  const { profile, updateProfile, loading } = useAuthStore();

  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [nickname, setNickname] = useState(profile?.nickname ?? '');
  const [initials, setInitials] = useState(profile?.initials ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');

  const handleSave = async () => {
    const ok = await updateProfile({ display_name: displayName, nickname, initials, phone });
    if (ok) { toast.success('Profile updated'); router.back(); }
    else toast.error('Failed to update profile');
  };

  return (
    <SafeAreaView style={styles.root}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.back}>‹ Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Edit Profile</Text>
          <View style={{ width: 60 }} />
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.avatarSection}>
            <Avatar uri={profile?.avatar_url} initials={initials || profile?.initials} displayName={displayName} size={80} color="#22c55e" />
            <Text style={styles.avatarHint}>Avatar from Supabase Storage (coming soon)</Text>
          </View>
          {[
            { label: 'Display Name', value: displayName, setter: setDisplayName, placeholder: 'Your full name' },
            { label: 'Nickname / Call Sign', value: nickname, setter: setNickname, placeholder: 'Short name shown on map' },
            { label: 'Initials', value: initials, setter: setInitials, placeholder: 'JD', maxLength: 3 },
            { label: 'Phone (optional)', value: phone, setter: setPhone, placeholder: '+1 555 000 0000', keyboardType: 'phone-pad' as const },
          ].map((field) => (
            <View key={field.label} style={styles.field}>
              <Text style={styles.label}>{field.label}</Text>
              <TextInput
                style={styles.input}
                value={field.value}
                onChangeText={field.setter}
                placeholder={field.placeholder}
                placeholderTextColor="#5555aa"
                maxLength={field.maxLength}
                keyboardType={field.keyboardType ?? 'default'}
                autoCapitalize="words"
                selectionColor="#22c55e"
              />
            </View>
          ))}
          <Button label="Save Profile" onPress={handleSave} loading={loading} fullWidth size="lg" />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0a0f' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a3a',
  },
  back: { color: '#22c55e', fontSize: 16, fontWeight: '600', width: 60 },
  title: { color: '#e8e8f0', fontSize: 18, fontWeight: '700' },
  content: { padding: 20, gap: 16 },
  avatarSection: { alignItems: 'center', gap: 8, paddingVertical: 8 },
  avatarHint: { color: '#5555aa', fontSize: 12 },
  field: { gap: 6 },
  label: { color: '#8888aa', fontSize: 13, fontWeight: '600', letterSpacing: 0.5 },
  input: {
    backgroundColor: '#1a1a24',
    borderWidth: 1,
    borderColor: '#2a2a3a',
    borderRadius: 12,
    padding: 14,
    color: '#e8e8f0',
    fontSize: 16,
    height: 52,
  },
});
