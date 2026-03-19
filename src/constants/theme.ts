import { Platform, type TextStyle, type ViewStyle } from 'react-native';

export const Colors = {
  light: {
    text: '#0F172A',
    textSecondary: '#475569',
    textTertiary: '#64748B',
    textInverse: '#F8FAFC',
    muted: '#64748B',

    background: '#F8FAFC',
    backgroundSecondary: '#F1F5F9',
    backgroundElement: '#FFFFFF',
    backgroundMuted: '#E2E8F0',
    backgroundSelected: '#DBEAFE',

    surface: '#FFFFFF',
    surfaceElevated: '#FFFFFF',
    card: '#FFFFFF',

    border: '#CBD5E1',
    borderSoft: '#E2E8F0',
    borderStrong: '#94A3B8',

    primary: '#22C55E',
    primaryPressed: '#16A34A',
    primaryMuted: '#DCFCE7',
    primaryForeground: '#052E16',
    onPrimary: '#052E16',

    success: '#16A34A',
    warning: '#D97706',
    danger: '#DC2626',
    info: '#2563EB',

    overlay: 'rgba(15, 23, 42, 0.16)',
    shadow: 'rgba(15, 23, 42, 0.12)',

    icon: '#334155',
    iconMuted: '#94A3B8',
    disabled: '#CBD5E1',
  },
  dark: {
    text: '#F8FAFC',
    textSecondary: '#CBD5E1',
    textTertiary: '#94A3B8',
    textInverse: '#08120C',
    muted: '#94A3B8',

    background: '#0B0F14',
    backgroundSecondary: '#111827',
    backgroundElement: '#121821',
    backgroundMuted: '#17202B',
    backgroundSelected: '#1E293B',

    surface: '#121821',
    surfaceElevated: '#17202B',
    card: '#121821',

    border: '#243141',
    borderSoft: '#1E293B',
    borderStrong: '#334155',

    primary: '#35C76F',
    primaryPressed: '#2FB763',
    primaryMuted: 'rgba(53, 199, 111, 0.16)',
    primaryForeground: '#08120C',
    onPrimary: '#08120C',

    success: '#35C76F',
    warning: '#F59E0B',
    danger: '#F87171',
    info: '#60A5FA',

    overlay: 'rgba(2, 6, 23, 0.55)',
    shadow: 'rgba(0, 0, 0, 0.35)',

    icon: '#E2E8F0',
    iconMuted: '#94A3B8',
    disabled: '#334155',
  },
} as const;

export type AppThemeName = keyof typeof Colors;
export type AppThemeColors = (typeof Colors)[AppThemeName];
export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

type FontTokens = {
  regular: string;
  medium: string;
  semibold: string;
  bold: string;
  sans: string;
  serif: string;
  rounded: string;
  mono: string;
};

