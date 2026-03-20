import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { BannerStrip } from '../../components/ads/BannerStrip';
import { LocalTrustBadge } from '../../components/trust/LocalTrustBadge';
import { executeToolPrimaryAction } from '../../features/tools/tools.actions';
import {
  findToolByKey,
  homePrimaryActionKeys,
  homeSecondaryToolKeys,
} from '../../features/tools/tools.registry';
import { useAdGate } from '../../hooks/useAdGate';
import { resolveBillingCapabilities } from '../../modules/billing/billing-capabilities';
import {
  buildDocumentHomeOverview,
  resolveDocumentPageCount,
  resolveDocumentStatusLabel,
  resolveDocumentThumbnailPath,
  resolveDocumentTitle,
  resolveDocumentUpdatedAt,
  type DocumentSurfaceItem,
} from '../../modules/documents/document-presentation';
import { documentService } from '../../modules/documents/document.service';
import type { AppTabScreenProps } from '../../navigation/types';
import { useBillingStore } from '../../store/useBillingStore';
import {
  Layout,
  Radius,
  Shadows,
  Spacing,
  Typography,
  colors,
} from '../../theme';

type Props = AppTabScreenProps<'HomeTab'>;

type HomeDocument = DocumentSurfaceItem;

type DocumentServiceShape = typeof documentService & {
  getLatestDocument?: () => Promise<HomeDocument | null>;
  listDocuments?: (limit?: number) => Promise<HomeDocument[]>;
  getDocuments?: (limit?: number) => Promise<HomeDocument[]>;
  getRecentDocuments?: (limit?: number) => Promise<HomeDocument[]>;
};

type HomeActionConfig = {
  toolKey: string;
  title: string;
  subtitle: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
};

const PRIMARY_ACTIONS: HomeActionConfig[] = [
  {
    toolKey: 'scan-camera',
    title: 'Tara',
    subtitle: 'Kamera ile belge tara',
    icon: 'scan-outline',
  },
  {
    toolKey: 'import-files',
    title: 'PDF İçe Aktar',
    subtitle: 'PDF ve dosya al',
    icon: 'document-attach-outline',
  },
  {
    toolKey: 'import-images',
    title: 'Galeriden Al',
    subtitle: 'Görselleri belge yap',
    icon: 'images-outline',
  },
  {
    toolKey: 'edit-stamp',
    title: 'Kaşe & İmza',
    subtitle: 'Kütüphane ve yönetim',
    icon: 'color-wand-outline',
  },
];

const SECONDARY_ACTIONS: HomeActionConfig[] = [
  {
    toolKey: 'scan-ocr-text',
    title: 'OCR',
    subtitle: 'Metni çıkar',
    icon: 'document-text-outline',
  },
  {
    toolKey: 'scan-translate',
    title: 'Çeviri',
    subtitle: 'Türkçeye çevir',
    icon: 'language-outline',
  },
  {
    toolKey: 'edit-smart-erase',
    title: 'Akıllı Sil',
    subtitle: 'İzleri temizle',
    icon: 'sparkles-outline',
  },
  {
    toolKey: 'convert-word',
    title: 'Word',
    subtitle: 'DOCX çıktısı',
    icon: 'reader-outline',
  },
  {
    toolKey: 'convert-excel',
    title: 'Excel',
    subtitle: 'XLS çıktısı',
    icon: 'grid-outline',
  },
  {
    toolKey: 'utility-tools-hub',
    title: 'Tüm Araçlar',
    subtitle: 'Araç merkezini aç',
    icon: 'apps-outline',
  },
];

function formatDocumentDate(value: string | null) {
  if (!value) {
    return 'Tarih yok';
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return 'Tarih yok';
  }

  try {
    return new Intl.DateTimeFormat('tr-TR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(parsed);
  } catch {
    return parsed.toLocaleString();
  }
}

async function resolveDocuments(service: DocumentServiceShape) {
  if (typeof service.getRecentDocuments === 'function') {
    const list = await service.getRecentDocuments(12);

    if (Array.isArray(list)) {
      return list;
    }
  }

  if (typeof service.listDocuments === 'function') {
    const list = await service.listDocuments(12);

    if (Array.isArray(list)) {
      return list;
    }
  }

  if (typeof service.getDocuments === 'function') {
    const list = await service.getDocuments(12);

    if (Array.isArray(list)) {
      return list;
    }
  }

  if (typeof service.getLatestDocument === 'function') {
    const latest = await service.getLatestDocument();
    return latest ? [latest] : [];
  }

  return [];
}

function PrimaryActionCard({
  title,
  subtitle,
  icon,
  onPress,
}: {
  title: string;
  subtitle: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryActionCard,
        pressed && styles.cardPressed,
      ]}
    >
      <View style={styles.primaryActionIconWrap}>
        <Ionicons name={icon} size={22} color={colors.primary} />
      </View>

      <View style={styles.primaryActionTextWrap}>
        <Text numberOfLines={1} style={styles.primaryActionTitle}>
          {title}
        </Text>
        <Text numberOfLines={2} style={styles.primaryActionSubtitle}>
          {subtitle}
        </Text>
      </View>
    </Pressable>
  );
}

