import React, { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { requireFeature } from '@/utils/paywall';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/useAuthStore';
import {
  fetchEmergencyContacts,
  createEmergencyContact,
  deleteEmergencyContact,
} from '@/services/emergencyContacts';
import { Sheet } from '@/components/ui/Sheet';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { C } from '@/constants/theme';
import type { EmergencyContact } from '@/types/models';

export default function EmergencyContactsScreen() {
  const router = useRouter();
  const toast = useToast();
  const userId = useAuthStore((s) => s.user?.id);
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (userId) loadContacts();
  }, [userId]);

  const loadContacts = async () => {
    if (!userId) return;
    setContacts(await fetchEmergencyContacts(userId));
  };

  const handleAdd = async () => {
    if (!name.trim() || !phone.trim()) { toast.error('Enter name and phone number'); return; }
    if (!userId) return;
    if (!requireFeature('emergencyContacts', router, 'Emergency contacts')) return;
    setAdding(true);
    const contact = await createEmergencyContact(userId, name.trim(), phone.trim());
    setAdding(false);
    if (contact) {
      setContacts((prev) => [...prev, contact]);
      setShowAddSheet(false);
      setName('');
      setPhone('');
      toast.success('Emergency contact added');
    } else {
      toast.error('Failed to add contact');
    }
  };

  const handleDelete = (contact: EmergencyContact) => {
    Alert.alert('Remove Contact', `Remove ${contact.contact_name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await deleteEmergencyContact(contact.id);
          setContacts((prev) => prev.filter((c) => c.id !== contact.id));
          toast.success('Contact removed');
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <TouchableOpacity style={s.iconBtn} onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={s.title}>EMERGENCY CONTACTS</Text>
        <TouchableOpacity style={s.iconBtn} onPress={() => setShowAddSheet(true)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="add" size={24} color={C.green} />
        </TouchableOpacity>
      </View>

      <View style={s.infoBanner}>
        <Ionicons name="information-circle" size={16} color={C.blue} />
        <Text style={s.infoText}>
          These contacts get a pre-filled text with your location when you trigger SOS, and can be sent your journey watch links.
        </Text>
      </View>

      <FlatList
        data={contacts}
        keyExtractor={(c) => c.id}
        contentContainerStyle={contacts.length === 0 ? s.emptyList : s.list}
        renderItem={({ item }) => (
          <View style={s.card}>
            <View style={s.avatar}>
              <Ionicons name="call" size={18} color={C.red} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.cName}>{item.contact_name}</Text>
              <Text style={s.cPhone}>{item.phone_number}</Text>
            </View>
            <TouchableOpacity onPress={() => handleDelete(item)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={20} color="rgba(255,255,255,0.5)" />
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={
          <EmptyState
            emoji="🆘"
            title="No emergency contacts"
            subtitle="Add people to alert during SOS or to share your journeys with."
            action={{ label: '+ Add Contact', onPress: () => setShowAddSheet(true) }}
          />
        }
      />

      <Sheet visible={showAddSheet} onClose={() => setShowAddSheet(false)} title="Add Contact" snapHeight={320}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.sheetContent}>
          <TextInput
            style={s.input}
            placeholder="Contact name"
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={name}
            onChangeText={setName}
            autoFocus
            selectionColor={C.green}
          />
          <TextInput
            style={s.input}
            placeholder="Phone number"
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            selectionColor={C.green}
          />
          <TouchableOpacity style={[s.addBtn, adding && { opacity: 0.6 }]} onPress={handleAdd} disabled={adding} activeOpacity={0.85}>
            <Text style={s.addBtnText}>{adding ? 'ADDING...' : 'ADD CONTACT'}</Text>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Sheet>
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
  title: { color: '#FFFFFF', fontSize: 14, fontWeight: '900', letterSpacing: 1.2 },
  infoBanner: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    margin: 16, marginBottom: 8, padding: 14,
    backgroundColor: C.blueDim, borderWidth: 1, borderColor: C.blueBorder, borderRadius: 14,
  },
  infoText: { flex: 1, color: 'rgba(255,255,255,0.75)', fontSize: 12, lineHeight: 17 },
  list: { padding: 16, gap: 10 },
  emptyList: { flex: 1 },
  card: {
    backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.border,
    padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: C.redDim, borderWidth: 1, borderColor: C.redBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  cName: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  cPhone: { color: 'rgba(255,255,255,0.5)', fontSize: 13, marginTop: 2 },
  sheetContent: { padding: 20, gap: 14 },
  input: {
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: 14, paddingHorizontal: 14, height: 52, color: '#FFFFFF', fontSize: 16,
  },
  addBtn: { backgroundColor: C.green, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 4 },
  addBtnText: { color: '#000', fontWeight: '900', fontSize: 13, letterSpacing: 1 },
});
