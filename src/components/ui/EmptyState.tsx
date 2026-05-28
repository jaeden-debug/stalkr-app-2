import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type ActionProp =
  | React.ReactNode
  | { label: string; onPress: () => void };

function isActionObject(a: ActionProp): a is { label: string; onPress: () => void } {
  return typeof a === 'object' && a !== null && 'label' in (a as object) && 'onPress' in (a as object);
}

interface EmptyStateProps {
  emoji?: string;
  title: string;
  subtitle?: string;
  /** Pass either a { label, onPress } shorthand or a full ReactNode */
  action?: ActionProp;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  emoji = '📭',
  title,
  subtitle,
  action,
}) => (
  <View style={styles.container}>
    <Text style={styles.emoji}>{emoji}</Text>
    <Text style={styles.title}>{title}</Text>
    {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    {action ? (
      <View style={styles.action}>
        {isActionObject(action) ? (
          <TouchableOpacity style={styles.btn} onPress={action.onPress} activeOpacity={0.8}>
            <Text style={styles.btnText}>{action.label}</Text>
          </TouchableOpacity>
        ) : (
          action
        )}
      </View>
    ) : null}
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 10,
  },
  emoji: { fontSize: 48 },
  title: { color: '#e8e8f0', fontSize: 18, fontWeight: '700', textAlign: 'center' },
  subtitle: { color: '#8888aa', fontSize: 14, textAlign: 'center' },
  action: { marginTop: 8 },
  btn: {
    backgroundColor: '#22c55e',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  btnText: { color: '#000', fontWeight: '700', fontSize: 14 },
});
