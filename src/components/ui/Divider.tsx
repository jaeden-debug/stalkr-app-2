import React from 'react';
import { StyleSheet, View } from 'react-native';

interface DividerProps {
  color?: string;
  /** Vertical margin above and below the line */
  margin?: number;
}

export const Divider: React.FC<DividerProps> = ({ color = '#2a2a3a', margin = 0 }) => (
  <View style={[styles.line, { backgroundColor: color, marginVertical: margin }]} />
);

const styles = StyleSheet.create({
  line: { height: 1, width: '100%' },
});
