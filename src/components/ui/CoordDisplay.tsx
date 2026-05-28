import React from 'react';
import { Clipboard, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useToast } from './Toast';

interface CoordDisplayProps {
  latitude: number;
  longitude: number;
}

export const CoordDisplay: React.FC<CoordDisplayProps> = ({ latitude, longitude }) => {
  const toast = useToast();
  const text = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => { Clipboard.setString(text); toast.success('Coordinates copied'); }}
      activeOpacity={0.7}
    >
      <Text style={styles.coords}>{text}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0a0a0f',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#2a2a3a',
  },
  coords: { color: '#22c55e', fontSize: 13, fontFamily: 'Courier New', fontWeight: '600' },
});
