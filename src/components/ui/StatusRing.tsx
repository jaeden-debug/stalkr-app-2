import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { LocationStatus } from '@/types/database';

const STATUS_COLORS: Record<LocationStatus, string> = {
  live: '#22c55e',
  stale: '#f59e0b',
  offline: '#6b7280',
  paused: '#3b82f6',
};

interface StatusRingProps {
  status: LocationStatus;
  size?: number;
}

export const StatusRing: React.FC<StatusRingProps> = ({ status, size = 12 }) => {
  const color = STATUS_COLORS[status];
  return (
    <View style={[styles.ring, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }]} />
  );
};

const styles = StyleSheet.create({
  ring: { borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.3)' },
});
