// src/screens/auth/LoginScreen.tsx
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Screen } from '../../components/common/Screen';
import { appRuntime } from '../../config/runtime';
import type { RootStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../store/useAuthStore';
import { Radius, Shadows, Spacing, Typography, colors } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  keyboardType?:
    | 'default'
    | 'email-address'
    | 'numeric'
    | 'phone-pad'
    | 'number-pad';
  autoComplete?:
    | 'off'
    | 'email'
    | 'password'
    | 'username'
    | 'name'
    | 'one-time-code';
  rightActionLabel?: string;
  onRightActionPress?: () => void;
};

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  autoCapitalize = 'none',
  keyboardType = 'default',
  autoComplete,
  rightActionLabel,
  onRightActionPress,
}: FieldProps) {
  return (
    <View style={styles.field}>
      <View style={styles.fieldHeaderRow}>
        <Text style={styles.label}>{label}</Text>

        {rightActionLabel && onRightActionPress ? (
          <Pressable
            onPress={onRightActionPress}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <Text style={styles.fieldActionText}>{rightActionLabel}</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.inputWrap}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry}
          autoCapitalize={autoCapitalize}
          keyboardType={keyboardType}
          autoComplete={autoComplete}
          autoCorrect={false}
          placeholder={placeholder}
          placeholderTextColor={colors.textTertiary}
          style={styles.input}
        />
      </View>
    </View>
  );
}

type SocialButtonProps = {
  label: string;
  hint: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
};

function SocialButton({ label, hint, icon, onPress }: SocialButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.socialButton,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.socialIconWrap}>
        <Ionicons name={icon} size={18} color={colors.primary} />
      </View>

      <View style={styles.socialContent}>
        <Text style={styles.socialLabel}>{label}</Text>
        <Text style={styles.socialHint}>{hint}</Text>
      </View>

      <Ionicons
        name="chevron-forward"
        size={18}
        color={colors.textTertiary}
      />
    </Pressable>
  );
}

