import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

interface LoadingOverlayProps {
  /** When false the overlay is not rendered (default true) */
  visible?: boolean;
  message?: string;
  /** Stretch to fill the entire parent instead of absolute fill */
  fullScreen?: boolean;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  visible = true,
  message,
  fullScreen = false,
}) => {
  if (!visible) return null;

  return (
    <View style={[styles.overlay, fullScreen && styles.fullScreen]}>
      <ActivityIndicator size="large" color="#22c55e" />
      {message ? <Text style={styles.text}>{message}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,10,15,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    zIndex: 9999,
  },
  fullScreen: {
    flex: 1,
    position: 'relative',
  },
  text: { color: '#e8e8f0', fontSize: 14 },
});
