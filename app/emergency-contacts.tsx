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
import { useAuthStore } from '@/store/useAuthStore';
import {
  fetchEmergencyContacts,
  createEmergencyContact,
  deleteEmergencyContact,
} from '@/services/emergencyContacts';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Sheet } from '@/components/ui/Sheet';
import { useToast } from '@/components/ui/Toast';
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
    const data = await fetchEmergencyContacts(userId);
    setContacts(data);
  };

  const handleAdd = async () => {
    if (!name.trim() || !phone.trim()) { toast.error('Enter name and phone number'); return; }
    if (!userId) return;
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
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Emergency Contacts</Text>
        <TouchableOpacity onPress={() => setShowAddSheet(true)}>
          <Text style={styles.addBtn}>+ Add</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={contacts}
        keyExtractor={(c) => c.id}
        contentContainerStyle={contacts.length === 0 ? styles.emptyList : styles.list}
        renderItem={({ item }) => (
          <View style={styles.contactCard}>
            <View style={styles.contactAvatar}>
              <Text style={styles.contactAvatarText}>🆘</Text>
            </View>
            <View style={styles.contactInfo}>
              <Text style={styles.contactName}>{item.contact_name}</Text>
              <Text style={styles.contactPhone}>{item.phone_number}</Text>
            </View>
            <TouchableOpacity onPress={() => handleDelete(item)}>
              <Text style={styles.deleteBtn}>✕</Text>
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={
          <EmptyState
            emoji="🆘"
            title="No emergency contacts"
            subtitle="Add contacts to notify in an emergency or journey mode."
            action={{ label: '+ Add Contact', onPress: () => setShowAddSheet(true) }}
          />
        }
      />

      <Sheet visible={showAddSheet} onClose={() => setShowAddSheet(false)} title="Add Contact" snapHeight={340}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.sheetContent}>
          <TextInput
            style={styles.sheetInput}
            placeholder="Contact name"
            placeholderTextColor="#5555aa"
            value={name}
            onChangeText={setName}
            autoFocus
            selectionColor="#22c55e"
          />
          <TextInput
            style={styles.sheetInput}
            placeholder="Phone number"
            placeholderTextColor="#5555aa"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            selectionColor="#22c55e"
          />
          <Button label="Add Contact" onPress={handleAdd} loading={adding} fullWidth size="lg" />
        </KeyboardAvoidingView>
      </Sheet>
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
  addBtn: { color: '#22c55e', fontSize: 15, fontWeight: '700', width: 60, textAlign: 'right' },
  list: { padding: 16, gap: 10 },
  emptyList: { flex: 1 },
  contactCard: {
    backgroundColor: '#1a1a24',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a3a',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  contactAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderWidth: 1.5,
    borderColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactAvatarText: { fontSize: 18 },
  contactInfo: { flex: 1 },
  contactName: { color: '#e8e8f0', fontSize: 15, fontWeight: '600' },
  contactPhone: { color: '#8888aa', fontSize: 13, marginTop: 2 },
  deleteBtn: { color: '#ef4444', fontSize: 18, paddingHorizontal: 4 },
  sheetContent: { padding: 20, gap: 14 },
  sheetInput: {
    backgroundColor: '#0a0a0f',
    borderWidth: 1,
    borderColor: '#2a2a3a',
    borderRadius: 12,
    padding: 14,
    color: '#e8e8f0',
    fontSize: 16,
    height: 52,
  },
});