function InfoPill({
  label,
  tone = 'default',
}: {
  label: string;
  tone?: 'default' | 'accent' | 'success';
}) {
  return (
    <View
      style={[
        styles.infoPill,
        tone === 'accent' && styles.infoPillAccent,
        tone === 'success' && styles.infoPillSuccess,
      ]}
    >
      <Text
        style={[
          styles.infoPillText,
          tone === 'accent' && styles.infoPillTextAccent,
          tone === 'success' && styles.infoPillTextSuccess,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

function isValidEmail(value: string) {
  return /\S+@\S+\.\S+/.test(value.trim());
}

export function LoginScreen({ navigation }: Props) {
  const login = useAuthStore((state) => state.login);
  const usesPreviewAuth = appRuntime.authProvider === 'preview_local';
  const buildLabel =
    appRuntime.stage === 'preview' ? 'Onizleme build' : 'Production build';
  const defaultEmail = usesPreviewAuth ? 'demo@pdfkase.com' : '';
  const defaultPassword = usesPreviewAuth ? '123456' : '';

  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState(defaultPassword);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const isFormValid = useMemo(() => {
    return isValidEmail(email) && password.trim().length >= 6;
  }, [email, password]);

  const handleUseDemoAccount = () => {
    setEmail('demo@pdfkase.com');
    setPassword('123456');
  };

  const handleLogin = async () => {
    if (!isValidEmail(email)) {
      Alert.alert('Geçersiz e-posta', 'Lütfen geçerli bir e-posta adresi gir.');
      return;
    }

    if (password.trim().length < 6) {
      Alert.alert('Geçersiz şifre', 'Şifre en az 6 karakter olmalı.');
      return;
    }

    try {
      setSubmitting(true);

      await login({
        email: email.trim(),
        password,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Giriş yapılırken hata oluştu.';
      Alert.alert('Giriş başarısız', message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSocialPress = (providerLabel: string) => {
    Alert.alert(
      'Hazır arayüz',
      `${providerLabel} giriş yüzeyi hazır. Gerçek sağlayıcı bağlantısı sonraki auth sprintinde bağlanacak.`,
    );
  };

  return (
    <Screen
      title="Giriş yap"
      subtitle="Belgelerine, kaşelerine ve cihaz içi çalışma alanına güvenle eriş."
      contentContainerStyle={styles.screenContent}
    >
      <View style={styles.container}>
        <View style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>PDF KAŞE</Text>
          <Text style={styles.heroTitle}>Belgelerine hızlı ve güvenli dön</Text>
          <Text style={styles.heroSubtitle}>
            Tarama, düzenleme, kaşe ve export akışların cihazında kalır.
            {usesPreviewAuth
              ? ' Onizleme oturumu ile hizli giris yapabiliriz.'
              : ' Hesabinla guvenli sekilde devam et.'}
          </Text>

          <View style={styles.heroPillRow}>
            <InfoPill label="Local-first" tone="success" />
            <InfoPill
              label={usesPreviewAuth ? 'Onizleme auth' : 'Auth hazir'}
              tone="accent"
            />
            <InfoPill label={buildLabel} />
          </View>
        </View>

        {usesPreviewAuth ? (
          <View style={styles.quickAccessCard}>
            <View style={styles.quickAccessTextWrap}>
              <Text style={styles.quickAccessTitle}>Onizleme hesap hazir</Text>
              <Text style={styles.quickAccessText}>
                Hizli giris icin hazir oturum bilgilerini tek dokunusla doldur.
              </Text>
            </View>

            <View style={styles.demoCredentialCard}>
              <Text style={styles.demoCredentialLabel}>E-posta</Text>
              <Text style={styles.demoCredentialValue}>demo@pdfkase.com</Text>
              <Text style={styles.demoCredentialLabel}>Şifre</Text>
              <Text style={styles.demoCredentialValue}>123456</Text>
            </View>

            <Pressable
              onPress={handleUseDemoAccount}
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.secondaryButtonText}>Onizleme hesabi doldur</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.socialSection}>
          <SocialButton
            label="Apple ile devam et"
            hint="iOS oturum akışı için hazır yüzey"
            icon="logo-apple"
            onPress={() => handleSocialPress('Apple')}
          />
          <SocialButton
            label="Google ile devam et"
            hint="Google oturum akışı için hazır yüzey"
            icon="logo-google"
            onPress={() => handleSocialPress('Google')}
          />
          <SocialButton
            label="GitHub ile devam et"
            hint="Developer odaklı giriş akışı"
            icon="logo-github"
            onPress={() => handleSocialPress('GitHub')}
          />
          <SocialButton
            label="Daha fazla seçenek"
            hint="Kurumsal ve doğrulamalı sağlayıcılar"
            icon="apps-outline"
            onPress={() => handleSocialPress('Ek sağlayıcı')}
          />
        </View>

        <View style={styles.dividerRow}>
          <View style={styles.divider} />
          <Text style={styles.dividerText}>veya e-posta ile</Text>
          <View style={styles.divider} />
        </View>

        <View style={styles.formCard}>
          <Field
            label="E-posta"
            value={email}
            onChangeText={setEmail}
            placeholder="ornek@pdfkase.com"
            keyboardType="email-address"
            autoComplete="email"
          />

          <Field
            label="Şifre"
            value={password}
            onChangeText={setPassword}
            placeholder="Şifreni gir"
            secureTextEntry={!passwordVisible}
            autoComplete="password"
            rightActionLabel={passwordVisible ? 'Gizle' : 'Göster'}
            onRightActionPress={() => setPasswordVisible((current) => !current)}
          />

          <View style={styles.helperRow}>
            <Text style={styles.helperText}>
              {usesPreviewAuth
                ? 'Onizleme hesapla hizli test yapabilir veya kayit ekranindan yeni bir hesap olusturabilirsin.'
                : 'E-posta ile giris yapabilir veya kayit ekranindan yeni hesap olusturabilirsin.'}
            </Text>

            <Pressable
              onPress={() =>
                Alert.alert(
                  'Hazır arayüz',
                  'Şifre sıfırlama ekranı sonraki auth sprintinde bağlanacak.',
                )
              }
              style={({ pressed }) => pressed && styles.pressed}
            >
              <Text style={styles.helperLink}>Şifremi unuttum</Text>
            </Pressable>
          </View>

          <Pressable
            onPress={handleLogin}
            disabled={submitting || !isFormValid}
            style={({ pressed }) => [
              styles.primaryButton,
              (submitting || !isFormValid) && styles.primaryButtonDisabled,
              pressed && !submitting && isFormValid && styles.pressed,
            ]}
          >
            {submitting ? (
              <View style={styles.primaryButtonContent}>
                <ActivityIndicator size="small" color={colors.onPrimary} />
                <Text style={styles.primaryButtonText}>Giriş yapılıyor...</Text>
              </View>
            ) : (
              <Text style={styles.primaryButtonText}>Giriş yap</Text>
            )}
          </Pressable>

          <Pressable
            onPress={() => navigation.navigate('Register')}
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.secondaryButtonText}>Yeni hesap oluştur</Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    paddingBottom: 120,
  },
  container: {
    gap: Spacing.lg,
  },
  heroCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    gap: Spacing.sm,
    ...Shadows.sm,
  },
  heroEyebrow: {
    ...Typography.caption,
    color: colors.primary,
    letterSpacing: 1.1,
  },
  heroTitle: {
    ...Typography.display,
    color: colors.text,
    fontSize: 26,
    lineHeight: 32,
  },
  heroSubtitle: {
    ...Typography.body,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  heroPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  infoPill: {
    minHeight: 30,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  infoPillAccent: {
    borderColor: 'rgba(59, 130, 246, 0.28)',
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
  },
  infoPillSuccess: {
    borderColor: 'rgba(53, 199, 111, 0.28)',
    backgroundColor: 'rgba(53, 199, 111, 0.12)',
  },
  infoPillText: {
    ...Typography.caption,
    color: colors.textSecondary,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  infoPillTextAccent: {
    color: '#60A5FA',
  },
  infoPillTextSuccess: {
    color: colors.primary,
  },
  quickAccessCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    gap: Spacing.md,
    ...Shadows.sm,
  },
  quickAccessTextWrap: {
    gap: 4,
  },
  quickAccessTitle: {
    ...Typography.titleLarge,
    color: colors.text,
  },
  quickAccessText: {
    ...Typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  demoCredentialCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    padding: Spacing.md,
    gap: 4,
  },
  demoCredentialLabel: {
    ...Typography.caption,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    fontWeight: '800',
  },
  demoCredentialValue: {
    ...Typography.body,
    color: colors.text,
    fontWeight: '700',
    marginBottom: 4,
  },
  socialSection: {
    gap: Spacing.sm,
  },
  socialButton: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    ...Shadows.sm,
  },
  socialIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  socialContent: {
    flex: 1,
    gap: 2,
  },
  socialLabel: {
    ...Typography.titleSmall,
    color: colors.text,
  },
  socialHint: {
    ...Typography.bodySmall,
    color: colors.textSecondary,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    ...Typography.bodySmall,
    color: colors.textTertiary,
  },
  formCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    gap: Spacing.md,
    ...Shadows.sm,
  },
  field: {
    gap: Spacing.sm,
  },
  fieldHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  label: {
    ...Typography.labelLarge,
    color: colors.text,
  },
  fieldActionText: {
    ...Typography.bodySmall,
    color: colors.primary,
    fontWeight: '700',
  },
  inputWrap: {
    minHeight: 54,
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: Radius.lg,
    justifyContent: 'center',
  },
  input: {
    minHeight: 54,
    paddingHorizontal: Spacing.md,
    color: colors.text,
    ...Typography.body,
  },
  helperRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.md,
  },
  helperText: {
    flex: 1,
    ...Typography.bodySmall,
    color: colors.textTertiary,
    lineHeight: 18,
  },
  helperLink: {
    ...Typography.bodySmall,
    color: colors.primary,
    fontWeight: '700',
  },
  primaryButton: {
    minHeight: 54,
    borderRadius: Radius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  primaryButtonDisabled: {
    backgroundColor: colors.primaryMuted,
    opacity: 0.65,
  },
  primaryButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  primaryButtonText: {
    color: colors.onPrimary,
    fontWeight: '800',
    fontSize: 15,
  },
  secondaryButton: {
    minHeight: 52,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  secondaryButtonText: {
    ...Typography.body,
    color: colors.text,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.92,
  },
});
