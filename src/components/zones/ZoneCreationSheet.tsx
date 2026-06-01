/**
 * ZoneCreationSheet — slides up after the user taps a circle zone center
 * or finishes drawing a polygon. Lets them name the zone and configure
 * notification defaults before writing to Supabase.
 *
 * Triggered by: useMapStore.pendingZoneCreation != null
 * Confirms via: useMapStore.confirmZoneCreation(name, notifyArrival, notifyLeave)
 * Cancels via:  useMapStore.cancelZoneCreation()
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useMapStore } from '@/store/useMapStore';
import { track } from '@/services/analytics';

export const ZoneCreationSheet: React.FC = () => {
  const pendingZoneCreation = useMapStore((s) => s.pendingZoneCreation);
  const confirmZoneCreation = useMapStore((s) => s.confirmZoneCreation);
  const cancelZoneCreation = useMapStore((s) => s.cancelZoneCreation);

  const [name, setName] = useState('');
  const [notifyArrival, setNotifyArrival] = useState(true);
  const [notifyLeave, setNotifyLeave] = useState(true);
  const [saving, setSaving] = useState(false);

  const inputRef = useRef<TextInput>(null);

  // Reset state each time a new pending zone appears
  useEffect(() => {
    if (pendingZoneCreation) {
      setName('');
      setNotifyArrival(true);
      setNotifyLeave(true);
      setSaving(false);
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [pendingZoneCreation]);

  if (!pendingZoneCreation) return null;

  const isPolygon = pendingZoneCreation.type === 'polygon';

  const handleConfirm = async () => {
    Keyboard.dismiss();
    setSaving(true);
    await confirmZoneCreation(name, notifyArrival, notifyLeave);
    track({
      name: 'zone_created',
      properties: {
        shape: pendingZoneCreation!.type,
        type: 'custom',
        notify_arrival: notifyArrival,
        notify_leave: notifyLeave,
      },
    });
    setSaving(false);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.overlay}
      pointerEvents="box-none"
    >
      <View style={styles.sheet}>
        {/* Header */}
        <View style={styles.handle} />
        <View style={styles.header}>
          <Text style={styles.title}>
            {isPolygon ? '📐 NAME POLYGON ZONE' : '⭕ NAME CIRCLE ZONE'}
          </Text>
          <TouchableOpacity onPress={cancelZoneCreation} activeOpacity={0.7}>
            <Text style={styles.cancelX}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Name input */}
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Zone name (e.g. Base Camp)"
          placeholderTextColor="#5555aa"
          selectionColor="#22c55e"
          maxLength={48}
          returnKeyType="done"
          onSubmitEditing={handleConfirm}
        />

        {/* Notification toggles */}
        <View style={styles.toggleSection}>
          <Text style={styles.toggleSectionLabel}>ALERT SETTINGS</Text>

          <View style={styles.toggleRow}>
            <View>
              <Text style={styles.toggleLabel}>Notify on arrival</Text>
              <Text style={styles.toggleSub}>Alert when crew enters this zone</Text>
            </View>
            <Switch
              value={notifyArrival}
              onValueChange={setNotifyArrival}
              trackColor={{ false: '#2a2a3a', true: 'rgba(34,197,94,0.4)' }}
              thumbColor={notifyArrival ? '#22c55e' : '#6b7280'}
              ios_backgroundColor="#2a2a3a"
            />
          </View>

          <View style={styles.toggleRow}>
            <View>
              <Text style={styles.toggleLabel}>Notify on leave</Text>
              <Text style={styles.toggleSub}>Alert when crew exits this zone</Text>
            </View>
            <Switch
              value={notifyLeave}
              onValueChange={setNotifyLeave}
              trackColor={{ false: '#2a2a3a', true: 'rgba(34,197,94,0.4)' }}
              thumbColor={notifyLeave ? '#22c55e' : '#6b7280'}
              ios_backgroundColor="#2a2a3a"
            />
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={cancelZoneCreation}
            activeOpacity={0.8}
            disabled={saving}
          >
            <Text style={styles.cancelBtnText}>CANCEL</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.confirmBtn, saving && styles.confirmBtnDisabled]}
            onPress={handleConfirm}
            activeOpacity={0.8}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#000" size="small" />
            ) : (
              <Text style={styles.confirmBtnText}>CREATE ZONE</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill as any,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    backgroundColor: '#0f0f17',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderColor: '#2a2a3a',
    paddingBottom: 40,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#3a3a4e',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1e1e2a',
  },
  title: {
    color: '#e8e8f0',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  cancelX: {
    color: '#8888aa',
    fontSize: 18,
    fontWeight: '600',
    paddingHorizontal: 4,
  },
  input: {
    margin: 16,
    backgroundColor: '#0a0a0f',
    borderWidth: 1,
    borderColor: '#2a2a3a',
    borderRadius: 12,
    padding: 14,
    color: '#e8e8f0',
    fontSize: 16,
    fontWeight: '600',
    height: 52,
  },
  toggleSection: {
    marginHorizontal: 16,
    backgroundColor: '#12121a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a3a',
    padding: 4,
    gap: 0,
  },
  toggleSectionLabel: {
    color: '#8888aa',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 6,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  toggleLabel: {
    color: '#e8e8f0',
    fontSize: 14,
    fontWeight: '500',
  },
  toggleSub: {
    color: '#8888aa',
    fontSize: 11,
    marginTop: 2,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    margin: 16,
    marginTop: 20,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3a3a4e',
    backgroundColor: '#1a1a24',
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#8888aa',
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 0.5,
  },
  confirmBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#22c55e',
    alignItems: 'center',
  },
  confirmBtnDisabled: {
    opacity: 0.6,
  },
  confirmBtnText: {
    color: '#000',
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 0.5,
  },
});
