/**
 * MarkerDetailSheet — shows details for a selected tactical marker.
 */
import React, { memo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Sheet } from '@/components/ui/Sheet';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { CoordDisplay } from '@/components/ui/CoordDisplay';
import { useMapStore } from '@/store/useMapStore';
import { useAuthStore } from '@/store/useAuthStore';
import { getMarkerConfig } from '@/constants/markerTypes';
import { formatDate, timeAgo } from '@/utils/time';

interface MarkerDetailSheetProps {
  visible: boolean;
  markerId: string | null;
  onClose: () => void;
}

export const MarkerDetailSheet: React.FC<MarkerDetailSheetProps> = memo(({ visible, markerId, onClose }) => {
  const markers = useMapStore((s) => s.markers);
  const deleteMarker = useMapStore((s) => s.deleteMarker);
  const userId = useAuthStore((s) => s.user?.id);

  const marker = markers.find((m) => m.id === markerId);
  if (!marker) return null;

  const config = getMarkerConfig(marker.type);
  const isOwner = marker.created_by === userId;

  const handleDelete = () => {
    Alert.alert('Delete Marker', `Delete "${marker.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteMarker(marker.id);
          onClose();
        },
      },
    ]);
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={marker.title} snapHeight={400}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Type badge */}
        <View style={styles.typeRow}>
          <View style={[styles.typeIcon, { backgroundColor: `${config.color}22` }]}>
            <Text style={styles.emoji}>{config.emoji}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.typeLabel}>{config.label}</Text>
            <Text style={styles.timeText}>{timeAgo(marker.created_at)}</Text>
          </View>
        </View>

        {/* Notes */}
        {(marker.notes || marker.description) && (
          <View style={styles.notesBox}>
            <Text style={styles.notesText}>{marker.notes || marker.description}</Text>
          </View>
        )}

        {/* Coordinates */}
        <CoordDisplay latitude={marker.latitude} longitude={marker.longitude} />

        {/* Actions */}
        {isOwner && (
          <Button label="Delete Marker" variant="danger" onPress={handleDelete} fullWidth />
        )}
      </ScrollView>
    </Sheet>
  );
});

const styles = StyleSheet.create({
  content: { padding: 16, gap: 14 },
  typeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  typeIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 22 },
  typeLabel: { color: '#e8e8f0', fontSize: 15, fontWeight: '600' },
  timeText: { color: '#8888aa', fontSize: 12, marginTop: 2 },
  notesBox: { backgroundColor: '#0a0a0f', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: '#2a2a3a' },
  notesText: { color: '#c8c8d8', fontSize: 14, lineHeight: 20 },
});
