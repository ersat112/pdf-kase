import React, { PropsWithChildren, useMemo } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Layout, MaxContentWidth, Spacing, Typography, colors } from '../../theme';

type ScreenProps = PropsWithChildren<{
  title: string;
  subtitle?: string;
  contentContainerStyle?: StyleProp<ViewStyle>;
  scrollEnabled?: boolean;
}>;

export function Screen({
  title,
  subtitle,
  children,
  contentContainerStyle,
  scrollEnabled = true,
}: ScreenProps) {
  const insets = useSafeAreaInsets();

  const resolvedContentContainerStyle = useMemo(
    () => [
      styles.contentContainer,
      {
        paddingTop: Layout.screenVerticalPadding + Math.max(insets.top, 0),
        paddingBottom:
          Spacing['3xl'] +
          Math.max(insets.bottom, Platform.OS === 'android' ? 16 : 0),
      },
      !scrollEnabled && styles.contentContainerStatic,
      contentContainerStyle,
    ],
    [contentContainerStyle, insets.bottom, insets.top, scrollEnabled],
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <ScrollView
          style={styles.scroll}
          scrollEnabled={scrollEnabled}
          contentContainerStyle={resolvedContentContainerStyle}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="automatic"
        >
          <View style={styles.inner}>
            <View style={styles.header}>
              <Text style={styles.title}>{title}</Text>
              {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            </View>

            {children}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboard: {
    flex: 1,
  },
  scroll: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentContainer: {
    paddingHorizontal: Layout.screenHorizontalPadding,
  },
  contentContainerStatic: {
    flexGrow: 1,
  },
  inner: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  header: {
    marginBottom: Spacing.xl,
  },
  title: {
    ...Typography.display,
    color: colors.text,
    fontSize: 28,
    lineHeight: 34,
  },
  subtitle: {
    ...Typography.body,
    color: colors.textSecondary,
    marginTop: Spacing.sm,
  },
});