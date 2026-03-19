// src/components/ads/AppBanner.tsx
import React, { useEffect, useState } from 'react';
import { Platform, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import {
    BannerAd,
    BannerAdSize,
    useForeground,
} from 'react-native-google-mobile-ads';

import {
    ADMOB_REQUEST_OPTIONS,
    ADMOB_UNIT_IDS,
    isAdMobBannerEnabled,
} from '../../modules/ads/admob.config';
import { admobService } from '../../modules/ads/admob.service';
import { useBillingStore } from '../../store/useBillingStore';

type Props = {
  style?: StyleProp<ViewStyle>;
};

export default function AppBanner({ style }: Props) {
  const isPro = useBillingStore((state) => state.isPro);
  const hydrated = useBillingStore((state) => state.hydrated);

  const [sdkReady, setSdkReady] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const unitId = ADMOB_UNIT_IDS.banner;
  const shouldRender = hydrated && !isPro && isAdMobBannerEnabled();

  useEffect(() => {
    let mounted = true;

    if (!shouldRender) {
      setSdkReady(false);
      return () => {
        mounted = false;
      };
    }

    void admobService
      .initialize()
      .then(() => {
        if (mounted) {
          setSdkReady(true);
        }
      })
      .catch((error) => {
        console.warn('[AdMob] Banner initialization failed:', error);

        if (mounted) {
          setSdkReady(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [shouldRender]);

  useForeground(() => {
    if (Platform.OS === 'ios' && sdkReady) {
      setReloadKey((current) => current + 1);
    }
  });

  if (!shouldRender || !sdkReady || !unitId) {
    return null;
  }

  return (
    <View style={[styles.container, style]} collapsable={false}>
      <BannerAd
        key={`${unitId}:${reloadKey}`}
        unitId={unitId}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={ADMOB_REQUEST_OPTIONS}
        onAdFailedToLoad={(error) => {
          console.warn('[AdMob] Banner failed to load:', error);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
});