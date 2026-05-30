/**
 * ZoneDetailSheet — shows details for a selected saved place/zone.
 * Owners/creators can toggle notify_on_arrival and notify_on_leave inline.
 */
import React, { memo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
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

  const zone = savedPlaces.find((z) => z.id === zoneId);
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

          {zone.alert_rules?.stay_too_long_minutes && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Stay-too-long</Text>
              <Text style={styles.detailValue}>{zone.alert_rules.stay_too_long_minutes} min</Text>
            </View>
          )}
        </View>

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
});
