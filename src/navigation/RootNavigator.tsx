import {
  createNativeStackNavigator,
  type NativeStackNavigationOptions,
} from '@react-navigation/native-stack';
import React, { useEffect, useRef } from 'react';

import { LoginScreen } from '../screens/auth/LoginScreen';
import { RegisterScreen } from '../screens/auth/RegisterScreen';
import { SplashGateScreen } from '../screens/auth/SplashGateScreen';
import { PricingScreen } from '../screens/billing/PricingScreen';
import { DocumentScreen as DocumentDetailScreen } from '../screens/documents/DocumentDetailScreen';
import { DocumentsScreen } from '../screens/documents/DocumentsScreen';
import { PdfEditorScreen } from '../screens/editor/PdfEditorScreen';
import { ScanEntryScreen } from '../screens/scan/ScanEntryScreen';
import { SignaturePadScreen } from '../screens/scan/SignaturePadScreen';
import { SmartEraseScreen } from '../screens/scan/SmartEraseScreen';
import { SettingsScreen } from '../screens/settings/SettingsScreen';
import { StampManagerScreen } from '../screens/stamps/StampManagerScreen';
import { useAuthStore } from '../store/useAuthStore';
import { useBillingStore } from '../store/useBillingStore';
import { colors } from '../theme';
import { AppTabs } from './AppTabs';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

const sharedScreenOptions: NativeStackNavigationOptions = {
  headerStyle: {
    backgroundColor: colors.card,
  },
  headerTintColor: colors.text,
  headerTitleStyle: {
    fontWeight: '800',
  },
  headerShadowVisible: false,
  contentStyle: {
    backgroundColor: colors.background,
  },
  animation: 'slide_from_right',
  statusBarStyle: 'light',
};

export function RootNavigator() {
  const hydrateAuth = useAuthStore((state) => state.hydrate);
  const hydrateBilling = useBillingStore((state) => state.hydrate);

  const hydrationStartedRef = useRef(false);

  useEffect(() => {
    if (hydrationStartedRef.current) {
      return;
    }

    hydrationStartedRef.current = true;

    void (async () => {
      try {
        await Promise.all([hydrateAuth(), hydrateBilling()]);
      } catch (error) {
        console.warn('[RootNavigator] Hydration failed:', error);
      }
    })();
  }, [hydrateAuth, hydrateBilling]);

  return (
    <Stack.Navigator initialRouteName="Home" screenOptions={sharedScreenOptions}>
      <Stack.Screen
        name="Home"
        component={AppTabs}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="ScanEntry"
        component={ScanEntryScreen}
        options={{
          headerShown: false,
          presentation: 'fullScreenModal',
          animation: 'fade_from_bottom',
        }}
      />
      <Stack.Screen
        name="Documents"
        component={DocumentsScreen}
        options={{ title: 'Dosyalar' }}
      />
      <Stack.Screen
        name="DocumentDetail"
        component={DocumentDetailScreen}
        options={{ title: 'Belge Detayı' }}
      />
      <Stack.Screen
        name="PdfEditor"
        component={PdfEditorScreen}
        options={{ title: 'PDF Editör' }}
      />
      <Stack.Screen
        name="SignaturePad"
        component={SignaturePadScreen}
        options={{ title: 'İmza' }}
      />
      <Stack.Screen
        name="SmartErase"
        component={SmartEraseScreen}
        options={{ title: 'Akıllı Silme' }}
      />
      <Stack.Screen
        name="StampManager"
        component={StampManagerScreen}
        options={{ title: 'Kaşe Yönetimi' }}
      />
      <Stack.Screen
        name="Pricing"
        component={PricingScreen}
        options={{ title: 'Premium' }}
      />
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: 'Ayarlar' }}
      />
      <Stack.Screen
        name="Login"
        component={LoginScreen}
        options={{
          title: 'Giriş Yap',
          animation: 'fade',
        }}
      />
      <Stack.Screen
        name="Register"
        component={RegisterScreen}
        options={{ title: 'Kayıt Ol' }}
      />
      <Stack.Screen
        name="SplashGate"
        component={SplashGateScreen}
        options={{
          headerShown: false,
          animation: 'fade',
        }}
      />
    </Stack.Navigator>
  );
}