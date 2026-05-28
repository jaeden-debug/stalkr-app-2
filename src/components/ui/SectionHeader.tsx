import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface SectionHeaderProps {
  title: string;
  action?: { label: string; onPress: () => void };
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({ title, action }) => (
  <View style={styles.row}>
    <Text style={styles.title}>{title}</Text>
    {action && (
      <TouchableOpacity onPress={action.onPress}>
        <Text style={styles.action}>{action.label}</Text>
      </TouchableOpacity>
    )}
  </View>
);

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  title: { color: '#8888aa', fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  action: { color: '#22c55e', fontSize: 13, fontWeight: '600' },
});
