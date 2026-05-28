/**
 * HeadingArrow — renders a triangular direction indicator.
 * Lightweight SVG-free implementation using border trick.
 */
import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';

interface HeadingArrowProps {
  heading: number;
  color: string;
  size: number;
}

export const HeadingArrow: React.FC<HeadingArrowProps> = memo(({ heading, color, size }) => {
  const arrowSize = size * 0.3;

  return (
    <View
      style={[
        styles.container,
        { width: size, height: size, transform: [{ rotate: `${heading}deg` }] },
      ]}
    >
      <View
        style={[
          styles.arrow,
          {
            borderLeftWidth: arrowSize / 2,
            borderRightWidth: arrowSize / 2,
            borderBottomWidth: arrowSize,
            borderBottomColor: color,
            top: 0,
          },
        ]}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    alignItems: 'center',
  },
  arrow: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
});
