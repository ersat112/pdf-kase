// src/screens/auth/RegisterScreen.tsx
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

type Props = NativeStackScreenProps<RootStackParamList, 'Register'>;

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

type ToggleRowProps = {
  checked: boolean;
  label: string;
  hint?: string;
  onPress: () => void;
};

function ToggleRow({ checked, label, hint, onPress }: ToggleRowProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.toggleRow,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
        {checked ? <Text style={styles.checkboxMark}>✓</Text> : null}
      </View>

      <View style={styles.toggleContent}>
        <Text style={styles.toggleLabel}>{label}</Text>
        {hint ? <Text style={styles.toggleHint}>{hint}</Text> : null}
      </View>
    </Pressable>
  );
}

function isValidEmail(value: string) {
  return /\S+@\S+\.\S+/.test(value.trim());
}

function getPasswordChecks(password: string) {
  return {
    minLength: password.length >= 8,
    lower: /[a-zçğıöşü]/.test(password),
    upper: /[A-ZÇĞİÖŞÜ]/.test(password),
    number: /\d/.test(password),
  };
}

function getPasswordStrength(password: string) {
  const checks = getPasswordChecks(password);
  const score = Object.values(checks).filter(Boolean).length;

  if (password.length === 0) {
    return {
      score: 0,
      label: 'Henüz girilmedi',
    };
  }

  if (score <= 1) {
    return {
      score,
      label: 'Zayıf',
    };
  }

  if (score <= 3) {
    return {
      score,
      label: 'Orta',
    };
  }

  return {
    score,
    label: 'Güçlü',
  };
}

