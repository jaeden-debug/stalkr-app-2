/**
 * JourneySheet — the single, unified Journey creation experience.
 * Opened from the nav drawer (empty destination) and from a map-search place
 * (prefilled). Glass / tactical styling consistent with the nav drawer.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as Contacts from 'expo-contacts';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import { useSessionStore, type JourneyWatcher } from '@/store/useSessionStore';
import { useMapStore } from '@/store/useMapStore';
import { useAuthStore } from '@/store/useAuthStore';
import { fetchEmergencyContacts } from '@/services/emergencyContacts';
import { getDistance, formatDistanceBoth } from '@/utils/distance';
import { C } from '@/constants/theme';
import type { EmergencyContact } from '@/types/models';

const GOOGLE_API_KEY =
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.EXPO_PUBLIC_GOOGLE_MAPS_IOS_KEY || '';

interface Dest { name: string; address?: string; lat: number; lng: number }

export const JourneySheet: React.FC = () => {
  const open = useSessionStore((s) => s.journeySheetOpen);
  const prefill = useSessionStore((s) => s.journeyPrefill);
  const close = useSessionStore((s) => s.closeJourneySheet);
  const startJourney = useSessionStore((s) => s.startJourney);
  const myLocation = useMapStore((s) => s.myLocation);

  const [dest, setDest] = useState<Dest | null>(null);
  const [editingDest, setEditingDest] = useState(true);
  const [showCoords, setShowCoords] = useState(false);
  const [watchers, setWatchers] = useState<JourneyWatcher[]>([]);
  const [message, setMessage] = useState('');
  const [starting, setStarting] = useState(false);

  const [emergency, setEmergency] = useState<EmergencyContact[]>([]);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualValue, setManualValue] = useState('');
  const [contactsOpen, setContactsOpen] = useState(false);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [phoneContacts, setPhoneContacts] = useState<{ id: string; name: string; value: string }[]>([]);
  const [contactSearch, setContactSearch] = useState('');

  const placesRef = useRef<any>(null);

  // Reset + apply prefill each time the sheet opens.
  useEffect(() => {
    if (!open) return;
    if (prefill?.destinationLat != null && prefill?.destinationLng != null) {
      setDest({ name: prefill.destinationName ?? 'Destination', address: prefill.destinationAddress, lat: prefill.destinationLat, lng: prefill.destinationLng });
      setEditingDest(false);
    } else {
      setDest(null);
      setEditingDest(true);
    }
    setWatchers([]); setMessage(''); setShowCoords(false); setStarting(false);
  }, [open, prefill]);

  useEffect(() => {
    if (!open) return;
    const uid = useAuthStore.getState().user?.id;
    if (uid) fetchEmergencyContacts(uid).then(setEmergency).catch(() => {});
  }, [open]);

  const addWatcher = (w: JourneyWatcher) => {
    setWatchers((prev) => (prev.some((x) => x.key === w.key) ? prev : [...prev, w]));
  };
  const removeWatcher = (key: string) => setWatchers((prev) => prev.filter((w) => w.key !== key));

  const openContacts = async () => {
    // Reliable approach: load contacts and render them INLINE in this sheet (no
    // nested Modal, no native picker — both fail to present over the journey
    // Modal on iOS). Toggle closed if already open.
    if (contactsOpen) { setContactsOpen(false); return; }
    setContactsLoading(true);
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Contacts access', 'Allow contacts in Settings to pick from them, or add one manually.');
        setManualOpen(true);
        return;
      }
      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Emails],
      });
      const cleaned = data
        .map((c, i) => {
          const value = c.phoneNumbers?.[0]?.number || c.emails?.[0]?.email || '';
          return { id: String((c as any).id ?? i), name: c.name ?? 'Unknown', value };
        })
        .filter((c) => c.value)
        .sort((a, b) => a.name.localeCompare(b.name));
      setPhoneContacts(cleaned);
      setContactSearch('');
      setContactsOpen(true);
    } catch {
      Alert.alert('Could not load contacts', 'Add the contact manually instead.');
      setManualOpen(true);
    } finally {
      setContactsLoading(false);
    }
  };

  const addManual = () => {
    const v = manualValue.trim();
    if (!manualName.trim() || !v) { Alert.alert('Add contact', 'Enter a name and a phone number or email.'); return; }
    const isEmail = v.includes('@');
    addWatcher({ key: `manual-${v}`, name: manualName.trim(), phone: isEmail ? null : v, email: isEmail ? v : null, source: 'manual' });
    setManualName(''); setManualValue(''); setManualOpen(false);
  };

  const distance = dest && myLocation ? formatDistanceBoth(getDistance(myLocation, { latitude: dest.lat, longitude: dest.lng })) : null;

  const doStart = async () => {
    if (!dest) { Alert.alert('Choose a destination', 'Search and select where you are heading.'); return; }
    const go = async () => {
      setStarting(true);
      const session = await startJourney({
        name: dest.name, destinationName: dest.name, destinationAddress: dest.address,
        destinationLat: dest.lat, destinationLng: dest.lng, message: message.trim() || undefined, watchers,
      });
      setStarting(false);
      if (!session) Alert.alert('Could not start', 'Something went wrong starting your journey. Please try again.');
    };
    if (watchers.length === 0) {
      Alert.alert('No watchers selected', 'Start without sharing to anyone? You can still share the link later.', [
        { text: 'Add watchers', style: 'cancel' },
        { text: 'Start anyway', onPress: go },
      ]);
    } else { go(); }
  };

  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={close}>
      <View style={s.backdrop}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.kav}>
          <BlurView intensity={95} tint="dark" style={s.sheet}>
            <SafeAreaView edges={['bottom']}>
              {/* Header */}
              <View style={s.handle}><View style={s.handleBar} /></View>
              <View style={s.header}>
                <View style={{ flex: 1 }}>
                  <Text style={s.title}>START JOURNEY</Text>
                  <Text style={s.subtitle}>Share your live progress until you arrive safely.</Text>
                </View>
                <TouchableOpacity style={s.closeBtn} onPress={close} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="close" size={20} color="rgba(255,255,255,0.7)" />
                </TouchableOpacity>
              </View>

              <ScrollView style={{ maxHeight: 520 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                {/* Destination */}
                <Text style={s.sectionLabel}>DESTINATION</Text>
                {dest && !editingDest ? (
                  <View style={s.destCard}>
                    <View style={s.destPin}><Ionicons name="location" size={18} color={C.green} /></View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.destName} numberOfLines={1}>{dest.name}</Text>
                      {!!dest.address && <Text style={s.destAddr} numberOfLines={1}>{dest.address}</Text>}
                      <View style={s.destMetaRow}>
                        {distance && <Text style={s.destDist}>{distance} away</Text>}
                        <TouchableOpacity onPress={() => setShowCoords((v) => !v)}><Text style={s.detailsToggle}>{showCoords ? 'Hide details' : 'Details'}</Text></TouchableOpacity>
                      </View>
                      {showCoords && <Text style={s.coords}>{dest.lat.toFixed(5)}, {dest.lng.toFixed(5)}</Text>}
                    </View>
                    <TouchableOpacity onPress={() => { setEditingDest(true); setDest(null); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="pencil" size={16} color="rgba(255,255,255,0.5)" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={s.placesWrap}>
                    <GooglePlacesAutocomplete
                      ref={placesRef}
                      placeholder="Search address or place"
                      fetchDetails minLength={1} debounce={250} enablePoweredByContainer={false} keyboardShouldPersistTaps="handled"
                      onFail={(e) => console.log('JOURNEY PLACES FAIL:', e)}
                      textInputProps={{ placeholderTextColor: 'rgba(255,255,255,0.35)', returnKeyType: 'search', autoFocus: !dest }}
                      onPress={(data: any, details: any = null) => {
                        const loc = details?.geometry?.location;
                        if (!loc) return;
                        setDest({ name: data?.structured_formatting?.main_text ?? data?.description ?? 'Destination', address: details?.formatted_address ?? data?.description, lat: loc.lat, lng: loc.lng });
                        setEditingDest(false);
                      }}
                      query={{ key: GOOGLE_API_KEY, language: 'en' }}
                      styles={{ textInput: s.placesInput, listView: s.placesList, row: s.placesRow, description: { color: '#fff', fontSize: 13 }, separator: { backgroundColor: 'rgba(255,255,255,0.08)', height: 0.5 } }}
                    />
                  </View>
                )}

                {/* Watchers */}
                <Text style={s.sectionLabel}>WATCH CONTACTS</Text>
                {watchers.length > 0 && (
                  <View style={{ gap: 8, marginBottom: 8 }}>
                    {watchers.map((w) => (
                      <View key={w.key} style={s.watcherRow}>
                        <View style={s.watcherAvatar}><Text style={s.watcherInit}>{w.name.slice(0, 1).toUpperCase()}</Text></View>
                        <View style={{ flex: 1 }}>
                          <Text style={s.watcherName} numberOfLines={1}>{w.name}</Text>
                          <Text style={s.watcherMeta} numberOfLines={1}>{(w.phone || w.email) ?? 'In-app'} · {w.source === 'emergency' ? 'Emergency Contact' : w.source === 'contact' ? 'Phone Contact' : 'Manual'}</Text>
                        </View>
                        <TouchableOpacity onPress={() => removeWatcher(w.key)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}><Ionicons name="close-circle" size={20} color="rgba(255,255,255,0.4)" /></TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}

                {emergency.length > 0 && (
                  <>
                    <Text style={s.subLabel}>From your emergency contacts</Text>
                    <View style={s.chipWrap}>
                      {emergency.map((c) => {
                        const key = `em-${c.id}`;
                        const added = watchers.some((w) => w.key === key);
                        return (
                          <TouchableOpacity key={c.id} style={[s.contactChip, added && s.contactChipAdded]} onPress={() => added ? removeWatcher(key) : addWatcher({ key, name: c.contact_name, phone: c.phone_number, source: 'emergency' })} activeOpacity={0.8}>
                            <Ionicons name={added ? 'checkmark-circle' : 'add-circle-outline'} size={14} color={added ? C.green : 'rgba(255,255,255,0.6)'} />
                            <Text style={[s.contactChipText, added && { color: C.green }]}>{c.contact_name}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </>
                )}

                <View style={s.addRow}>
                  <TouchableOpacity style={s.addBtn} onPress={openContacts} activeOpacity={0.85}>
                    {contactsLoading
                      ? <ActivityIndicator size="small" color={C.green} />
                      : <Ionicons name="people" size={15} color={C.green} />}
                    <Text style={s.addBtnText}>{contactsOpen ? 'HIDE' : 'PHONE CONTACT'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.addBtn} onPress={() => setManualOpen((v) => !v)} activeOpacity={0.85}>
                    <Ionicons name="create" size={15} color={C.green} /><Text style={s.addBtnText}>MANUAL</Text>
                  </TouchableOpacity>
                </View>

                {/* Inline phone-contacts list (no nested modal) */}
                {contactsOpen && (
                  <View style={s.contactsBox}>
                    <TextInput
                      style={s.input} value={contactSearch} onChangeText={setContactSearch}
                      placeholder="Search contacts" placeholderTextColor="rgba(255,255,255,0.3)" autoCapitalize="none"
                    />
                    <View style={s.contactsList}>
                      {phoneContacts
                        .filter((c) => !contactSearch.trim() || c.name.toLowerCase().includes(contactSearch.toLowerCase()))
                        .slice(0, 40)
                        .map((c) => {
                          const key = `ph-${c.id}`;
                          const added = watchers.some((w) => w.key === key);
                          const isEmail = c.value.includes('@');
                          return (
                            <TouchableOpacity
                              key={c.id}
                              style={s.contactRow}
                              activeOpacity={0.8}
                              onPress={() => added ? removeWatcher(key) : addWatcher({ key, name: c.name, phone: isEmail ? null : c.value, email: isEmail ? c.value : null, source: 'contact' })}
                            >
                              <View style={s.watcherAvatar}><Text style={s.watcherInit}>{c.name.slice(0, 1).toUpperCase()}</Text></View>
                              <View style={{ flex: 1 }}>
                                <Text style={s.watcherName} numberOfLines={1}>{c.name}</Text>
                                <Text style={s.watcherMeta} numberOfLines={1}>{c.value}</Text>
                              </View>
                              <Ionicons name={added ? 'checkmark-circle' : 'add-circle-outline'} size={20} color={added ? C.green : 'rgba(255,255,255,0.4)'} />
                            </TouchableOpacity>
                          );
                        })}
                      {phoneContacts.length === 0 && <Text style={s.watcherMeta}>No contacts with a phone or email found.</Text>}
                    </View>
                  </View>
                )}

                {manualOpen && (
                  <View style={s.manualBox}>
                    <TextInput style={s.input} value={manualName} onChangeText={setManualName} placeholder="Name" placeholderTextColor="rgba(255,255,255,0.3)" selectionColor={C.green} />
                    <TextInput style={s.input} value={manualValue} onChangeText={setManualValue} placeholder="Phone or email" placeholderTextColor="rgba(255,255,255,0.3)" autoCapitalize="none" keyboardType="email-address" selectionColor={C.green} />
                    <TouchableOpacity style={s.manualAdd} onPress={addManual} activeOpacity={0.85}><Text style={s.manualAddText}>ADD WATCHER</Text></TouchableOpacity>
                  </View>
                )}

                {/* Message */}
                <Text style={s.sectionLabel}>MESSAGE (OPTIONAL)</Text>
                <TextInput
                  style={[s.input, { height: 80, paddingTop: 12, textAlignVertical: 'top' }]}
                  value={message} onChangeText={setMessage} multiline maxLength={280}
                  placeholder="I'm sharing my journey with you. You can follow my live progress and get notified when I arrive safely."
                  placeholderTextColor="rgba(255,255,255,0.3)" selectionColor={C.green}
                />

                <View style={{ height: 12 }} />
              </ScrollView>

              {/* Start */}
              <TouchableOpacity style={[s.startBtn, (!dest || starting) && { opacity: 0.5 }]} onPress={doStart} disabled={!dest || starting} activeOpacity={0.85}>
                {starting ? <ActivityIndicator color="#000" /> : (<><Ionicons name="navigate" size={18} color="#000" /><Text style={s.startText}>START JOURNEY</Text></>)}
              </TouchableOpacity>
            </SafeAreaView>
          </BlurView>
        </KeyboardAvoidingView>
      </View>

    </Modal>
  );
};

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  kav: { width: '100%' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden', borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(10,10,16,0.7)', paddingHorizontal: 18 },
  handle: { alignItems: 'center', paddingTop: 10 },
  handleBar: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.4)' },
  header: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 14, gap: 12 },
  title: { color: '#FFFFFF', fontSize: 18, fontWeight: '900', letterSpacing: 1 },
  subtitle: { color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 3 },
  closeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  sectionLabel: { color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: '900', letterSpacing: 1.4, marginTop: 14, marginBottom: 8 },
  subLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 11, marginBottom: 6 },
  placesWrap: { zIndex: 9000, minHeight: 54 },
  placesInput: { backgroundColor: 'rgba(255,255,255,0.06)', color: '#fff', height: 50, borderRadius: 14, paddingHorizontal: 14, fontSize: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  placesList: { backgroundColor: '#111', borderRadius: 12, marginTop: 8, borderWidth: 1, borderColor: '#333', maxHeight: 200 },
  placesRow: { backgroundColor: '#111', padding: 13 },
  destCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: C.greenBorder, borderRadius: 14, padding: 14 },
  destPin: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.greenDim, borderWidth: 1, borderColor: C.greenBorder, alignItems: 'center', justifyContent: 'center' },
  destName: { color: '#fff', fontSize: 15, fontWeight: '800' },
  destAddr: { color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 2 },
  destMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },
  destDist: { color: C.green, fontSize: 11, fontWeight: '800' },
  detailsToggle: { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '700' },
  coords: { color: 'rgba(255,255,255,0.4)', fontSize: 11, fontFamily: 'Courier New', marginTop: 4 },
  watcherRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 10 },
  watcherAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(74,222,128,0.18)', alignItems: 'center', justifyContent: 'center' },
  watcherInit: { color: C.green, fontWeight: '900', fontSize: 14 },
  watcherName: { color: '#fff', fontSize: 14, fontWeight: '700' },
  watcherMeta: { color: 'rgba(255,255,255,0.45)', fontSize: 11, marginTop: 1 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  contactChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', backgroundColor: 'rgba(255,255,255,0.05)' },
  contactChipAdded: { borderColor: C.greenBorder, backgroundColor: C.greenDim },
  contactChipText: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '700' },
  addRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  contactsBox: { marginTop: 8, gap: 8 },
  contactsList: { gap: 4, maxHeight: 240 },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9, paddingHorizontal: 10, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  addBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, borderColor: C.greenBorder, backgroundColor: C.greenDim },
  addBtnText: { color: C.green, fontSize: 11, fontWeight: '900', letterSpacing: 0.8 },
  manualBox: { gap: 8, marginTop: 8 },
  input: { backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', borderRadius: 12, paddingHorizontal: 14, height: 48, color: '#fff', fontSize: 14 },
  manualAdd: { alignItems: 'center', paddingVertical: 12, borderRadius: 12, backgroundColor: C.greenDim, borderWidth: 1, borderColor: C.greenBorder },
  manualAddText: { color: C.green, fontWeight: '900', fontSize: 12, letterSpacing: 0.8 },
  startBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.green, borderRadius: 16, paddingVertical: 17, marginTop: 12, marginBottom: 6 },
  startText: { color: '#000', fontWeight: '900', fontSize: 14, letterSpacing: 1 },
  pickerRoot: { flex: 1, backgroundColor: C.bg, paddingHorizontal: 18 },
  pickerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14 },
  pickerTitle: { color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 1 },
  pickerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 10, borderRadius: 12, marginBottom: 6, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'transparent' },
});
