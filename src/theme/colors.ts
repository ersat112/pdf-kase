import { DarkTheme, type Theme } from '@react-navigation/native';

import {
  Colors,
  Fonts,
  FontSizes,
  FontWeights,
  Layout,
  LineHeights,
  Radius,
  Shadows,
  Spacing,
  Typography,
  type AppThemeColors,
} from '../constants/theme';

export const colors = Colors.dark;

export type AppColors = AppThemeColors;

export const appNavigationTheme: Theme = {
  ...DarkTheme,
  dark: true,
  colors: {
    ...DarkTheme.colors,
    primary: colors.primary,
    background: colors.background,
    card: colors.card,
    text: colors.text,
    border: colors.border,
    notification: colors.primary,
  },
};

export const theme = {
  colors,
  fonts: Fonts,
  fontSizes: FontSizes,
  fontWeights: FontWeights,
  lineHeights: LineHeights,
  typography: Typography,
  spacing: Spacing,
  radius: Radius,
  layout: Layout,
  shadows: Shadows,
} as const;