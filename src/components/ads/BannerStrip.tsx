// src/components/ads/BannerStrip.tsx
import React from 'react';
import { StyleSheet } from 'react-native';

import AppBanner from './AppBanner';

type Props = {
  hidden?: boolean;
};

export function BannerStrip({ hidden = false }: Props) {
  if (hidden) {
    return null;
  }

  return <AppBanner style={styles.container} />;
}

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});