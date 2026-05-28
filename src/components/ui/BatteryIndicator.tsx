import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface BatteryIndicatorProps {
  level: number | null;
  size?: 'sm' | 'md';
}

export const BatteryIndicator: React.FC<BatteryIndicatorProps> = ({ level, size = 'sm' }) => {
  if (level === null || level === undefined) return null;
  const color = level > 40 ? '#22c55e' : level > 20 ? '#f59e0b' : '#ef4444';
  const isMd = size === 'md';
  return (
    <View style={[styles.container, isMd && styles.md]}>
      <View style={[styles.body, isMd && styles.bodyMd, { borderColor: color }]}>
        <View style={[styles.fill, { width: `${level}%` as any, backgroundColor: color }]} />
      </View>
      <View style={[styles.cap, { backgroundColor: color }]} />
      {isMd && <Text style={[styles.label, { color }]}>{level}%</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  md: { gap: 4 },
  body: { width: 22, height: 11, borderWidth: 1.5, borderRadius: 3, padding: 1, overflow: 'hidden' },
  bodyMd: { width: 28, height: 14 },
  fill: { height: '100%', borderRadius: 1 },
  cap: { width: 3, height: 6, borderRadius: 1 },
  label: { fontSize: 11, fontWeight: '600' },
});
