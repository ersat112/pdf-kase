// src/hooks/use-theme.ts
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
  type AppThemeName,
} from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export type UseThemeResult = {
  themeName: AppThemeName;
  isDark: boolean;
  colors: AppThemeColors;
  fonts: typeof Fonts;
  fontSizes: typeof FontSizes;
  fontWeights: typeof FontWeights;
  lineHeights: typeof LineHeights;
  typography: typeof Typography;
  spacing: typeof Spacing;
  radius: typeof Radius;
  layout: typeof Layout;
  shadows: typeof Shadows;
};

export function useTheme(): UseThemeResult {
  const scheme = useColorScheme();
  const themeName: AppThemeName = scheme === 'dark' ? 'dark' : 'light';

  return {
    themeName,
    isDark: themeName === 'dark',
    colors: Colors[themeName],
    fonts: Fonts,
    fontSizes: FontSizes,
    fontWeights: FontWeights,
    lineHeights: LineHeights,
    typography: Typography,
    spacing: Spacing,
    radius: Radius,
    layout: Layout,
    shadows: Shadows,
  };
}