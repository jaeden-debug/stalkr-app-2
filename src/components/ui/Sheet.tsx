import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { C } from '@/constants/theme';

interface SheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  snapHeight?: number | 'auto' | 'full';
  closeOnBackdrop?: boolean;
  showHandle?: boolean;
}

const SCREEN_HEIGHT = Dimensions.get('window').height;

export const Sheet: React.FC<SheetProps> = ({
  visible,
  onClose,
  title,
  children,
  snapHeight = 'auto',
  closeOnBackdrop = true,
  showHandle = true,
}) => {
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } else {
      Animated.timing(translateY, {
        toValue: SCREEN_HEIGHT,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const sheetHeight =
    snapHeight === 'full'
      ? SCREEN_HEIGHT * 0.92
      : snapHeight === 'auto'
      ? undefined
      : snapHeight;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        {closeOnBackdrop && (
          <TouchableWithoutFeedback onPress={onClose}>
            <View style={styles.backdrop} />
          </TouchableWithoutFeedback>
        )}
        <Animated.View
          style={[
            styles.sheet,
            sheetHeight ? { height: sheetHeight } : {},
            { transform: [{ translateY }] },
          ]}
        >
          <BlurView intensity={95} tint="dark" style={StyleSheet.absoluteFill} pointerEvents="none" />
          {showHandle && <View style={styles.handle} />}
          {title && (
            <View style={styles.header}>
              <Text style={styles.title}>{title}</Text>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Text style={styles.close}>✕</Text>
              </TouchableOpacity>
            </View>
          )}
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    backgroundColor: 'rgba(10,10,16,0.6)',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: C.glassBorder,
    overflow: 'hidden',
    paddingBottom: 34,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.4)',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  title: {
    color: C.textPrimary,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  close: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 16,
    fontWeight: '700',
  },
});
