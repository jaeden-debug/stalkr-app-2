import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

type BadgeVariant = 'live' | 'stale' | 'offline' | 'danger' | 'warning' | 'info' | 'pro' | 'crew' | 'sos';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  dot?: boolean;
}

const VARIANT_COLORS: Record<BadgeVariant, { bg: string; text: string; dot: string }> = {
  live:    { bg: 'rgba(34,197,94,0.15)',  text: '#22c55e', dot: '#22c55e' },
  stale:   { bg: 'rgba(245,158,11,0.15)', text: '#f59e0b', dot: '#f59e0b' },
  offline: { bg: 'rgba(107,114,128,0.15)',text: '#9ca3af', dot: '#6b7280' },
  danger:  { bg: 'rgba(239,68,68,0.15)',  text: '#ef4444', dot: '#ef4444' },
  warning: { bg: 'rgba(245,158,11,0.15)', text: '#f59e0b', dot: '#f59e0b' },
  info:    { bg: 'rgba(59,130,246,0.15)', text: '#60a5fa', dot: '#3b82f6' },
  pro:     { bg: 'rgba(34,197,94,0.15)',  text: '#22c55e', dot: '#22c55e' },
  crew:    { bg: 'rgba(59,130,246,0.15)', text: '#60a5fa', dot: '#3b82f6' },
  sos:     { bg: 'rgba(239,68,68,0.25)',  text: '#ef4444', dot: '#ef4444' },
};

export const Badge: React.FC<BadgeProps> = ({
  label,
  variant = 'info',
  size = 'sm',
  dot = false,
}) => {
  const c = VARIANT_COLORS[variant];
  const isSmall = size === 'sm';

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: c.bg,
          paddingHorizontal: isSmall ? 8 : 12,
          paddingVertical: isSmall ? 3 : 5,
        },
      ]}
    >
      {dot && (
        <View
          style={[
            styles.dot,
            { backgroundColor: c.dot, width: isSmall ? 6 : 8, height: isSmall ? 6 : 8 },
          ]}
        />
      )}
      <Text style={[styles.label, { color: c.text, fontSize: isSmall ? 11 : 13 }]}>
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    borderRadius: 99,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dot: {
    borderRadius: 99,
  },
  label: {
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
