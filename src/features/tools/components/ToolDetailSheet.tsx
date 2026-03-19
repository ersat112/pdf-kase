import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  Radius,
  Spacing,
  Typography,
  colors,
} from '../../../theme';
import type { ToolDefinition } from '../tools.types';

function Badge({ label }: { label: string }) {
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{label}</Text>
    </View>
  );
}

function AvailabilityPanel({ tool }: { tool: ToolDefinition }) {
  const title =
    tool.availability === 'ready'
      ? 'Bu araç hazır'
      : tool.availability === 'shell'
        ? 'Bu araç shell aşamasında'
        : 'Bu araç planlandı';

  const text =
    tool.availability === 'ready'
      ? 'Ekran ve yönlendirme aktif. Mevcut ürün akışına bağlandı.'
      : tool.availability === 'shell'
        ? 'Bilgi mimarisi, içerik ve aksiyon kabuğu hazır. Servis bağlantısı ekleniyor.'
        : 'Araç ürün planına işlendi. Route ve servis entegrasyonu sonraki sprintte açılacak.';

  return (
    <View style={styles.statusCard}>
      <Text style={styles.statusTitle}>{title}</Text>
      <Text style={styles.statusText}>{text}</Text>
    </View>
  );
}

export function ToolDetailSheet({
  visible,
  tool,
  onClose,
  onPrimaryAction,
}: {
  visible: boolean;
  tool: ToolDefinition | null;
  onClose: () => void;
  onPrimaryAction: (tool: ToolDefinition) => void;
}) {
  return (
    <Modal
      visible={visible && Boolean(tool)}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropDismissArea} onPress={onClose} />

        <SafeAreaView style={styles.sheet} edges={['bottom']}>
          <View style={styles.handle} />

          {tool ? (
            <>
              <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.header}>
                  <Text style={styles.eyebrow}>ARAÇ DETAYI</Text>
                  <Text style={styles.title}>{tool.title}</Text>
                  <Text style={styles.subtitle}>{tool.shortDescription}</Text>
                </View>

                <AvailabilityPanel tool={tool} />

                <View style={styles.card}>
                  <Text style={styles.cardTitle}>İçerik</Text>
                  <Text style={styles.cardText}>{tool.longDescription}</Text>
                </View>

                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Etiketler</Text>
                  <View style={styles.badgeRow}>
                    {tool.badges.map((badge) => (
                      <Badge key={badge} label={badge} />
                    ))}
                  </View>
                </View>

                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Aksiyon</Text>
                  <Text style={styles.cardText}>
                    Bu modül artık sadece liste başlığı değil; ürün içinde durum bilgisi,
                    açıklama, aksiyon ve yönlendirme davranışı olan bir araç tanımıdır.
                  </Text>
                </View>
              </ScrollView>

              <View style={styles.footer}>
                <Pressable
                  onPress={onClose}
                  style={({ pressed }) => [
                    styles.secondaryButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.secondaryButtonText}>Kapat</Text>
                </Pressable>

                <Pressable
                  onPress={() => onPrimaryAction(tool)}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.primaryButtonText}>{tool.primaryActionLabel}</Text>
                </Pressable>
              </View>
            </>
          ) : null}
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  backdropDismissArea: {
    flex: 1,
  },
  sheet: {
    maxHeight: '92%',
    backgroundColor: colors.background,
    borderTopLeftRadius: Radius['2xl'],
    borderTopRightRadius: Radius['2xl'],
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  handle: {
    alignSelf: 'center',
    width: 52,
    height: 5,
    borderRadius: Radius.full,
    backgroundColor: colors.borderStrong,
    marginTop: 10,
    marginBottom: 6,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xl,
    gap: Spacing.md,
  },
  header: {
    gap: 6,
  },
  eyebrow: {
    ...Typography.caption,
    color: colors.primary,
    letterSpacing: 1.1,
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
  },
  statusCard: {
    backgroundColor: colors.card,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: Spacing.lg,
    gap: 6,
  },
  statusTitle: {
    ...Typography.titleSmall,
    color: colors.text,
  },
  statusText: {
    ...Typography.bodySmall,
    color: colors.textSecondary,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  cardTitle: {
    ...Typography.titleSmall,
    color: colors.text,
  },
  cardText: {
    ...Typography.body,
    color: colors.textSecondary,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  badge: {
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeText: {
    ...Typography.caption,
    color: colors.textSecondary,
  },
  footer: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  secondaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
  },
  secondaryButtonText: {
    ...Typography.labelLarge,
    color: colors.text,
  },
  primaryButton: {
    flex: 1.2,
    minHeight: 48,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
  },
  primaryButtonText: {
    ...Typography.labelLarge,
    color: colors.onPrimary,
  },
  pressed: {
    opacity: 0.92,
  },
});