import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface EmptyStateProps {
  emoji?: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ emoji = '📭', title, subtitle, action }) => (
  <View style={styles.container}>
    <Text style={styles.emoji}>{emoji}</Text>
    <Text style={styles.title}>{title}</Text>
    {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    {action && <View style={styles.action}>{action}</View>}
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 },
  emoji: { fontSize: 48 },
  title: { color: '#e8e8f0', fontSize: 18, fontWeight: '700', textAlign: 'center' },
  subtitle: { color: '#8888aa', fontSize: 14, textAlign: 'center' },
  action: { marginTop: 8 },
});
