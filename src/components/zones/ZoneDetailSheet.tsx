/**
 * ZoneDetailSheet — shows details for a selected saved place/zone.
 * Owners/creators can rename, move, toggle alerts, and delete.
 */
import React, { memo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Sheet } from '@/components/ui/Sheet';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { PhotoGallery } from '@/components/ui/PhotoGallery';
import { useMapStore } from '@/store/useMapStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useToast } from '@/components/ui/Toast';
import { deleteSavedPlace, updateSavedPlace, fetchSavedPlacePhotos, uploadSavedPlacePhoto } from '@/services/savedPlaces';
import { logEvent } from '@/services/groupEvents';
import { timeAgo } from '@/utils/time';
import { formatDistanceBoth } from '@/utils/distance';

interface ZoneDetailSheetProps {
  visible: boolean;
  zoneId: string | null;
  onClose: () => void;
}

export const ZoneDetailSheet: React.FC<ZoneDetailSheetProps> = memo(({ visible, zoneId, onClose }) => {
  const savedPlaces = useMapStore((s) => s.savedPlaces);
  const removeSavedPlaceFromStore = useMapStore((s) => s.removeSavedPlaceFromStore);
  const updateSavedPlaceInStore = useMapStore((s) => s.updateSavedPlaceInStore);
  const setMovingZoneId = useMapStore((s) => s.setMovingZoneId);
  const userId = useAuthStore((s) => s.user?.id);
  const toast = useToast();

  const [savingArrival, setSavingArrival] = useState(false);
  const [savingLeave, setSavingLeave] = useState(false);
  const [lingerMinutes, setLingerMinutes] = useState<string>('');
  const [quietStart, setQuietStart] = useState<string>('');
  const [quietEnd, setQuietEnd] = useState<string>('');
  const [zoneType, setZoneType] = useState<string>('');
  const [zoneName, setZoneName] = useState<string>('');
  const [renaming, setRenaming] = useState(false);
  const [savingName, setSavingName] = useState(false);

  const zone = savedPlaces.find((z) => z.id === zoneId);

  // Sync local state when zone changes
  React.useEffect(() => {
    if (zone) {
      setLingerMinutes(zone.alert_rules?.stay_too_long_minutes?.toString() ?? '');
      setQuietStart(zone.alert_rules?.quiet_hours_start ?? '');
      setQuietEnd(zone.alert_rules?.quiet_hours_end ?? '');
      setZoneType(zone.type ?? '');
      setZoneName(zone.name ?? '');
      setRenaming(false);
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

  const handleSaveName = async () => {
    const trimmed = zoneName.trim();
    if (!trimmed || trimmed === zone.name) { setRenaming(false); return; }
    setSavingName(true);
    updateSavedPlaceInStore(zone.id, { name: trimmed });
    await updateSavedPlace(zone.id, { name: trimmed });
    setSavingName(false);
    setRenaming(false);
    toast.success('Zone renamed');
  };

  const handleMove = () => {
    setMovingZoneId(zone.id);
    onClose();
    toast.info('Drag the zone label to reposition it');
  };

  const handleDelete = () => {
    Alert.alert('Delete Zone', `Delete "${zone.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (userId && zone.group_id) {
            logEvent(zone.group_id, userId, 'zone_deleted', `Zone removed: ${zone.name}`, undefined).catch(() => {});
          }
          await deleteSavedPlace(zone.id);
          removeSavedPlaceFromStore(zone.id);
          onClose();
        },
      },
    ]);
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={zone.name} snapHeight={600}>
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
            <Text style={styles.detailValue}>{formatDistanceBoth(zone.radius_meters)}</Text>
          </View>
        )}
        {zone.shape_type === 'polygon' && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Points</Text>
            <Text style={styles.detailValue}>{zone.polygon_coords?.length ?? 0} vertices</Text>
          </View>
        )}

        {/* Photos */}
        <PhotoGallery
          reloadKey={zone.id}
          canEdit={!!userId}
          load={() => fetchSavedPlacePhotos(zone.id).then((ps) => ps.map((p) => ({ id: p.id, url: p.url })))}
          upload={(uri) => uploadSavedPlacePhoto(zone.id, zone.group_id, userId!, uri).then((p) => (p ? { id: p.id, url: p.url } : null))}
        />

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
          <>
            <View style={styles.divider} />

            {/* Rename */}
            {renaming ? (
              <View style={styles.renameRow}>
                <TextInput
                  style={styles.renameInput}
                  value={zoneName}
                  onChangeText={setZoneName}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={handleSaveName}
                  selectionColor="#22c55e"
                  placeholderTextColor="#5555aa"
                />
                <TouchableOpacity style={styles.saveBtn} onPress={handleSaveName} disabled={savingName}>
                  <Text style={styles.saveBtnText}>{savingName ? '…' : 'Save'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => { setZoneName(zone.name); setRenaming(false); }}>
                  <Text style={styles.cancelBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.actionRow} onPress={() => setRenaming(true)}>
                <Text style={styles.actionIcon}>✏️</Text>
                <Text style={styles.actionLabel}>Rename Zone</Text>
                <Text style={styles.actionChevron}>›</Text>
              </TouchableOpacity>
            )}

            {/* Move */}
            <TouchableOpacity style={styles.actionRow} onPress={handleMove}>
              <Text style={styles.actionIcon}>✥</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.actionLabel}>Move Zone</Text>
                <Text style={styles.actionSub}>Drag the label to reposition</Text>
              </View>
              <Text style={styles.actionChevron}>›</Text>
            </TouchableOpacity>

            {/* Delete */}
            <TouchableOpacity style={[styles.actionRow, styles.actionRowDanger]} onPress={handleDelete}>
              <Text style={styles.actionIcon}>🗑️</Text>
              <Text style={[styles.actionLabel, styles.actionLabelDanger]}>Delete Zone</Text>
            </TouchableOpacity>
          </>
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

  divider: { height: 1, backgroundColor: '#2a2a3a', marginVertical: 2 },
  actionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 13, paddingHorizontal: 4,
    borderBottomWidth: 1, borderBottomColor: '#1a1a28',
  },
  actionRowDanger: { borderBottomWidth: 0, marginTop: 4 },
  actionIcon: { fontSize: 18, width: 26, textAlign: 'center' },
  actionLabel: { flex: 1, color: '#e8e8f0', fontSize: 15, fontWeight: '500' },
  actionLabelDanger: { color: '#ef4444' },
  actionSub: { color: '#8888aa', fontSize: 12, marginTop: 1 },
  actionChevron: { color: '#5555aa', fontSize: 18 },

  renameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  renameInput: {
    flex: 1, backgroundColor: '#0a0a0f', borderWidth: 1, borderColor: '#22c55e',
    borderRadius: 10, padding: 11, color: '#e8e8f0', fontSize: 15, height: 46,
  },
  saveBtn: {
    backgroundColor: '#22c55e', borderRadius: 10, paddingHorizontal: 14,
    height: 46, alignItems: 'center', justifyContent: 'center',
  },
  saveBtnText: { color: '#000', fontWeight: '700', fontSize: 14 },
  cancelBtn: {
    width: 46, height: 46, borderRadius: 10, backgroundColor: '#1a1a28',
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#2a2a3a',
  },
  cancelBtnText: { color: '#8888aa', fontSize: 16 },
});
