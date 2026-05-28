import React from 'react';
import { StyleSheet, View } from 'react-native';

export const Divider: React.FC<{ color?: string }> = ({ color = '#2a2a3a' }) => (
  <View style={[styles.line, { backgroundColor: color }]} />
);
const styles = StyleSheet.create({ line: { height: 1, width: '100%' } });