export function RegisterScreen({ navigation }: Props) {
  const register = useAuthStore((state) => state.register);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [kvkkAccepted, setKvkkAccepted] = useState(false);
  const [permissionInfoAccepted, setPermissionInfoAccepted] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const passwordChecks = useMemo(() => getPasswordChecks(password), [password]);
  const passwordStrength = useMemo(() => getPasswordStrength(password), [password]);

  const isFormValid = useMemo(() => {
    return (
      name.trim().length >= 3 &&
      isValidEmail(email) &&
      passwordChecks.minLength &&
      passwordChecks.lower &&
      passwordChecks.upper &&
      passwordChecks.number &&
      password === passwordConfirm &&
      kvkkAccepted
    );
  }, [email, kvkkAccepted, name, password, passwordChecks, passwordConfirm]);

  const handleRegister = async () => {
    if (name.trim().length < 3) {
      Alert.alert('Eksik bilgi', 'Ad soyad en az 3 karakter olmalı.');
      return;
    }

    if (!isValidEmail(email)) {
      Alert.alert('Geçersiz e-posta', 'Lütfen geçerli bir e-posta adresi gir.');
      return;
    }

    if (!passwordChecks.minLength) {
      Alert.alert('Zayıf şifre', 'Şifre en az 8 karakter olmalı.');
      return;
    }

    if (!passwordChecks.lower || !passwordChecks.upper || !passwordChecks.number) {
      Alert.alert(
        'Zayıf şifre',
        'Şifre küçük harf, büyük harf ve rakam içermeli.',
      );
      return;
    }

    if (password !== passwordConfirm) {
      Alert.alert('Şifre uyuşmuyor', 'Şifre alanları aynı olmalı.');
      return;
    }

    if (!kvkkAccepted) {
      Alert.alert(
        'Onay gerekli',
        'Devam etmek için KVKK ve kullanım koşulları onayı gerekli.',
      );
      return;
    }

    try {
      setSubmitting(true);

      await register({
        name: name.trim(),
        email: email.trim(),
        password,
        passwordConfirm,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Kayıt sırasında hata oluştu.';
      Alert.alert('Kayıt başarısız', message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen
      title="Kayıt ol"
      subtitle="Gelişmiş hesap oluşturma akışı. E-posta doğrulama ve izin akışları için UI hazır."
      contentContainerStyle={styles.screenContent}
    >
      <View style={styles.container}>
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Hesabını güvenli oluştur</Text>
          <Text style={styles.infoText}>
            Şifre gücü, çift şifre kontrolü, KVKK onayı, kamera / dosya izin
            bilgilendirmeleri ve e-posta doğrulama durumu aynı akışta hazır.
          </Text>
        </View>

        <View style={styles.formCard}>
          <Field
            label="Ad Soyad"
            value={name}
            onChangeText={setName}
            placeholder="Adın ve soyadın"
            autoCapitalize="words"
            autoComplete="name"
          />

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
            placeholder="Güçlü bir şifre oluştur"
            secureTextEntry
            autoComplete="password"
          />

          <View style={styles.passwordMetaCard}>
            <View style={styles.passwordStrengthRow}>
              <Text style={styles.passwordStrengthLabel}>Şifre gücü</Text>
              <Text style={styles.passwordStrengthValue}>
                {passwordStrength.label}
              </Text>
            </View>

            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${Math.max(passwordStrength.score, 1) * 25}%`,
                    opacity: password.length === 0 ? 0.18 : 1,
                  },
                ]}
              />
            </View>

            <View style={styles.ruleList}>
              <Text
                style={[
                  styles.ruleItem,
                  passwordChecks.minLength && styles.ruleItemSuccess,
                ]}
              >
                • En az 8 karakter
              </Text>
              <Text
                style={[
                  styles.ruleItem,
                  passwordChecks.upper && styles.ruleItemSuccess,
                ]}
              >
                • En az 1 büyük harf
              </Text>
              <Text
                style={[
                  styles.ruleItem,
                  passwordChecks.lower && styles.ruleItemSuccess,
                ]}
              >
                • En az 1 küçük harf
              </Text>
              <Text
                style={[
                  styles.ruleItem,
                  passwordChecks.number && styles.ruleItemSuccess,
                ]}
              >
                • En az 1 rakam
              </Text>
            </View>
          </View>

          <Field
            label="Şifre Tekrar"
            value={passwordConfirm}
            onChangeText={setPasswordConfirm}
            placeholder="Şifreni tekrar gir"
            secureTextEntry
            autoComplete="password"
          />

          <View style={styles.inlineStatusCard}>
            <Text style={styles.inlineStatusTitle}>E-posta doğrulama UI hazır</Text>
            <Text style={styles.inlineStatusText}>
              Kayıt sonrası doğrulama kodu / link ekranı sonraki auth sprintinde bağlanacak.
            </Text>
          </View>

          <View style={styles.noticeCard}>
            <Text style={styles.noticeTitle}>İzin bilgilendirmeleri</Text>
            <Text style={styles.noticeText}>
              Kamera: belge tarama ve kimlik kartı akışları için kullanılır.
            </Text>
            <Text style={styles.noticeText}>
              Dosya erişimi: PDF ve görsel içe aktarma işlemleri için kullanılır.
            </Text>
          </View>

          <ToggleRow
            checked={kvkkAccepted}
            onPress={() => setKvkkAccepted((value) => !value)}
            label="KVKK ve kullanım koşullarını okudum, kabul ediyorum"
            hint="Yasal onay alanı hazır"
          />

          <ToggleRow
            checked={permissionInfoAccepted}
            onPress={() => setPermissionInfoAccepted((value) => !value)}
            label="Kamera ve dosya izin bilgilendirmelerini gördüm"
            hint="Bilgilendirme onayı"
          />

          <Pressable
            onPress={handleRegister}
            disabled={submitting || !isFormValid}
            style={({ pressed }) => [
              styles.primaryButton,
              (submitting || !isFormValid) && styles.primaryButtonDisabled,
              pressed && !submitting && isFormValid && styles.pressed,
            ]}
          >
            <Text style={styles.primaryButtonText}>
              {submitting ? 'Kayıt oluşturuluyor...' : 'Kayıt ol'}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => navigation.goBack()}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
          >
            <Text style={styles.secondaryButtonText}>Zaten hesabım var</Text>
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
  infoCard: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: Spacing.xl,
    gap: Spacing.sm,
    ...Shadows.sm,
  },
  infoTitle: {
    ...Typography.titleLarge,
    color: colors.text,
  },
  infoText: {
    ...Typography.body,
    color: colors.textSecondary,
  },
  formCard: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
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
  passwordMetaCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  passwordStrengthRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  passwordStrengthLabel: {
    ...Typography.bodySmall,
    color: colors.textSecondary,
  },
  passwordStrengthValue: {
    ...Typography.bodySmall,
    color: colors.primary,
    fontWeight: '800',
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  ruleList: {
    gap: 4,
  },
  ruleItem: {
    ...Typography.bodySmall,
    color: colors.textTertiary,
  },
  ruleItemSuccess: {
    color: colors.primary,
  },
  inlineStatusCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    padding: Spacing.md,
    gap: 4,
  },
  inlineStatusTitle: {
    ...Typography.titleSmall,
    color: colors.text,
  },
  inlineStatusText: {
    ...Typography.bodySmall,
    color: colors.textSecondary,
  },
  noticeCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    padding: Spacing.md,
    gap: 6,
  },
  noticeTitle: {
    ...Typography.titleSmall,
    color: colors.text,
  },
  noticeText: {
    ...Typography.bodySmall,
    color: colors.textSecondary,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    paddingVertical: 4,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkboxMark: {
    color: colors.onPrimary,
    fontWeight: '800',
    fontSize: 13,
  },
  toggleContent: {
    flex: 1,
    gap: 2,
  },
  toggleLabel: {
    ...Typography.body,
    color: colors.text,
  },
  toggleHint: {
    ...Typography.bodySmall,
    color: colors.textSecondary,
  },
  primaryButton: {
    minHeight: 54,
    borderRadius: Radius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.xs,
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