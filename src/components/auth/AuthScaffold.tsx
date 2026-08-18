/**
 * AuthScaffold — shared chrome for every auth screen.
 *
 * The auth screens each hardcoded their own palette (#0a0a0f ground, #22c55e
 * green, #8888aa labels, #f8fafc text) instead of the design system the rest of
 * the app uses. That is what read as "blue and off brand": #8888aa is a
 * blue-grey and #f8fafc a cool white, against a ground that was not even the
 * app's own #080808.
 *
 * Everything here comes from src/constants/theme.ts, so auth now matches the
 * nav drawer: near-black ground, glass card, #4ADE80 signal green.
 */
import React from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { C, R } from '@/constants/theme';

interface AuthScaffoldProps {
  /** Short ALL-CAPS eyebrow above the title, e.g. "SIGN IN". */
  eyebrow: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Hide the wordmark on secondary screens so they feel like a step, not a start. */
  showBrand?: boolean;
}

export const AuthScaffold: React.FC<AuthScaffoldProps> = ({
  eyebrow,
  title,
  subtitle,
  children,
  footer,
  showBrand = true,
}) => (
  <SafeAreaView style={s.root} edges={['top', 'bottom']}>
    <KeyboardAvoidingView
      style={s.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {showBrand && (
          <View style={s.brand}>
            <Image
              source={require('../../../assets/stalkr-logo.png')}
              style={s.logo}
              resizeMode="contain"
            />
            <Text style={s.wordmark}>STALKR</Text>
            <View style={s.rule} />
          </View>
        )}

        <View style={s.card}>
          <Text style={s.eyebrow}>{eyebrow}</Text>
          <Text style={s.title}>{title}</Text>
          {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
          <View style={s.body}>{children}</View>
        </View>

        {footer ? <View style={s.footer}>{footer}</View> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>
);

/** Labelled input matching the drawer's field styling. */
export const AuthField: React.FC<{ label: string; children: React.ReactNode }> = ({
  label,
  children,
}) => (
  <View style={s.field}>
    <Text style={s.label}>{label}</Text>
    {children}
  </View>
);

/** Shared TextInput style so every auth field is identical. */
export const authInputStyle = {
  backgroundColor: C.surface,
  borderWidth: 1,
  borderColor: C.border,
  borderRadius: R.sm,
  paddingHorizontal: 14,
  color: C.textPrimary,
  fontSize: 16,
  height: 52,
} as const;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 26 },

  brand: { alignItems: 'center', gap: 8 },
  logo: { width: 76, height: 76 },
  wordmark: {
    color: C.textPrimary,
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 6,
  },
  rule: { height: 3, width: 34, borderRadius: 2, backgroundColor: C.green },

  card: {
    backgroundColor: C.glass,
    borderWidth: 1,
    borderColor: C.glassBorder,
    borderRadius: R.lg,
    padding: 24,
  },
  eyebrow: {
    color: C.green,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.6,
    marginBottom: 8,
  },
  title: {
    color: C.textPrimary,
    fontSize: 23,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  subtitle: {
    color: C.textSub,
    fontSize: 13.5,
    lineHeight: 19,
    marginTop: 8,
  },
  body: { marginTop: 22, gap: 16 },

  field: { gap: 7 },
  label: {
    color: C.textSub,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },

  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
});
