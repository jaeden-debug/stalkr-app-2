/**
 * ZoneDetailSheet — shows details for a selected saved place/zone.
 * Owners/creators can toggle notify_on_arrival and notify_on_leave inline.
 */
import React, { memo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Sheet } from '@/components/ui/Sheet';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useMapStore } from '@/store/useMapStore';
import { useAuthStore } from '@/store/useAuthStore';
import { deleteSavedPlace, updateSavedPlace } from '@/services/savedPlaces';
import { timeAgo } from '@/utils/time';

interface ZoneDetailSheetProps {
  visible: boolean;
  zoneId: string | null;
  onClose: () => void;
}

export const ZoneDetailSheet: React.FC<ZoneDetailSheetProps> = memo(({ visible, zoneId, onClose }) => {
  const savedPlaces = useMapStore((s) => s.savedPlaces);
  const removeSavedPlaceFromStore = useMapStore((s) => s.removeSavedPlaceFromStore);
  const updateSavedPlaceInStore = useMapStore((s) => s.updateSavedPlaceInStore);
  const userId = useAuthStore((s) => s.user?.id);

  const [savingArrival, setSavingArrival] = useState(false);
  const [savingLeave, setSavingLeave] = useState(false);
  const [lingerMinutes, setLingerMinutes] = useState<string>('');
  const [quietStart, setQuietStart] = useState<string>('');
  const [quietEnd, setQuietEnd] = useState<string>('');
  const [zoneType, setZoneType] = useState<string>('');

  const zone = savedPlaces.find((z) => z.id === zoneId);

  // Sync local state when zone changes
  React.useEffect(() => {
    if (zone) {
      setLingerMinutes(zone.alert_rules?.stay_too_long_minutes?.toString() ?? '');
      setQuietStart(zone.alert_rules?.quiet_hours_start ?? '');
      setQuietEnd(zone.alert_rules?.quiet_hours_end ?? '');
      setZoneType(zone.type ?? '');
    }
  }, [zone?.id]);

  if (!zone) return null;

  const isOwner = zone.created_by === userId;
  const hasAlerts = zone.notify_on_arrival || zone.notify_on_leave;

  const handleToggleArrival = async (value: boolean) => {
    setSavingArrival(true);
    updateSavedPlaceInStore(zone.id, { notify_on_arrival: value });
    await updateSavedPlace(zone.id, { notify_on_arrival: value });
    setSavingArrival(false);
  };

  const handleToggleLeave = async (value: boolean) => {
    setSavingLeave(true);
    updateSavedPlaceInStore(zone.id, { notify_on_leave: value });
    await updateSavedPlace(zone.id, { notify_on_leave: value });
    setSavingLeave(false);
  };

  const handleSaveAdvancedRules = async () => {
    const mins = parseInt(lingerMinutes, 10);
    const updates: Partial<typeof zone> = {
      alert_rules: {
        ...zone.alert_rules,
        stay_too_long_minutes: !isNaN(mins) && mins > 0 ? mins : undefined,
        quiet_hours_start: quietStart.trim() || undefined,
        quiet_hours_end: quietEnd.trim() || undefined,
      },
      type: zoneType as any || zone.type,
    };
    updateSavedPlaceInStore(zone.id, updates);
    await updateSavedPlace(zone.id, updates);
  };

  const handleDelete = () => {
    Alert.alert('Delete Zone', `Delete "${zone.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteSavedPlace(zone.id);
          removeSavedPlaceFromStore(zone.id);
          onClose();
        },
      },
    ]);
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={zone.name} snapHeight={480}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Type badges */}
        <View style={styles.infoRow}>
          <Badge label={zone.shape_type === 'polygon' ? 'Polygon' : 'Circle'} variant="info" />
          <Badge label={zone.type} variant="info" />
          {hasAlerts && <Badge label="Alerts On" variant="live" dot />}
        </View>

        {/* Shape info */}
        {zone.shape_type === 'circle' && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Radius</Text>
            <Text style={styles.detailValue}>{zone.radius_meters}m</Text>
          </View>
        )}
        {zone.shape_type === 'polygon' && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Points</Text>
            <Text style={styles.detailValue}>{zone.polygon_coords?.length ?? 0} vertices</Text>
          </View>
        )}

        {/* Alert settings — editable for owner, read-only for others */}
        <View style={styles.alertsBox}>
          <Text style={styles.alertsTitle}>ALERT SETTINGS</Text>

          <View style={styles.alertToggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.alertToggleLabel}>Notify on arrival</Text>
              <Text style={styles.alertToggleSub}>Alert when crew enters this zone</Text>
            </View>
            {isOwner ? (
              <Switch
                value={zone.notify_on_arrival}
                onValueChange={handleToggleArrival}
                disabled={savingArrival}
                trackColor={{ false: '#2a2a3a', true: 'rgba(34,197,94,0.4)' }}
                thumbColor={zone.notify_on_arrival ? '#22c55e' : '#6b7280'}
                ios_backgroundColor="#2a2a3a"
              />
            ) : (
              <Text style={[styles.alertStaticValue, zone.notify_on_arrival ? styles.on : styles.off]}>
                {zone.notify_on_arrival ? 'On' : 'Off'}
              </Text>
            )}
          </View>

          <View style={styles.alertToggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.alertToggleLabel}>Notify on leave</Text>
              <Text style={styles.alertToggleSub}>Alert when crew exits this zone</Text>
            </View>
            {isOwner ? (
              <Switch
                value={zone.notify_on_leave}
                onValueChange={handleToggleLeave}
                disabled={savingLeave}
                trackColor={{ false: '#2a2a3a', true: 'rgba(34,197,94,0.4)' }}
                thumbColor={zone.notify_on_leave ? '#22c55e' : '#6b7280'}
                ios_backgroundColor="#2a2a3a"
              />
            ) : (
              <Text style={[styles.alertStaticValue, zone.notify_on_leave ? styles.on : styles.off]}>
                {zone.notify_on_leave ? 'On' : 'Off'}
              </Text>
            )}
          </View>

        </View>

        {/* Advanced alert rules — editable for owner */}
        {isOwner && (
          <View style={styles.alertsBox}>
            <Text style={styles.alertsTitle}>ADVANCED RULES</Text>

            {/* Linger alert */}
            <View style={styles.alertToggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.alertToggleLabel}>Linger Alert (minutes)</Text>
                <Text style={styles.alertToggleSub}>Alert if inside longer than this</Text>
              </View>
              <TextInput
                style={styles.ruleInput}
                value={lingerMinutes}
                onChangeText={setLingerMinutes}
                onEndEditing={handleSaveAdvancedRules}
                keyboardType="number-pad"
                placeholder="—"
                placeholderTextColor="#4a4a60"
                maxLength={4}
              />
            </View>

            {/* Quiet hours */}
            <View style={styles.alertToggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.alertToggleLabel}>Quiet Hours</Text>
                <Text style={styles.alertToggleSub}>No alerts between these times (HH:MM)</Text>
              </View>
              <View style={styles.timeInputRow}>
                <TextInput
                  style={styles.ruleInput}
                  value={quietStart}
                  onChangeText={setQuietStart}
                  onEndEditing={handleSaveAdvancedRules}
                  placeholder="22:00"
                  placeholderTextColor="#4a4a60"
                  maxLength={5}
                />
                <Text style={styles.timeSep}>—</Text>
                <TextInput
                  style={styles.ruleInput}
                  value={quietEnd}
                  onChangeText={setQuietEnd}
                  onEndEditing={handleSaveAdvancedRules}
                  placeholder="06:00"
                  placeholderTextColor="#4a4a60"
                  maxLength={5}
                />
              </View>
            </View>

            {/* Zone type selector */}
            <View style={[styles.alertToggleRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.alertToggleLabel}>Zone Type</Text>
            </View>
            <View style={styles.zoneTypeRow}>
              {(['safe_zone', 'danger_zone', 'camp', 'custom'] as const).map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.zoneTypePill, zoneType === t && styles.zoneTypePillActive]}
                  onPress={() => { setZoneType(t); setTimeout(handleSaveAdvancedRules, 100); }}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.zoneTypePillText, zoneType === t && styles.zoneTypePillTextActive]}>
                    {t.replace('_', ' ').toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        <Text style={styles.meta}>Created {timeAgo(zone.created_at)}</Text>

        {isOwner && (
          <Button label="Delete Zone" variant="danger" onPress={handleDelete} fullWidth />
        )}
      </ScrollView>
    </Sheet>
  );
});

const styles = StyleSheet.create({
  content: { padding: 16, gap: 14 },
  infoRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a3a',
  },
  detailLabel: { color: '#8888aa', fontSize: 14 },
  detailValue: { color: '#e8e8f0', fontSize: 14, fontWeight: '600' },
  alertsBox: {
    backgroundColor: '#0a0a0f',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#2a2a3a',
    gap: 4,
  },
  alertsTitle: {
    color: '#8888aa',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  alertToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1e1e2a',
  },
  alertToggleLabel: { color: '#e8e8f0', fontSize: 14, fontWeight: '500' },
  alertToggleSub: { color: '#8888aa', fontSize: 11, marginTop: 2 },
  alertStaticValue: { fontSize: 14, fontWeight: '600' },
  on: { color: '#22c55e' },
  off: { color: '#6b7280' },
  meta: { color: '#5555aa', fontSize: 12 },
  ruleInput: {
    backgroundColor: '#12121a',
    borderWidth: 1,
    borderColor: '#2a2a3a',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    color: '#e8e8f0',
    fontSize: 13,
    minWidth: 56,
    textAlign: 'center',
  },
  timeInputRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  timeSep: { color: '#8888aa', fontSize: 13 },
  zoneTypeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingTop: 4 },
  zoneTypePill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2a2a3a',
    backgroundColor: '#12121a',
  },
  zoneTypePillActive: {
    backgroundColor: 'rgba(34,197,94,0.12)',
    borderColor: '#22c55e',
  },
  zoneTypePillText: { color: '#8888aa', fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  zoneTypePillTextActive: { color: '#22c55e' },
});
