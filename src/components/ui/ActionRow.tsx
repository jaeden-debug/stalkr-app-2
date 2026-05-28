import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export interface ActionRowProps {
  label: string;
  subtitle?: string;
  value?: string;
  /** Emoji string shorthand, e.g. "👤" */
  icon?: string;
  /** Any ReactNode (e.g. <Text>👤</Text>) */
  leftIcon?: React.ReactNode;
  onPress?: () => void;
  destructive?: boolean;
  /** Show the › chevron (default true) */
  chevron?: boolean;
  /** Alias for chevron — some screens use showChevron */
  showChevron?: boolean;
  rightElement?: React.ReactNode;
}

export const ActionRow: React.FC<ActionRowProps> = ({
  label,
  subtitle,
  value,
  icon,
  leftIcon,
  onPress,
  destructive,
  chevron,
  showChevron,
  rightElement,
}) => {
  // showChevron takes precedence if explicitly provided; otherwise fall back to chevron; default true
  const showArrow = showChevron !== undefined ? showChevron : (chevron !== undefined ? chevron : true);

  const inner = (
    <View style={styles.row}>
      {/* Left icon — accept either emoji string or ReactNode */}
      {(icon || leftIcon) && (
        <View style={styles.iconWrap}>
          {leftIcon ?? <Text style={styles.icon}>{icon}</Text>}
        </View>
      )}
      <View style={styles.labelWrap}>
        <Text style={[styles.label, destructive && styles.destructive]}>{label}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      <View style={styles.right}>
        {value ? <Text style={styles.value}>{value}</Text> : null}
        {rightElement ?? null}
        {showArrow && !rightElement && !value && (
          <Text style={styles.chevron}>›</Text>
        )}
      </View>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {inner}
      </TouchableOpacity>
    );
  }
  return inner;
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e1e2e',
    gap: 12,
    backgroundColor: '#12121a',
  },
  iconWrap: { width: 26, alignItems: 'center' },
  icon: { fontSize: 18 },
  labelWrap: { flex: 1, gap: 2 },
  label: { color: '#e8e8f0', fontSize: 15 },
  destructive: { color: '#ef4444' },
  subtitle: { color: '#8888aa', fontSize: 12 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  value: { color: '#8888aa', fontSize: 14 },
  chevron: { color: '#5555aa', fontSize: 20 },
});
