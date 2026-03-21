// src/screens/auth/RegisterScreen.tsx
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

function RuleRow({
  label,
  success,
}: {
  label: string;
  success: boolean;
}) {
  return (
    <View style={styles.ruleRow}>
      <Ionicons
        name={success ? 'checkmark-circle' : 'ellipse-outline'}
        size={16}
        color={success ? colors.primary : colors.textTertiary}
      />
      <Text style={[styles.ruleItem, success && styles.ruleItemSuccess]}>
        {label}
      </Text>
    </View>
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
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [passwordConfirmVisible, setPasswordConfirmVisible] = useState(false);
  const [kvkkAccepted, setKvkkAccepted] = useState(false);
  const [permissionInfoAccepted, setPermissionInfoAccepted] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const passwordChecks = useMemo(() => getPasswordChecks(password), [password]);
  const passwordStrength = useMemo(() => getPasswordStrength(password), [password]);

  const passwordsMatch =
    password.length > 0 &&
    passwordConfirm.length > 0 &&
    password === passwordConfirm;

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

  const usesPreviewAuth = appRuntime.authProvider === 'preview_local';

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
      subtitle="Güçlü şifre, onay alanları ve gelişmiş giriş hazırlığı ile hesap oluştur."
      contentContainerStyle={styles.screenContent}
    >
      <View style={styles.container}>
        <View style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>PDF KAŞE</Text>
          <Text style={styles.heroTitle}>Hesabını güvenli oluştur</Text>
          <Text style={styles.heroSubtitle}>
            Şifre gücü, çift doğrulama, izin bilgilendirmeleri ve sonraki
            e-posta doğrulama akışı için ürün yüzeyi hazır.
          </Text>

          <View style={styles.heroPillRow}>
            <InfoPill label="Şifre kontrolü" tone="success" />
            <InfoPill label="KVKK onayı" tone="accent" />
            <InfoPill label={usesPreviewAuth ? 'Onizleme kayit' : 'Kayit hazir'} />
          </View>
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
            secureTextEntry={!passwordVisible}
            autoComplete="password"
            rightActionLabel={passwordVisible ? 'Gizle' : 'Göster'}
            onRightActionPress={() => setPasswordVisible((current) => !current)}
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
              <RuleRow
                label="En az 8 karakter"
                success={passwordChecks.minLength}
              />
              <RuleRow
                label="En az 1 büyük harf"
                success={passwordChecks.upper}
              />
              <RuleRow
                label="En az 1 küçük harf"
                success={passwordChecks.lower}
              />
              <RuleRow
                label="En az 1 rakam"
                success={passwordChecks.number}
              />
            </View>
          </View>

          <Field
            label="Şifre Tekrar"
            value={passwordConfirm}
            onChangeText={setPasswordConfirm}
            placeholder="Şifreni tekrar gir"
            secureTextEntry={!passwordConfirmVisible}
            autoComplete="password"
            rightActionLabel={passwordConfirmVisible ? 'Gizle' : 'Göster'}
            onRightActionPress={() =>
              setPasswordConfirmVisible((current) => !current)
            }
          />

          <View style={styles.matchCard}>
            <Text style={styles.matchTitle}>Şifre eşleşmesi</Text>
            <Text
              style={[
                styles.matchText,
                passwordsMatch && styles.matchTextSuccess,
              ]}
            >
              {passwordConfirm.length === 0
                ? 'Şifre tekrar alanı bekleniyor.'
                : passwordsMatch
                  ? 'Şifre alanları eşleşiyor.'
                  : 'Şifre alanları henüz aynı değil.'}
            </Text>
          </View>

          <View style={styles.inlineStatusCard}>
            <Text style={styles.inlineStatusTitle}>E-posta doğrulama yüzeyi hazır</Text>
            <Text style={styles.inlineStatusText}>
              Kayıt sonrası doğrulama kodu / link ekranı sonraki auth sprintinde
              gerçek sağlayıcı ile bağlanacak.
            </Text>
          </View>

          <View style={styles.noticeCard}>
            <Text style={styles.noticeTitle}>İzin bilgilendirmeleri</Text>
            <Text style={styles.noticeText}>
              Kamera: belge tarama, QR ve kimlik kartı akışları için kullanılır.
            </Text>
            <Text style={styles.noticeText}>
              Dosya erişimi: PDF ve görsel içe aktarma işlemleri için kullanılır.
            </Text>
            <Text style={styles.noticeText}>
              Bu ekran yalnızca bilgilendirme ve onay yüzeyini hazırlar.
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
            {submitting ? (
              <View style={styles.primaryButtonContent}>
                <ActivityIndicator size="small" color={colors.onPrimary} />
                <Text style={styles.primaryButtonText}>Kayıt oluşturuluyor...</Text>
              </View>
            ) : (
              <Text style={styles.primaryButtonText}>Kayıt ol</Text>
            )}
          </Pressable>

          <Pressable
            onPress={() => navigation.goBack()}
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && styles.pressed,
            ]}
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
  heroCard: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
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
    gap: 6,
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ruleItem: {
    ...Typography.bodySmall,
    color: colors.textTertiary,
  },
  ruleItemSuccess: {
    color: colors.primary,
  },
  matchCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    padding: Spacing.md,
    gap: 4,
  },
  matchTitle: {
    ...Typography.titleSmall,
    color: colors.text,
  },
  matchText: {
    ...Typography.bodySmall,
    color: colors.textSecondary,
  },
  matchTextSuccess: {
    color: colors.primary,
    fontWeight: '700',
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
    lineHeight: 18,
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
    lineHeight: 18,
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
    lineHeight: 22,
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
