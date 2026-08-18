import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableOpacityProps,
  View,
} from 'react-native';
import { C } from '@/constants/theme';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline' | 'sos';
type Size = 'sm' | 'md' | 'lg' | 'xl';

interface ButtonProps extends Omit<TouchableOpacityProps, 'style'> {
  label: string;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
  fullWidth?: boolean;
}

const VARIANT_STYLES: Record<Variant, { bg: string; text: string; border?: string }> = {
  // Sourced from the design system rather than hardcoded, so buttons match the
  // nav drawer instead of drifting to a slightly different green/grey.
  primary:   { bg: C.green, text: '#04140A' },
  secondary: { bg: C.surface, text: C.textPrimary, border: C.border },
  danger:    { bg: C.red, text: '#FFFFFF' },
  ghost:     { bg: 'transparent', text: C.textPrimary },
  outline:   { bg: 'transparent', text: C.green, border: C.greenBorder },
  sos:       { bg: C.red, text: '#FFFFFF' },
};

const SIZE_STYLES: Record<Size, { height: number; px: number; fontSize: number; radius: number }> = {
  sm:  { height: 36, px: 14, fontSize: 13, radius: 8 },
  md:  { height: 48, px: 20, fontSize: 15, radius: 10 },
  lg:  { height: 56, px: 24, fontSize: 16, radius: 12 },
  xl:  { height: 64, px: 28, fontSize: 17, radius: 14 },
};

export const Button: React.FC<ButtonProps> = ({
  label,
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  iconRight,
  fullWidth = false,
  disabled,
  ...props
}) => {
  const v = VARIANT_STYLES[variant];
  const s = SIZE_STYLES[size];
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      disabled={isDisabled}
      style={[
        styles.base,
        {
          height: s.height,
          paddingHorizontal: s.px,
          borderRadius: s.radius,
          backgroundColor: v.bg,
          borderWidth: v.border ? 1.5 : 0,
          borderColor: v.border,
          opacity: isDisabled ? 0.5 : 1,
          alignSelf: fullWidth ? 'stretch' : 'auto',
        },
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={v.text} size="small" />
      ) : (
        <>
          {icon && <View style={styles.iconLeft}>{icon}</View>}
          <Text style={[styles.label, { color: v.text, fontSize: s.fontSize }]}>
            {label}
          </Text>
          {iconRight && <View style={styles.iconRight}>{iconRight}</View>}
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  iconLeft: { marginRight: 8 },
  iconRight: { marginLeft: 8 },
});
