import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, TouchableOpacity, View } from 'react-native';

interface ToggleProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  activeColor?: string;
  size?: 'sm' | 'md';
}

export const Toggle: React.FC<ToggleProps> = ({
  value,
  onValueChange,
  disabled = false,
  activeColor = '#22c55e',
  size = 'md',
}) => {
  const translateX = useRef(new Animated.Value(value ? 1 : 0)).current;
  const isSmall = size === 'sm';
  const trackWidth = isSmall ? 40 : 52;
  const thumbSize = isSmall ? 16 : 22;
  const trackHeight = isSmall ? 22 : 30;
  const travel = trackWidth - thumbSize - (isSmall ? 4 : 6);

  useEffect(() => {
    Animated.spring(translateX, {
      toValue: value ? 1 : 0,
      useNativeDriver: true,
      bounciness: 6,
    }).start();
  }, [value]);

  const thumbX = translateX.interpolate({
    inputRange: [0, 1],
    outputRange: [isSmall ? 2 : 3, travel],
  });

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => !disabled && onValueChange(!value)}
      style={{ opacity: disabled ? 0.4 : 1 }}
    >
      <View
        style={[
          styles.track,
          {
            width: trackWidth,
            height: trackHeight,
            backgroundColor: value ? activeColor : '#2a2a3a',
            borderRadius: trackHeight / 2,
          },
        ]}
      >
        <Animated.View
          style={[
            styles.thumb,
            {
              width: thumbSize,
              height: thumbSize,
              borderRadius: thumbSize / 2,
              transform: [{ translateX: thumbX }],
              top: (trackHeight - thumbSize) / 2,
            },
          ]}
        />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  track: {
    justifyContent: 'center',
  },
  thumb: {
    position: 'absolute',
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
});
