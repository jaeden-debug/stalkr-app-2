/**
 * MarkerDetailSheet — shows details for a selected tactical marker.
 * Owners can rename, drag-to-move, and delete.
 */
import React, { memo, useState, useEffect } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Sheet } from '@/components/ui/Sheet';
import { CoordDisplay } from '@/components/ui/CoordDisplay';
import { useMapStore } from '@/store/useMapStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useToast } from '@/components/ui/Toast';
import { getMarkerConfig } from '@/constants/markerTypes';
import { updateMarker } from '@/services/markers';
import { timeAgo } from '@/utils/time';

interface MarkerDetailSheetProps {
  visible: boolean;
  markerId: string | null;
  onClose: () => void;
}

export const MarkerDetailSheet: React.FC<MarkerDetailSheetProps> = memo(
  ({ visible, markerId, onClose }) => {
    const markers = useMapStore((s) => s.markers);
    const deleteMarker = useMapStore((s) => s.deleteMarker);
    const updateMarkerInStore = useMapStore((s) => s.updateMarkerInStore);
    const setDraggingMarkerId = useMapStore((s) => s.setDraggingMarkerId);
    const userId = useAuthStore((s) => s.user?.id);
    const toast = useToast();

    const marker = markers.find((m) => m.id === markerId);

    const [title, setTitle] = useState('');
    const [renaming, setRenaming] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
      if (marker) setTitle(marker.title);
      setRenaming(false);
    }, [marker?.id]);

    if (!marker) return null;

    const config = getMarkerConfig(marker.type);
    const isOwner = marker.created_by === userId;

    const handleSaveTitle = async () => {
      const trimmed = title.trim();
      if (!trimmed || trimmed === marker.title) { setRenaming(false); return; }
      setSaving(true);
      updateMarkerInStore(marker.id, { title: trimmed });
      await updateMarker(marker.id, { title: trimmed });
      setSaving(false);
      setRenaming(false);
      toast.success('Marker renamed');
    };

    const handleMove = () => {
      setDraggingMarkerId(marker.id);
      onClose();
      toast.info('Hold and drag the marker to reposition it');
    };

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
      <Sheet visible={visible} onClose={onClose} title={marker.title} snapHeight={isOwner ? 460 : 340}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Type row */}
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

          {/* Owner actions */}
          {isOwner && (
            <>
              <View style={styles.divider} />

              {/* Rename */}
              {renaming ? (
                <View style={styles.renameRow}>
                  <TextInput
                    style={styles.renameInput}
                    value={title}
                    onChangeText={setTitle}
                    autoFocus
                    returnKeyType="done"
                    onSubmitEditing={handleSaveTitle}
                    selectionColor="#22c55e"
                    placeholderTextColor="#5555aa"
                  />
                  <TouchableOpacity style={styles.saveBtn} onPress={handleSaveTitle} disabled={saving}>
                    <Text style={styles.saveBtnText}>{saving ? '…' : 'Save'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => { setTitle(marker.title); setRenaming(false); }}>
                    <Text style={styles.cancelBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={styles.actionRow} onPress={() => setRenaming(true)}>
                  <Text style={styles.actionIcon}>✏️</Text>
                  <Text style={styles.actionLabel}>Rename</Text>
                  <Text style={styles.actionChevron}>›</Text>
                </TouchableOpacity>
              )}

              {/* Move */}
              <TouchableOpacity style={styles.actionRow} onPress={handleMove}>
                <Text style={styles.actionIcon}>✥</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.actionLabel}>Move Marker</Text>
                  <Text style={styles.actionSub}>Hold and drag to reposition</Text>
                </View>
                <Text style={styles.actionChevron}>›</Text>
              </TouchableOpacity>

              {/* Delete */}
              <TouchableOpacity style={[styles.actionRow, styles.actionRowDanger]} onPress={handleDelete}>
                <Text style={styles.actionIcon}>🗑️</Text>
                <Text style={[styles.actionLabel, styles.actionLabelDanger]}>Delete Marker</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </Sheet>
    );
  },
);

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12 },

  typeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  typeIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 22 },
  typeLabel: { color: '#e8e8f0', fontSize: 15, fontWeight: '600' },
  timeText: { color: '#8888aa', fontSize: 12, marginTop: 2 },

  notesBox: { backgroundColor: '#0a0a0f', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: '#2a2a3a' },
  notesText: { color: '#c8c8d8', fontSize: 14, lineHeight: 20 },

  divider: { height: 1, backgroundColor: '#2a2a3a', marginVertical: 4 },

  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a28',
  },
  actionRowDanger: { borderBottomWidth: 0, marginTop: 4 },
  actionIcon: { fontSize: 18, width: 26, textAlign: 'center' },
  actionLabel: { flex: 1, color: '#e8e8f0', fontSize: 15, fontWeight: '500' },
  actionLabelDanger: { color: '#ef4444' },
  actionSub: { color: '#8888aa', fontSize: 12, marginTop: 1 },
  actionChevron: { color: '#5555aa', fontSize: 18 },

  renameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  renameInput: {
    flex: 1,
    backgroundColor: '#0a0a0f',
    borderWidth: 1,
    borderColor: '#22c55e',
    borderRadius: 10,
    padding: 11,
    color: '#e8e8f0',
    fontSize: 15,
    height: 46,
  },
  saveBtn: {
    backgroundColor: '#22c55e',
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: { color: '#000', fontWeight: '700', fontSize: 14 },
  cancelBtn: {
    width: 46, height: 46, borderRadius: 10,
    backgroundColor: '#1a1a28', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#2a2a3a',
  },
  cancelBtnText: { color: '#8888aa', fontSize: 16 },
});
