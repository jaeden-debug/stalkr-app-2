/**
 * MeasurePanel — tactical measure mode. Tap the map to drop points; shows total
 * distance, last-leg bearing, and supports multi-segment routes. Metric/Imperial.
 */
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useMapStore } from '@/store/useMapStore';
import { getDistance, getBearing } from '@/utils/distance';
import { C } from '@/constants/theme';

function fmt(meters: number, units: 'metric' | 'imperial'): string {
  if (units === 'imperial') {
    const ft = meters * 3.28084;
    if (ft < 1000) return `${Math.round(ft)} ft`;
    return `${(ft / 5280).toFixed(2)} mi`;
  }
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(2)} km`;
}

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const compass = (deg: number) => COMPASS[Math.round(deg / 45) % 8];

export const MeasurePanel: React.FC = () => {
  const measuring = useMapStore((s) => s.measuring);
  const points = useMapStore((s) => s.measurePoints);
  const units = useMapStore((s) => s.units);
  const toggleUnits = useMapStore((s) => s.toggleUnits);
  const undo = useMapStore((s) => s.undoMeasurePoint);
  const clear = useMapStore((s) => s.clearMeasure);
  const stop = useMapStore((s) => s.stopMeasure);

  if (!measuring) return null;

  let total = 0;
  for (let i = 1; i < points.length; i++) total += getDistance(points[i - 1], points[i]);
  const lastBearing = points.length >= 2 ? getBearing(points[points.length - 2], points[points.length - 1]) : null;

  return (
    <SafeAreaView style={s.overlay} pointerEvents="box-none" edges={['bottom']}>
      <View style={s.card}>
        <View style={s.head}>
          <View style={s.headLeft}>
            <Ionicons name="resize" size={16} color={C.green} />
            <Text style={s.headText}>MEASURE</Text>
          </View>
          <TouchableOpacity style={s.unitBtn} onPress={toggleUnits} activeOpacity={0.8}>
            <Text style={s.unitText}>{units === 'imperial' ? 'MI / FT' : 'KM / M'}</Text>
          </TouchableOpacity>
        </View>

        {points.length < 2 ? (
          <Text style={s.hint}>Tap the map to drop points. Distance and bearing appear here.</Text>
        ) : (
          <View style={s.statsRow}>
            <View style={s.stat}>
              <Text style={s.statLabel}>TOTAL</Text>
              <Text style={s.statValue}>{fmt(total, units)}</Text>
            </View>
            <View style={s.stat}>
              <Text style={s.statLabel}>BEARING</Text>
              <Text style={s.statValue}>{lastBearing != null ? `${Math.round(lastBearing)}° ${compass(lastBearing)}` : '—'}</Text>
            </View>
            <View style={s.stat}>
              <Text style={s.statLabel}>POINTS</Text>
              <Text style={s.statValue}>{points.length}</Text>
            </View>
          </View>
        )}

        <View style={s.actions}>
          <TouchableOpacity style={s.ghost} onPress={undo} activeOpacity={0.8} disabled={points.length === 0}>
            <Ionicons name="arrow-undo" size={14} color={points.length ? C.amber : 'rgba(255,255,255,0.25)'} />
            <Text style={[s.ghostText, !points.length && { color: 'rgba(255,255,255,0.25)' }]}>BACK</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.ghost} onPress={clear} activeOpacity={0.8} disabled={points.length === 0}>
            <Text style={[s.ghostText, !points.length && { color: 'rgba(255,255,255,0.25)' }]}>CLEAR</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.done} onPress={stop} activeOpacity={0.85}>
            <Text style={s.doneText}>DONE</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill, justifyContent: 'flex-end', pointerEvents: 'box-none' } as any,
  card: {
    marginHorizontal: 14, marginBottom: 134,
    backgroundColor: 'rgba(8,8,12,0.97)', borderRadius: 18, padding: 14,
    borderWidth: 1, borderColor: C.greenBorder, gap: 12,
    shadowColor: C.green, shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 0 }, elevation: 8,
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900', letterSpacing: 1.4 },
  unitBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: C.greenBorder, backgroundColor: C.greenDim },
  unitText: { color: C.green, fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  hint: { color: 'rgba(255,255,255,0.5)', fontSize: 12, lineHeight: 17 },
  statsRow: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  statLabel: { color: 'rgba(255,255,255,0.45)', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  statValue: { color: '#FFFFFF', fontSize: 16, fontWeight: '900', marginTop: 3, fontVariant: ['tabular-nums'] },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ghost: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  ghostText: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '900', letterSpacing: 0.8 },
  done: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 999, backgroundColor: C.green },
  doneText: { color: '#000', fontSize: 12, fontWeight: '900', letterSpacing: 1 },
});
