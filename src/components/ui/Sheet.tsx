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
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    backgroundColor: '#12121a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderColor: '#2a2a3a',
    paddingBottom: 34,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#3a3a4e',
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
    borderBottomColor: '#2a2a3a',
  },
  title: {
    color: '#e8e8f0',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  close: {
    color: '#8888aa',
    fontSize: 16,
  },
});