export const Fonts: FontTokens = Platform.select<FontTokens>({
  ios: {
    regular: 'system-ui',
    medium: 'system-ui',
    semibold: 'system-ui',
    bold: 'system-ui',
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  android: {
    regular: 'sans-serif',
    medium: 'sans-serif-medium',
    semibold: 'sans-serif-medium',
    bold: 'sans-serif-bold',
    sans: 'sans-serif',
    serif: 'serif',
    rounded: 'sans-serif-medium',
    mono: 'monospace',
  },
  web: {
    regular: 'system-ui',
    medium: 'system-ui',
    semibold: 'system-ui',
    bold: 'system-ui',
    sans: 'system-ui',
    serif: 'serif',
    rounded: 'system-ui',
    mono: 'monospace',
  },
  default: {
    regular: 'normal',
    medium: 'normal',
    semibold: 'normal',
    bold: 'normal',
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
}) as FontTokens;

export const FontWeights = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  heavy: '800',
} as const;

export const FontSizes = {
  xs: 12,
  sm: 13,
  md: 14,
  lg: 16,
  xl: 18,
  '2xl': 20,
  '3xl': 24,
  '4xl': 30,
  '5xl': 36,
} as const;

export const LineHeights = {
  xs: 16,
  sm: 18,
  md: 20,
  lg: 22,
  xl: 24,
  '2xl': 28,
  '3xl': 32,
  '4xl': 38,
  '5xl': 44,
} as const;

export const Typography = {
  caption: {
    fontFamily: Fonts.sans,
    fontSize: FontSizes.xs,
    lineHeight: LineHeights.xs,
    fontWeight: FontWeights.medium,
  } satisfies TextStyle,
  bodySmall: {
    fontFamily: Fonts.sans,
    fontSize: FontSizes.sm,
    lineHeight: LineHeights.sm,
    fontWeight: FontWeights.regular,
  } satisfies TextStyle,
  body: {
    fontFamily: Fonts.sans,
    fontSize: FontSizes.md,
    lineHeight: LineHeights.md,
    fontWeight: FontWeights.regular,
  } satisfies TextStyle,
  bodyMedium: {
    fontFamily: Fonts.sans,
    fontSize: FontSizes.md,
    lineHeight: LineHeights.md,
    fontWeight: FontWeights.medium,
  } satisfies TextStyle,
  button: {
    fontFamily: Fonts.sans,
    fontSize: FontSizes.lg,
    lineHeight: LineHeights.lg,
    fontWeight: FontWeights.heavy,
  } satisfies TextStyle,
  label: {
    fontFamily: Fonts.sans,
    fontSize: FontSizes.sm,
    lineHeight: LineHeights.sm,
    fontWeight: FontWeights.semibold,
  } satisfies TextStyle,
  labelLarge: {
    fontFamily: Fonts.sans,
    fontSize: FontSizes.md,
    lineHeight: LineHeights.md,
    fontWeight: FontWeights.semibold,
  } satisfies TextStyle,
  titleSmall: {
    fontFamily: Fonts.rounded,
    fontSize: FontSizes.lg,
    lineHeight: LineHeights.lg,
    fontWeight: FontWeights.bold,
  } satisfies TextStyle,
  title: {
    fontFamily: Fonts.rounded,
    fontSize: FontSizes.xl,
    lineHeight: LineHeights.xl,
    fontWeight: FontWeights.bold,
  } satisfies TextStyle,
  titleLarge: {
    fontFamily: Fonts.rounded,
    fontSize: FontSizes['2xl'],
    lineHeight: LineHeights['2xl'],
    fontWeight: FontWeights.heavy,
  } satisfies TextStyle,
  headline: {
    fontFamily: Fonts.rounded,
    fontSize: FontSizes['3xl'],
    lineHeight: LineHeights['3xl'],
    fontWeight: FontWeights.heavy,
  } satisfies TextStyle,
  display: {
    fontFamily: Fonts.rounded,
    fontSize: FontSizes['4xl'],
    lineHeight: LineHeights['4xl'],
    fontWeight: FontWeights.heavy,
  } satisfies TextStyle,
  mono: {
    fontFamily: Fonts.mono,
    fontSize: FontSizes.sm,
    lineHeight: LineHeights.sm,
    fontWeight: FontWeights.medium,
  } satisfies TextStyle,
} as const;

export const Spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 48,
  '6xl': 64,

  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = {
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  full: 999,
} as const;

export const BorderWidth = {
  hairline: 0.5,
  sm: 1,
  md: 1.5,
  lg: 2,
} as const;

export const Layout = {
  bottomTabInset: Platform.select({ ios: 50, android: 80, default: 0 }) ?? 0,
  maxContentWidth: 800,
  screenHorizontalPadding: 16,
  screenVerticalPadding: 20,
  headerHeight: Platform.select({ ios: 52, android: 56, default: 56 }) ?? 56,
} as const;

export const BottomTabInset = Layout.bottomTabInset;
export const MaxContentWidth = Layout.maxContentWidth;

export const Shadows = {
  none: {} satisfies ViewStyle,
  sm: Platform.select<ViewStyle>({
    ios: {
      shadowColor: '#000000',
      shadowOpacity: 0.12,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
    },
    android: {
      elevation: 2,
    },
    default: {},
  }) as ViewStyle,
  md: Platform.select<ViewStyle>({
    ios: {
      shadowColor: '#000000',
      shadowOpacity: 0.16,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
    },
    android: {
      elevation: 4,
    },
    default: {},
  }) as ViewStyle,
  lg: Platform.select<ViewStyle>({
    ios: {
      shadowColor: '#000000',
      shadowOpacity: 0.2,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
    },
    android: {
      elevation: 8,
    },
    default: {},
  }) as ViewStyle,
} as const;

export function withAlpha(hexColor: string, alpha: number) {
  const safeAlpha = Math.max(0, Math.min(1, alpha));

  if (!hexColor.startsWith('#')) {
    return hexColor;
  }

  const hex = hexColor.replace('#', '');
  const normalized =
    hex.length === 3
      ? hex
          .split('')
          .map((char) => char + char)
          .join('')
      : hex;

  if (normalized.length !== 6) {
    return hexColor;
  }

  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${safeAlpha})`;
}