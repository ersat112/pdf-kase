// App.tsx
import 'react-native-gesture-handler';

import { NavigationContainer } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { initializeDatabase } from './src/db/sqlite';
import { ensureAppDirectories } from './src/modules/storage/file.service';
import { RootNavigator } from './src/navigation/RootNavigator';
import {
  Radius,
  Spacing,
  Typography,
  appNavigationTheme,
  colors,
} from './src/theme';

type BootState = {
  ready: boolean;
  error: string | null;
};

async function bootstrapApplication(): Promise<void> {
  await Promise.all([initializeDatabase(), ensureAppDirectories()]);
}

export default function App() {
  const [bootState, setBootState] = useState<BootState>({
    ready: false,
    error: null,
  });
  const [bootAttempt, setBootAttempt] = useState(0);

  const retryBootstrap = useCallback(() => {
    setBootState({
      ready: false,
      error: null,
    });
    setBootAttempt((current) => current + 1);
  }, []);

  useEffect(() => {
    let active = true;

    const run = async () => {
      try {
        await bootstrapApplication();

        if (!active) {
          return;
        }

        setBootState({
          ready: true,
          error: null,
        });
      } catch (error) {
        if (!active) {
          return;
        }

        const message =
          error instanceof Error
            ? error.message
            : 'Uygulama başlatılırken beklenmeyen bir hata oluştu.';

        setBootState({
          ready: false,
          error: message,
        });
      }
    };

    void run();

    return () => {
      active = false;
    };
  }, [bootAttempt]);

  if (bootState.error) {
    return (
      <GestureHandlerRootView style={styles.root}>
        <SafeAreaProvider>
          <View style={styles.centered}>
            <StatusBar barStyle="light-content" backgroundColor={colors.background} />
            <View style={styles.stateCard}>
              <Text style={styles.errorTitle}>Başlatma hatası</Text>
              <Text style={styles.errorText}>{bootState.error}</Text>

              <Pressable
                onPress={retryBootstrap}
                style={({ pressed }) => [
                  styles.retryButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.retryButtonText}>Tekrar dene</Text>
              </Pressable>
            </View>
          </View>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  if (!bootState.ready) {
    return (
      <GestureHandlerRootView style={styles.root}>
        <SafeAreaProvider>
          <View style={styles.centered}>
            <StatusBar barStyle="light-content" backgroundColor={colors.background} />
            <View style={styles.stateCard}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingTitle}>PDF Kaşe hazırlanıyor...</Text>
              <Text style={styles.loadingText}>
                Veritabanı ve yerel dosya alanları başlatılıyor.
              </Text>
            </View>
          </View>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StatusBar barStyle="light-content" backgroundColor={colors.background} />
        <NavigationContainer theme={appNavigationTheme}>
          <RootNavigator />
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing['2xl'],
  },
  stateCard: {
    width: '100%',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: Radius.xl,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing['2xl'],
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  errorTitle: {
    ...Typography.headline,
    color: colors.text,
    fontSize: 22,
    lineHeight: 28,
    marginBottom: Spacing.xs,
    textAlign: 'center',
  },
  errorText: {
    ...Typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  loadingTitle: {
    ...Typography.titleSmall,
    color: colors.text,
    textAlign: 'center',
  },
  loadingText: {
    ...Typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: Spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  retryButtonText: {
    ...Typography.button,
    color: colors.primaryForeground,
    fontSize: 15,
    lineHeight: 20,
  },
  pressed: {
    opacity: 0.92,
  },
});