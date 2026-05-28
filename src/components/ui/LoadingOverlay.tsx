import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

export const LoadingOverlay: React.FC<{ message?: string }> = ({ message }) => (
  <View style={styles.overlay}>
    <ActivityIndicator size="large" color="#22c55e" />
    {message && <Text style={styles.text}>{message}</Text>}
  </View>
);

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,10,15,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    zIndex: 9999,
  },
  text: { color: '#e8e8f0', fontSize: 14 },
});
