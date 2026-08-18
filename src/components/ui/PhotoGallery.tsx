/**
 * PhotoGallery — reusable photo strip for markers + zones.
 * Loads photos, lets owners add from the library (expo-image-picker), uploads
 * via the provided callback, and shows thumbnails. Backend-agnostic.
 */
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { C } from '@/constants/theme';

interface Photo { id: string; url?: string }

interface Props {
  reloadKey?: string;
  canEdit?: boolean;
  /**
   * Why editing is unavailable, when canEdit is false. Without this the add
   * button just silently vanishes and the user has no idea a photo is even
   * possible — which is why zero photos were ever uploaded.
   */
  lockedReason?: string;
  /** Called when a locked gallery is tapped, e.g. to open the paywall. */
  onLockedPress?: () => void;
  load: () => Promise<Photo[]>;
  upload: (uri: string) => Promise<Photo | null>;
}

export function PhotoGallery({
  reloadKey,
  canEdit = true,
  lockedReason,
  onLockedPress,
  load,
  upload,
}: Props) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    let on = true;
    setLoading(true);
    load()
      .then((p) => { if (on) setPhotos(p || []); })
      .catch(() => {})
      .finally(() => { if (on) setLoading(false); });
    return () => { on = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey]);

  const add = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return;
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
      });
      if (res.canceled || !res.assets?.[0]?.uri) return;
      setUploading(true);
      const photo = await upload(res.assets[0].uri);
      if (photo) setPhotos((p) => [...p, photo]);
    } catch {
      /* cancelled / failed */
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={s.wrap}>
      <Text style={s.label}>PHOTOS</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.row}>
        {canEdit && (
          <TouchableOpacity style={s.addTile} onPress={add} activeOpacity={0.8} disabled={uploading}>
            {uploading ? <ActivityIndicator color={C.green} /> : <Ionicons name="camera" size={22} color={C.green} />}
            <Text style={s.addText}>{uploading ? 'Uploading…' : 'Add'}</Text>
          </TouchableOpacity>
        )}
        {loading && photos.length === 0 && <ActivityIndicator color={C.green} style={{ marginLeft: 12 }} />}
        {photos.filter((p) => !!p.url).map((p) => (
          <Image key={p.id} source={{ uri: p.url }} style={s.thumb} />
        ))}
        {!loading && photos.length === 0 && !canEdit && <Text style={s.empty}>No photos yet.</Text>}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: 8 },
  label: { color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: '900', letterSpacing: 1.4 },
  row: { gap: 10, alignItems: 'center', paddingVertical: 2 },
  lockedTile: {
    width: 76, height: 76, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    gap: 4, paddingHorizontal: 6,
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)', borderStyle: 'dashed',
  },
  lockedText: {
    color: 'rgba(255,255,255,0.5)', fontSize: 9, fontWeight: '700',
    textAlign: 'center', letterSpacing: 0.2,
  },
  addTile: {
    width: 76, height: 76, borderRadius: 14, alignItems: 'center', justifyContent: 'center', gap: 4,
    backgroundColor: 'rgba(34,197,94,0.1)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.4)', borderStyle: 'dashed',
  },
  addText: { color: C.green, fontSize: 11, fontWeight: '700' },
  thumb: { width: 76, height: 76, borderRadius: 14, backgroundColor: '#1a1a24' },
  empty: { color: 'rgba(255,255,255,0.4)', fontSize: 13, marginLeft: 4 },
});
