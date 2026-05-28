import React from 'react';
import { StyleSheet, TouchableOpacity, View, ViewStyle } from 'react-native';

interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  padding?: number;
}

export const Card: React.FC<CardProps> = ({ children, onPress, style, padding = 14 }) => {
  const inner = <View style={[styles.card, { padding }, style]}>{children}</View>;
  if (onPress) return <TouchableOpacity onPress={onPress} activeOpacity={0.75}>{inner}</TouchableOpacity>;
  return inner;
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#12121a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a3a',
  },
});
