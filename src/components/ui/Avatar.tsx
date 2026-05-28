import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

interface AvatarProps {
  uri?: string | null;
  initials?: string | null;
  displayName?: string | null;
  size?: number;
  color?: string;
  borderColor?: string;
}

export const Avatar: React.FC<AvatarProps> = ({
  uri,
  initials,
  displayName,
  size = 44,
  color = '#22c55e',
  borderColor,
}) => {
  const fontSize = size * 0.38;
  const resolvedInitials =
    initials ||
    (displayName
      ? displayName
          .split(' ')
          .slice(0, 2)
          .map((w) => w[0])
          .join('')
          .toUpperCase()
      : '?');

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[
          styles.image,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: borderColor ? 2 : 0,
            borderColor: borderColor,
          },
        ]}
      />
    );
  }

  return (
    <View
      style={[
        styles.initials,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: `${color}22`,
          borderWidth: 2,
          borderColor: color,
        },
      ]}
    >
      <Text style={[styles.initialsText, { fontSize, color }]}>
        {resolvedInitials}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  image: {
    backgroundColor: '#1a1a24',
  },
  initials: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialsText: {
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
