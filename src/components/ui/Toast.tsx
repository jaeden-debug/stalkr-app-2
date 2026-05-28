import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  subtitle?: string;
}

interface ToastContextType {
  show: (title: string, type?: ToastType, subtitle?: string) => void;
  success: (title: string, subtitle?: string) => void;
  error: (title: string, subtitle?: string) => void;
  warning: (title: string, subtitle?: string) => void;
  info: (title: string, subtitle?: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

const TOAST_COLORS: Record<ToastType, string> = {
  success: '#22c55e',
  error: '#ef4444',
  warning: '#f59e0b',
  info: '#3b82f6',
};

const TOAST_EMOJIS: Record<ToastType, string> = {
  success: '✓',
  error: '✕',
  warning: '⚠',
  info: 'ℹ',
};

const ToastItem: React.FC<{ toast: ToastMessage; onDismiss: (id: string) => void }> = ({
  toast,
  onDismiss,
}) => {
  const anim = useRef(new Animated.Value(0)).current;
  const color = TOAST_COLORS[toast.type];

  React.useEffect(() => {
    Animated.spring(anim, { toValue: 1, useNativeDriver: true, tension: 70, friction: 10 }).start();
    const timer = setTimeout(() => {
      Animated.timing(anim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() =>
        onDismiss(toast.id),
      );
    }, 3500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Animated.View
      style={[
        styles.toast,
        { borderLeftColor: color, opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }] },
      ]}
    >
      <View style={[styles.toastIcon, { backgroundColor: `${color}22` }]}>
        <Text style={[styles.toastIconText, { color }]}>{TOAST_EMOJIS[toast.type]}</Text>
      </View>
      <View style={styles.toastContent}>
        <Text style={styles.toastTitle}>{toast.title}</Text>
        {toast.subtitle && <Text style={styles.toastSubtitle}>{toast.subtitle}</Text>}
      </View>
      <TouchableOpacity onPress={() => onDismiss(toast.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Text style={styles.toastClose}>✕</Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const { top } = useSafeAreaInsets();

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback((title: string, type: ToastType = 'info', subtitle?: string) => {
    const id = `${Date.now()}_${Math.random()}`;
    setToasts((prev) => [...prev.slice(-2), { id, type, title, subtitle }]);
  }, []);

  const ctx: ToastContextType = {
    show,
    success: (title, subtitle) => show(title, 'success', subtitle),
    error: (title, subtitle) => show(title, 'error', subtitle),
    warning: (title, subtitle) => show(title, 'warning', subtitle),
    info: (title, subtitle) => show(title, 'info', subtitle),
  };

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      <View style={[styles.container, { top: top + 8 }]} pointerEvents="box-none">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </View>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextType => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
};

export const Toast = ToastProvider;

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 99999,
    gap: 8,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a24',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a3a',
    borderLeftWidth: 3,
    paddingVertical: 12,
    paddingRight: 12,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  toastIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  toastIconText: { fontSize: 14, fontWeight: '700' },
  toastContent: { flex: 1 },
  toastTitle: { color: '#e8e8f0', fontSize: 14, fontWeight: '600' },
  toastSubtitle: { color: '#8888aa', fontSize: 12, marginTop: 2 },
  toastClose: { color: '#5555aa', fontSize: 13 },
});