function SecondaryToolCard({
  title,
  subtitle,
  icon,
  onPress,
}: {
  title: string;
  subtitle: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.secondaryToolCard,
        pressed && styles.cardPressed,
      ]}
    >
      <View style={styles.secondaryToolIconWrap}>
        <Ionicons name={icon} size={18} color={colors.primary} />
      </View>

      <Text numberOfLines={1} style={styles.secondaryToolTitle}>
        {title}
      </Text>
      <Text numberOfLines={2} style={styles.secondaryToolSubtitle}>
        {subtitle}
      </Text>
    </Pressable>
  );
}

function SummaryChip({
  label,
  tone = 'default',
}: {
  label: string;
  tone?: 'default' | 'success' | 'accent' | 'warning';
}) {
  return (
    <View
      style={[
        styles.summaryChip,
        tone === 'success' && styles.summaryChipSuccess,
        tone === 'accent' && styles.summaryChipAccent,
        tone === 'warning' && styles.summaryChipWarning,
      ]}
    >
      <Text
        style={[
          styles.summaryChipText,
          tone === 'success' && styles.summaryChipTextSuccess,
          tone === 'accent' && styles.summaryChipTextAccent,
          tone === 'warning' && styles.summaryChipTextWarning,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

function ContinueDocumentCard({
  document,
  onPress,
  onOpenLibrary,
}: {
  document: HomeDocument | null;
  onPress: () => void;
  onOpenLibrary: () => void;
}) {
  if (!document) {
    return (
      <View style={styles.continueCard}>
        <View style={styles.continueHeaderRow}>
          <View style={styles.continueHeaderTextWrap}>
            <Text style={styles.continueEyebrow}>Hızlı başlangıç</Text>
            <Text style={styles.continueTitle}>İlk belgeni oluştur</Text>
            <Text style={styles.continueSubtitle}>
              Kamera ile tara, PDF içe aktar veya galeriden yeni belge başlat.
            </Text>
          </View>
        </View>

        <View style={styles.continueFooterRow}>
          <Pressable
            onPress={onPress}
            style={({ pressed }) => [
              styles.continuePrimaryButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.continuePrimaryButtonText}>Taramayı başlat</Text>
          </Pressable>

          <Pressable
            onPress={onOpenLibrary}
            style={({ pressed }) => [
              styles.continueSecondaryButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.continueSecondaryButtonText}>Belgelerim</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const title = resolveDocumentTitle(document);
  const status = resolveDocumentStatusLabel(document);
  const updatedAt = formatDocumentDate(resolveDocumentUpdatedAt(document));
  const pageCount = resolveDocumentPageCount(document);
  const thumbnailPath = resolveDocumentThumbnailPath(document);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.continueCard,
        pressed && styles.cardPressed,
      ]}
    >
      <View style={styles.continueHeaderRow}>
        <View style={styles.continueHeaderTextWrap}>
          <Text style={styles.continueEyebrow}>Kaldığın yerden devam et</Text>
          <Text numberOfLines={1} style={styles.continueTitle}>
            {title}
          </Text>
          <Text numberOfLines={2} style={styles.continueSubtitle}>
            {pageCount > 0 ? `${pageCount} sayfa` : 'Belge'} • {updatedAt}
          </Text>
        </View>

        <View style={styles.continueStatusChip}>
          <Text style={styles.continueStatusChipText}>{status}</Text>
        </View>
      </View>

      <View style={styles.continuePreviewRow}>
        <View style={styles.continuePreviewWrap}>
          {thumbnailPath ? (
            <Image
              source={{ uri: thumbnailPath }}
              resizeMode="cover"
              style={styles.continuePreviewImage}
            />
          ) : (
            <View style={styles.continuePreviewFallback}>
              <Ionicons
                name="document-text-outline"
                size={24}
                color={colors.textTertiary}
              />
            </View>
          )}
        </View>

        <View style={styles.continueSideColumn}>
          <Text style={styles.continueSideTitle}>Son belge</Text>
          <Text style={styles.continueSideText}>
            Düzenleme, OCR, çeviri, kaşe ve export akışına tek dokunuşla dön.
          </Text>

          <View style={styles.continueFooterRow}>
            <View style={styles.continuePrimaryButton}>
              <Text style={styles.continuePrimaryButtonText}>Devam et</Text>
            </View>

            <Pressable
              onPress={onOpenLibrary}
              style={({ pressed }) => [
                styles.continueSecondaryButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.continueSecondaryButtonText}>Tümü</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function RecoverySummaryCard({
  processingCount,
  failedCount,
  pdfReadyCount,
  favoriteCount,
  onOpenDocuments,
}: {
  processingCount: number;
  failedCount: number;
  pdfReadyCount: number;
  favoriteCount: number;
  onOpenDocuments: () => void;
}) {
  return (
    <View style={styles.recoveryCard}>
      <View style={styles.recoveryHeaderRow}>
        <View style={styles.recoveryIconWrap}>
          <Ionicons name="pulse-outline" size={18} color={colors.primary} />
        </View>

        <View style={styles.recoveryTextWrap}>
          <Text style={styles.recoveryTitle}>Belge işlem özeti</Text>
          <Text style={styles.recoverySubtitle}>
            OCR, export ve recovery görünürlüğü tek yerden takip ediliyor.
          </Text>
        </View>
      </View>

      <View style={styles.recoveryChipRow}>
        <SummaryChip label={`${processingCount} işleniyor`} tone="accent" />
        <SummaryChip label={`${failedCount} hata`} tone="warning" />
        <SummaryChip label={`${pdfReadyCount} PDF hazır`} tone="success" />
        <SummaryChip label={`${favoriteCount} favori`} tone="default" />
      </View>

      <Text style={styles.recoveryText}>
        {failedCount > 0
          ? 'Başarısız OCR kayıtları için belge merkezinden retry akışına geç.'
          : processingCount > 0
          ? 'Devam eden OCR işlemleri belge merkezinde canlı durum kartlarıyla görünür.'
          : 'Belge pipeline temiz durumda. Yeni işleme başlayabilir veya son belgeye dönebilirsin.'}
      </Text>

      <Pressable
        onPress={onOpenDocuments}
        style={({ pressed }) => [
          styles.recoveryButton,
          pressed && styles.pressed,
        ]}
      >
        <Text style={styles.recoveryButtonText}>Belge merkezini aç</Text>
      </Pressable>
    </View>
  );
}

function RecentDocumentMiniCard({
  document,
  onPress,
}: {
  document: HomeDocument;
  onPress: () => void;
}) {
  const title = resolveDocumentTitle(document);
  const status = resolveDocumentStatusLabel(document);
  const thumbnailPath = resolveDocumentThumbnailPath(document);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.recentMiniCard,
        pressed && styles.cardPressed,
      ]}
    >
      <View style={styles.recentMiniThumbWrap}>
        {thumbnailPath ? (
          <Image
            source={{ uri: thumbnailPath }}
            resizeMode="cover"
            style={styles.recentMiniThumb}
          />
        ) : (
          <View style={styles.recentMiniThumbFallback}>
            <Ionicons
              name="document-text-outline"
              size={18}
              color={colors.textTertiary}
            />
          </View>
        )}
      </View>

      <Text numberOfLines={1} style={styles.recentMiniTitle}>
        {title}
      </Text>
      <Text numberOfLines={1} style={styles.recentMiniMeta}>
        {status}
      </Text>
    </Pressable>
  );
}

export function HomeScreen({ navigation }: Props) {
  const billingIsPro = useBillingStore((state) => state.isPro);
  const billingPlan = useBillingStore((state) => state.plan);
  const billingExpiresAt = useBillingStore((state) => state.expiresAt);

  const capabilities = useMemo(
    () =>
      resolveBillingCapabilities({
        isPro: billingIsPro,
        plan: billingPlan,
        expiresAt: billingExpiresAt,
      }),
    [billingExpiresAt, billingIsPro, billingPlan],
  );

  const { preloadInterstitial } = useAdGate();

  const [documents, setDocuments] = useState<HomeDocument[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const run = async () => {
        try {
          setLoading(true);
          preloadInterstitial();

          const service = documentService as DocumentServiceShape;
          const list = await resolveDocuments(service);

          if (!isActive) {
            return;
          }

          setDocuments(list);
        } catch (error) {
          console.warn('[HomeScreen] Failed to load documents:', error);

          if (isActive) {
            setDocuments([]);
          }
        } finally {
          if (isActive) {
            setLoading(false);
          }
        }
      };

      void run();

      return () => {
        isActive = false;
      };
    }, [preloadInterstitial]),
  );

  const overview = useMemo(() => buildDocumentHomeOverview(documents), [documents]);
  const latestDocument = overview.latestDocument;
  const recentDocuments = overview.recentDocuments;

  const primaryActions = useMemo(() => {
    return homePrimaryActionKeys
      .map((key) => PRIMARY_ACTIONS.find((item) => item.toolKey === key))
      .filter((item): item is HomeActionConfig => Boolean(item))
      .filter((item) => Boolean(findToolByKey(item.toolKey)));
  }, []);

  const secondaryActions = useMemo(() => {
    return homeSecondaryToolKeys
      .map((key) => SECONDARY_ACTIONS.find((item) => item.toolKey === key))
      .filter((item): item is HomeActionConfig => Boolean(item))
      .filter((item) => Boolean(findToolByKey(item.toolKey)));
  }, []);

  const handleToolPress = useCallback(
    (toolKey: string) => {
      const tool = findToolByKey(toolKey);

      if (!tool) {
        return;
      }

      void executeToolPrimaryAction(tool, navigation);
    },
    [navigation],
  );

  const handleOpenLatest = useCallback(() => {
    if (!latestDocument) {
      const scanTool = findToolByKey('scan-camera');

      if (!scanTool) {
        return;
      }

      void executeToolPrimaryAction(scanTool, navigation);
      return;
    }

    navigation.navigate('DocumentDetail', {
      documentId: latestDocument.id,
    });
  }, [latestDocument, navigation]);

  const handleOpenDocuments = useCallback(() => {
    navigation.navigate('DocumentsTab');
  }, [navigation]);

  const documentCountLabel = loading
    ? 'Belgeler hazırlanıyor'
    : `${overview.totalCount} belge`;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroRow}>
          <View style={styles.heroTextWrap}>
            <Text style={styles.heroTitle}>PDF Kaşe</Text>
            <Text style={styles.heroSubtitle}>
              Tara, düzenle, OCR yap, çevir ve sonucu local-first belge akışında cihazında yönet.
            </Text>
          </View>

          <Pressable
            onPress={handleOpenDocuments}
            style={({ pressed }) => [
              styles.heroLibraryButton,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons name="folder-open-outline" size={18} color={colors.text} />
            <Text style={styles.heroLibraryButtonText}>Belgelerim</Text>
          </Pressable>

          <LocalTrustBadge compact />
        </View>

        {loading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.loadingText}>Ana ekran hazırlanıyor...</Text>
          </View>
        ) : (
          <ContinueDocumentCard
            document={latestDocument}
            onPress={handleOpenLatest}
            onOpenLibrary={handleOpenDocuments}
          />
        )}

        {!loading ? (
          <RecoverySummaryCard
            processingCount={overview.processingCount}
            failedCount={overview.failedCount}
            pdfReadyCount={overview.pdfReadyCount}
            favoriteCount={overview.favoriteCount}
            onOpenDocuments={handleOpenDocuments}
          />
        ) : null}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Hızlı giriş</Text>
          <Text style={styles.sectionHint}>En çok kullanılan 4 işlem</Text>
        </View>

        <View style={styles.primaryActionGrid}>
          {primaryActions.map((item) => (
            <PrimaryActionCard
              key={item.toolKey}
              title={item.title}
              subtitle={item.subtitle}
              icon={item.icon}
              onPress={() => handleToolPress(item.toolKey)}
            />
          ))}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Son belgeler</Text>
          <Text style={styles.sectionHint}>
            {documentCountLabel}
            {!loading && overview.processingCount > 0
              ? ` • ${overview.processingCount} işleniyor`
              : ''}
          </Text>
        </View>

        {loading ? (
          <View style={styles.loadingInlineWrap}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        ) : recentDocuments.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.recentScrollContent}
            style={styles.recentScroll}
          >
            {recentDocuments.map((document) => (
              <RecentDocumentMiniCard
                key={document.id}
                document={document}
                onPress={() =>
                  navigation.navigate('DocumentDetail', {
                    documentId: document.id,
                  })
                }
              />
            ))}
          </ScrollView>
        ) : (
          <View style={styles.emptyRecentCard}>
            <Text style={styles.emptyRecentTitle}>Henüz belge yok</Text>
            <Text style={styles.emptyRecentText}>
              İlk belgeyi oluşturduğunda burada hızlı erişim kartları görünecek.
            </Text>
          </View>
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Araçlar</Text>
          <Pressable
            onPress={() => navigation.navigate('ToolsTab')}
            style={({ pressed }) => [pressed && styles.pressed]}
          >
            <Text style={styles.sectionLink}>Tüm araçlar</Text>
          </Pressable>
        </View>

        <View style={styles.secondaryToolsGrid}>
          {secondaryActions.map((item) => (
            <SecondaryToolCard
              key={item.toolKey}
              title={item.title}
              subtitle={item.subtitle}
              icon={item.icon}
              onPress={() => handleToolPress(item.toolKey)}
            />
          ))}
        </View>

        {!capabilities.canSave ? (
          <View style={styles.premiumCard}>
            <View style={styles.premiumHeaderRow}>
              <View style={styles.premiumIconWrap}>
                <Ionicons name="diamond-outline" size={20} color={colors.primary} />
              </View>

              <View style={styles.premiumTextWrap}>
                <Text style={styles.premiumTitle}>Free ve Premium farkı</Text>
                <Text style={styles.premiumSubtitle}>
                  Tüm araçlar açık. Kaydetme, export, paylaşma ve reklamsız kullanım premium ile açılır.
                </Text>
              </View>
            </View>

            <Pressable
              onPress={() => navigation.navigate('Pricing')}
              style={({ pressed }) => [
                styles.premiumButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.premiumButtonText}>Premium’u gör</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.proCard}>
            <View style={styles.proBadgeRow}>
              <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
              <Text style={styles.proTitle}>Premium aktif</Text>
            </View>
            <Text style={styles.proSubtitle}>
              Kaydetme, paylaşma ve dışa aktarma açık. Reklamlar kapalı.
            </Text>
          </View>
        )}
      </ScrollView>

      <BannerStrip hidden={capabilities.canRemoveAds} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: Layout.screenHorizontalPadding,
    paddingTop: Layout.screenVerticalPadding,
    paddingBottom: 168,
    gap: Spacing.lg,
  },
  heroRow: {
    gap: Spacing.md,
  },
  heroTextWrap: {
    gap: 6,
  },
  heroTitle: {
    ...Typography.titleLarge,
    color: colors.text,
  },
  heroSubtitle: {
    ...Typography.body,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  heroLibraryButton: {
    alignSelf: 'flex-start',
    minHeight: 42,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    ...Shadows.sm,
  },
  heroLibraryButtonText: {
    color: colors.text,
    fontWeight: '700',
  },
  continueCard: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: Spacing.lg,
    gap: Spacing.md,
    ...Shadows.sm,
  },
  continueHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  continueHeaderTextWrap: {
    flex: 1,
    gap: 6,
  },
  continueEyebrow: {
    ...Typography.caption,
    color: colors.primary,
    fontWeight: '800',
  },
  continueTitle: {
    ...Typography.titleLarge,
    color: colors.text,
  },
  continueSubtitle: {
    ...Typography.body,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  continueStatusChip: {
    borderRadius: 999,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  continueStatusChipText: {
    ...Typography.caption,
    color: colors.textSecondary,
    fontWeight: '800',
  },
  continuePreviewRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    alignItems: 'stretch',
  },
  continuePreviewWrap: {
    width: 92,
    height: 122,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  continuePreviewImage: {
    width: '100%',
    height: '100%',
  },
  continuePreviewFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueSideColumn: {
    flex: 1,
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  continueSideTitle: {
    ...Typography.titleSmall,
    color: colors.text,
  },
  continueSideText: {
    ...Typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  continueFooterRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'center',
  },
  continuePrimaryButton: {
    minHeight: 42,
    borderRadius: Radius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
    flex: 1,
  },
  continuePrimaryButtonText: {
    color: colors.onPrimary,
    fontWeight: '800',
    fontSize: 14,
  },
  continueSecondaryButton: {
    minHeight: 42,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
  },
  continueSecondaryButtonText: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 14,
  },
  recoveryCard: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: Spacing.lg,
    gap: Spacing.md,
    ...Shadows.sm,
  },
  recoveryHeaderRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    alignItems: 'flex-start',
  },
  recoveryIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recoveryTextWrap: {
    flex: 1,
    gap: 4,
  },
  recoveryTitle: {
    ...Typography.titleSmall,
    color: colors.text,
  },
  recoverySubtitle: {
    ...Typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  recoveryChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  summaryChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  summaryChipSuccess: {
    backgroundColor: 'rgba(53, 199, 111, 0.12)',
    borderColor: 'rgba(53, 199, 111, 0.28)',
  },
  summaryChipAccent: {
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    borderColor: 'rgba(59, 130, 246, 0.28)',
  },
  summaryChipWarning: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: 'rgba(245, 158, 11, 0.24)',
  },
  summaryChipText: {
    ...Typography.caption,
    color: colors.textSecondary,
    fontWeight: '800',
  },
  summaryChipTextSuccess: {
    color: colors.primary,
  },
  summaryChipTextAccent: {
    color: '#60A5FA',
  },
  summaryChipTextWarning: {
    color: '#FBBF24',
  },
  recoveryText: {
    ...Typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  recoveryButton: {
    minHeight: 42,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
  },
  recoveryButtonText: {
    color: colors.text,
    fontWeight: '800',
    fontSize: 14,
  },
  sectionHeader: {
    marginTop: Spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  sectionTitle: {
    ...Typography.titleSmall,
    color: colors.text,
  },
  sectionHint: {
    ...Typography.bodySmall,
    color: colors.textTertiary,
  },
  sectionLink: {
    ...Typography.bodySmall,
    color: colors.primary,
    fontWeight: '800',
  },
  primaryActionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: Spacing.md,
  },
  primaryActionCard: {
    width: '48.5%',
    minHeight: 112,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
    ...Shadows.sm,
  },
  primaryActionIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryActionTextWrap: {
    gap: 4,
  },
  primaryActionTitle: {
    ...Typography.body,
    color: colors.text,
    fontWeight: '800',
  },
  primaryActionSubtitle: {
    ...Typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  recentScroll: {
    marginHorizontal: -Layout.screenHorizontalPadding,
  },
  recentScrollContent: {
    paddingHorizontal: Layout.screenHorizontalPadding,
    gap: Spacing.md,
  },
  recentMiniCard: {
    width: 150,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: Spacing.sm,
    gap: Spacing.sm,
    ...Shadows.sm,
  },
  recentMiniThumbWrap: {
    width: '100%',
    height: 102,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  recentMiniThumb: {
    width: '100%',
    height: '100%',
  },
  recentMiniThumbFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentMiniTitle: {
    ...Typography.bodySmall,
    color: colors.text,
    fontWeight: '800',
  },
  recentMiniMeta: {
    ...Typography.caption,
    color: colors.textSecondary,
  },
  emptyRecentCard: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: Spacing.lg,
    gap: Spacing.xs,
  },
  emptyRecentTitle: {
    ...Typography.titleSmall,
    color: colors.text,
  },
  emptyRecentText: {
    ...Typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  secondaryToolsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: Spacing.md,
  },
  secondaryToolCard: {
    width: '31.5%',
    minHeight: 118,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.md,
    alignItems: 'flex-start',
    gap: 8,
    ...Shadows.sm,
  },
  secondaryToolIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryToolTitle: {
    ...Typography.bodySmall,
    color: colors.text,
    fontWeight: '800',
  },
  secondaryToolSubtitle: {
    ...Typography.caption,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  premiumCard: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.card,
    padding: Spacing.lg,
    gap: Spacing.md,
    ...Shadows.sm,
  },
  premiumHeaderRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    alignItems: 'flex-start',
  },
  premiumIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  premiumTextWrap: {
    flex: 1,
    gap: 6,
  },
  premiumTitle: {
    ...Typography.titleSmall,
    color: colors.text,
  },
  premiumSubtitle: {
    ...Typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  premiumButton: {
    minHeight: 46,
    borderRadius: Radius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  premiumButtonText: {
    color: colors.onPrimary,
    fontWeight: '800',
    fontSize: 15,
  },
  proCard: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: Spacing.lg,
    gap: 8,
    ...Shadows.sm,
  },
  proBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  proTitle: {
    ...Typography.titleSmall,
    color: colors.text,
  },
  proSubtitle: {
    ...Typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  loadingCard: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  loadingText: {
    ...Typography.body,
    color: colors.textSecondary,
  },
  loadingInlineWrap: {
    minHeight: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardPressed: {
    opacity: 0.94,
    transform: [{ scale: 0.997 }],
  },
  pressed: {
    opacity: 0.92,
  },
});