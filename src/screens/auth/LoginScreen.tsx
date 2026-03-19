// src/screens/auth/LoginScreen.tsx
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useMemo, useState } from 'react';
import {
    Alert,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';

import { Screen } from '../../components/common/Screen';
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
}: FieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>

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
  );
}

type SocialButtonProps = {
  label: string;
  hint: string;
  onPress: () => void;
};

function SocialButton({ label, hint, onPress }: SocialButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.socialButton,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.socialContent}>
        <Text style={styles.socialLabel}>{label}</Text>
        <Text style={styles.socialHint}>{hint}</Text>
      </View>

      <Text style={styles.socialArrow}>›</Text>
    </Pressable>
  );
}

function isValidEmail(value: string) {
  return /\S+@\S+\.\S+/.test(value.trim());
}

export function LoginScreen({ navigation }: Props) {
  const login = useAuthStore((state) => state.login);

  const [email, setEmail] = useState('demo@pdfkase.com');
  const [password, setPassword] = useState('123456');
  const [submitting, setSubmitting] = useState(false);

  const isFormValid = useMemo(() => {
    return isValidEmail(email) && password.trim().length >= 6;
  }, [email, password]);

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
      'Hazır UI',
      `${providerLabel} akışı için arayüz hazır. Gerçek provider bağlantısı sonraki sprintte bağlanacak.`,
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
          <Text style={styles.heroTitle}>Hızlı giriş seçenekleri</Text>
          <Text style={styles.heroSubtitle}>
            Apple, Google, GitHub ve klasik e-posta oturumu için modern giriş akışı.
          </Text>
        </View>

        <View style={styles.socialSection}>
          <SocialButton
            label="Apple ile devam et"
            hint="iOS oturum akışı için hazır"
            onPress={() => handleSocialPress('Apple')}
          />
          <SocialButton
            label="Google ile devam et"
            hint="Google oturum akışı için hazır"
            onPress={() => handleSocialPress('Google')}
          />
          <SocialButton
            label="GitHub ile devam et"
            hint="Developer odaklı giriş akışı"
            onPress={() => handleSocialPress('GitHub')}
          />
          <SocialButton
            label="Daha fazla seçenek"
            hint="Kurumsal / e-posta doğrulamalı akış"
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
            secureTextEntry
            autoComplete="password"
          />

          <View style={styles.helperRow}>
            <Text style={styles.helperText}>Demo hesap hazır: demo@pdfkase.com</Text>
            <Pressable
              onPress={() =>
                Alert.alert(
                  'Hazır UI',
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
            <Text style={styles.primaryButtonText}>
              {submitting ? 'Giriş yapılıyor...' : 'Giriş yap'}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => navigation.navigate('Register')}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
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
    justifyContent: 'space-between',
    ...Shadows.sm,
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
  socialArrow: {
    color: colors.textTertiary,
    fontSize: 24,
    fontWeight: '700',
    marginLeft: Spacing.md,
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
  label: {
    ...Typography.labelLarge,
    color: colors.text,
  },
  input: {
    minHeight: 54,
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: Radius.lg,
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