import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '@/store/useAuthStore';
import { uploadAvatar } from '@/services/auth';
import { Avatar } from '@/components/ui/Avatar';
import { useToast } from '@/components/ui/Toast';
import { C } from '@/constants/theme';

export default function ProfileScreen() {
  const router = useRouter();
  const toast = useToast();
  const { profile, user, updateProfile, loading } = useAuthStore();

  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [nickname, setNickname] = useState(profile?.nickname ?? '');
  const [initials, setInitials] = useState(profile?.initials ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [uploading, setUploading] = useState(false);

  // Emergency medical profile
  const [bloodType, setBloodType] = useState(profile?.blood_type ?? '');
  const [allergies, setAllergies] = useState(profile?.allergies ?? '');
  const [medications, setMedications] = useState(profile?.medications ?? '');
  const [medicalNotes, setMedicalNotes] = useState(profile?.medical_notes ?? '');
  const [shareMedical, setShareMedical] = useState(profile?.medical_share_with_crew ?? false);

  const handlePickAvatar = async () => {
    if (!user?.id) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { toast.error('Photo library permission needed'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.6,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setUploading(true);
    const url = await uploadAvatar(user.id, result.assets[0].uri);
    if (url) {
      await updateProfile({ avatar_url: url });
      toast.success('Photo updated');
    } else {
      toast.error('Upload failed');
    }
    setUploading(false);
  };

  const handleSave = async () => {
    const ok = await updateProfile({
      display_name: displayName.trim(),
      nickname: nickname.trim(),
      initials: initials.trim().toUpperCase(),
      phone: phone.trim(),
      blood_type: bloodType.trim() || null,
      allergies: allergies.trim() || null,
      medications: medications.trim() || null,
      medical_notes: medicalNotes.trim() || null,
      medical_share_with_crew: shareMedical,
    });
    if (ok) { toast.success('Profile saved'); router.back(); }
    else toast.error('Failed to update profile');
  };

  const fields = [
    { key: 'name', label: 'DISPLAY NAME', value: displayName, setter: setDisplayName, placeholder: 'Your full name', cap: 'words' as const, max: 40 },
    { key: 'nick', label: 'DEFAULT CALL SIGN', value: nickname, setter: setNickname, placeholder: 'Short name shown on the map', cap: 'words' as const, max: 24, hint: 'Each crew can override this in its settings.' },
    { key: 'init', label: 'INITIALS', value: initials, setter: setInitials, placeholder: 'JD', cap: 'characters' as const, max: 3, hint: 'Shown when you have no photo.' },
    { key: 'phone', label: 'PHONE (OPTIONAL)', value: phone, setter: setPhone, placeholder: '+1 555 000 0000', kb: 'phone-pad' as const, max: 20, hint: 'Lets crew call/text you and powers SOS texts.' },
  ];

  return (
    <SafeAreaView style={s.root}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={s.header}>
          <TouchableOpacity style={s.iconBtn} onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={s.title}>EDIT PROFILE</Text>
          <View style={{ width: 38 }} />
        </View>

        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          {/* Avatar */}
          <View style={s.avatarSection}>
            <TouchableOpacity onPress={handlePickAvatar} activeOpacity={0.85} disabled={uploading}>
              <Avatar uri={profile?.avatar_url} initials={initials || profile?.initials} displayName={displayName} size={96} color={C.green} />
              <View style={s.avatarBadge}>
                {uploading ? <ActivityIndicator size="small" color="#000" /> : <Ionicons name="camera" size={16} color="#000" />}
              </View>
            </TouchableOpacity>
            <Text style={s.avatarHint}>Tap to change photo</Text>
            <Text style={s.email} numberOfLines={1}>{user?.email}</Text>
          </View>

          {fields.map((f) => (
            <View key={f.key} style={s.field}>
              <Text style={s.label}>{f.label}</Text>
              <TextInput
                style={s.input}
                value={f.value}
                onChangeText={f.setter}
                placeholder={f.placeholder}
                placeholderTextColor="rgba(255,255,255,0.3)"
                maxLength={f.max}
                keyboardType={f.kb ?? 'default'}
                autoCapitalize={f.cap ?? 'sentences'}
                selectionColor={C.green}
              />
              {f.hint && <Text style={s.fieldHint}>{f.hint}</Text>}
            </View>
          ))}

          {/* Emergency medical profile */}
          <View style={s.medHeader}>
            <Ionicons name="medkit" size={16} color={C.red} />
            <Text style={s.medTitle}>EMERGENCY MEDICAL</Text>
          </View>
          <Text style={s.medHint}>Shown to first responders and (if you allow it) your crew during an SOS or on your card.</Text>

          <View style={s.field}>
            <Text style={s.label}>BLOOD TYPE</Text>
            <TextInput style={s.input} value={bloodType} onChangeText={setBloodType} placeholder="e.g. O+" placeholderTextColor="rgba(255,255,255,0.3)" maxLength={6} autoCapitalize="characters" selectionColor={C.green} />
          </View>
          <View style={s.field}>
            <Text style={s.label}>ALLERGIES</Text>
            <TextInput style={s.input} value={allergies} onChangeText={setAllergies} placeholder="e.g. Penicillin, bee stings" placeholderTextColor="rgba(255,255,255,0.3)" maxLength={120} selectionColor={C.green} />
          </View>
          <View style={s.field}>
            <Text style={s.label}>MEDICATIONS</Text>
            <TextInput style={s.input} value={medications} onChangeText={setMedications} placeholder="Current medications" placeholderTextColor="rgba(255,255,255,0.3)" maxLength={120} selectionColor={C.green} />
          </View>
          <View style={s.field}>
            <Text style={s.label}>MEDICAL NOTES</Text>
            <TextInput style={[s.input, s.inputMultiline]} value={medicalNotes} onChangeText={setMedicalNotes} placeholder="Conditions, devices, anything responders should know" placeholderTextColor="rgba(255,255,255,0.3)" maxLength={300} multiline selectionColor={C.green} />
          </View>

          <View style={s.shareRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.shareLabel}>Share with my crew</Text>
              <Text style={s.shareSub}>{shareMedical ? 'Crew can see this on your member card' : 'Hidden — only used during your own SOS'}</Text>
            </View>
            <Switch
              value={shareMedical}
              onValueChange={setShareMedical}
              trackColor={{ false: '#2a2a3a', true: 'rgba(239,68,68,0.4)' }}
              thumbColor={shareMedical ? C.red : '#6b7280'}
              ios_backgroundColor="#2a2a3a"
            />
          </View>

          <TouchableOpacity style={[s.saveBtn, loading && { opacity: 0.6 }]} onPress={handleSave} disabled={loading} activeOpacity={0.85}>
            <Text style={s.saveText}>{loading ? 'SAVING...' : 'SAVE PROFILE'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  iconBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { color: '#FFFFFF', fontSize: 16, fontWeight: '900', letterSpacing: 1.5 },
  content: { padding: 20, gap: 18 },
  avatarSection: { alignItems: 'center', gap: 6, paddingVertical: 6 },
  avatarBadge: {
    position: 'absolute', right: -2, bottom: -2,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: C.green, alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: C.bg,
  },
  avatarHint: { color: C.green, fontSize: 12, fontWeight: '800', letterSpacing: 0.5, marginTop: 6 },
  email: { color: 'rgba(255,255,255,0.4)', fontSize: 12 },
  field: { gap: 6 },
  label: { color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: '900', letterSpacing: 1.4 },
  input: {
    backgroundColor: C.surface,
    borderWidth: 1, borderColor: C.border,
    borderRadius: 14, paddingHorizontal: 14, height: 52,
    color: '#FFFFFF', fontSize: 16, fontWeight: '600',
  },
  fieldHint: { color: 'rgba(255,255,255,0.4)', fontSize: 11, marginLeft: 2 },
  medHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 },
  medTitle: { color: C.red, fontSize: 12, fontWeight: '900', letterSpacing: 1.4 },
  medHint: { color: 'rgba(255,255,255,0.4)', fontSize: 11, lineHeight: 16, marginTop: -6 },
  inputMultiline: { height: 88, paddingTop: 12, textAlignVertical: 'top' },
  shareRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: 14, padding: 14,
  },
  shareLabel: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  shareSub: { color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2 },
  saveBtn: {
    backgroundColor: C.green, borderRadius: 16, paddingVertical: 17,
    alignItems: 'center', marginTop: 8,
  },
  saveText: { color: '#000', fontWeight: '900', fontSize: 14, letterSpacing: 1 },
});
