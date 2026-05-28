import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface ActionRowProps {
  label: string;
  value?: string;
  icon?: string;
  onPress?: () => void;
  destructive?: boolean;
  chevron?: boolean;
  rightElement?: React.ReactNode;
}

export const ActionRow: React.FC<ActionRowProps> = ({
  label, value, icon, onPress, destructive, chevron = true, rightElement,
}) => {
  const inner = (
    <View style={styles.row}>
      {icon && <Text style={styles.icon}>{icon}</Text>}
      <Text style={[styles.label, destructive && styles.destructive]}>{label}</Text>
      <View style={styles.right}>
        {value && <Text style={styles.value}>{value}</Text>}
        {rightElement}
        {chevron && !rightElement && !value && (
          <Text style={styles.chevron}>›</Text>
        )}
      </View>
    </View>
  );

  if (onPress) return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>{inner}</TouchableOpacity>
  );
  return inner;
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: '#1e1e2e',
    gap: 12, backgroundColor: '#12121a',
  },
  icon: { fontSize: 18, width: 26, textAlign: 'center' },
  label: { flex: 1, color: '#e8e8f0', fontSize: 15 },
  destructive: { color: '#ef4444' },
  right: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  value: { color: '#8888aa', fontSize: 14 },
  chevron: { color: '#5555aa', fontSize: 20 },
});
