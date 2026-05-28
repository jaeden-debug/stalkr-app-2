/**
 * ZoneDetailSheet — shows details for a selected saved place/zone.
 */
import React, { memo } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Sheet } from '@/components/ui/Sheet';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useMapStore } from '@/store/useMapStore';
import { useAuthStore } from '@/store/useAuthStore';
import { deleteSavedPlace } from '@/services/savedPlaces';
import { timeAgo } from '@/utils/time';

interface ZoneDetailSheetProps {
  visible: boolean;
  zoneId: string | null;
  onClose: () => void;
}

export const ZoneDetailSheet: React.FC<ZoneDetailSheetProps> = memo(({ visible, zoneId, onClose }) => {
  const savedPlaces = useMapStore((s) => s.savedPlaces);
  const removeSavedPlaceFromStore = useMapStore((s) => s.removeSavedPlaceFromStore);
  const userId = useAuthStore((s) => s.user?.id);

  const zone = savedPlaces.find((z) => z.id === zoneId);
  if (!zone) return null;

  const isOwner = zone.created_by === userId;
  const hasAlerts = zone.notify_on_arrival || zone.notify_on_leave;

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
    <Sheet visible={visible} onClose={onClose} title={zone.name} snapHeight={420}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.infoRow}>
          <Badge label={zone.shape_type === 'polygon' ? 'Polygon' : 'Circle'} variant="info" />
          <Badge label={zone.type} variant="info" />
          {hasAlerts && <Badge label="Alerts On" variant="live" dot />}
        </View>

        {zone.shape_type === 'circle' && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Radius</Text>
            <Text style={styles.detailValue}>{zone.radius_meters}m</Text>
          </View>
        )}
        {zone.shape_type === 'polygon' && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Points</Text>
            <Text style={styles.detailValue}>{zone.polygon_coords.length} vertices</Text>
          </View>
        )}

        <View style={styles.alertsBox}>
          <Text style={styles.alertsTitle}>Alert Settings</Text>
          <View style={styles.alertRow}>
            <Text style={styles.alertLabel}>On arrival</Text>
            <Text style={[styles.alertValue, zone.notify_on_arrival ? styles.on : styles.off]}>
              {zone.notify_on_arrival ? 'On' : 'Off'}
            </Text>
          </View>
          <View style={styles.alertRow}>
            <Text style={styles.alertLabel}>On leave</Text>
            <Text style={[styles.alertValue, zone.notify_on_leave ? styles.on : styles.off]}>
              {zone.notify_on_leave ? 'On' : 'Off'}
            </Text>
          </View>
          {zone.alert_rules?.stay_too_long_minutes && (
            <View style={styles.alertRow}>
              <Text style={styles.alertLabel}>Stay-too-long</Text>
              <Text style={styles.alertValue}>{zone.alert_rules.stay_too_long_minutes} min</Text>
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
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#2a2a3a' },
  detailLabel: { color: '#8888aa', fontSize: 14 },
  detailValue: { color: '#e8e8f0', fontSize: 14, fontWeight: '600' },
  alertsBox: { backgroundColor: '#0a0a0f', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#2a2a3a', gap: 8 },
  alertsTitle: { color: '#8888aa', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  alertRow: { flexDirection: 'row', justifyContent: 'space-between' },
  alertLabel: { color: '#c8c8d8', fontSize: 14 },
  alertValue: { fontSize: 14, fontWeight: '600' },
  on: { color: '#22c55e' },
  off: { color: '#6b7280' },
  meta: { color: '#5555aa', fontSize: 12 },
});
