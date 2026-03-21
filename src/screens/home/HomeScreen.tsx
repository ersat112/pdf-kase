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
    toolKey: 'utility-qr',
    title: 'QR',
    subtitle: 'Kod okut',
    icon: 'qr-code-outline',
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

function InfoPill({
  label,
  tone = 'default',
}: {
  label: string;
  tone?: 'default' | 'accent' | 'success' | 'warning';
}) {
  return (
    <View
      style={[
        styles.infoPill,
        tone === 'accent' && styles.infoPillAccent,
        tone === 'success' && styles.infoPillSuccess,
        tone === 'warning' && styles.infoPillWarning,
      ]}
    >
      <Text
        style={[
          styles.infoPillText,
          tone === 'accent' && styles.infoPillTextAccent,
          tone === 'success' && styles.infoPillTextSuccess,
          tone === 'warning' && styles.infoPillTextWarning,
        ]}
      >
        {label}
      </Text>
    </View>
  );
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

function getContinueCopy(document: HomeDocument | null) {
  if (!document) {
    return {
      eyebrow: 'Hızlı başlangıç',
      title: 'İlk belgeni oluştur',
      subtitle: 'Kamera ile tara, PDF içe aktar veya galeriden yeni belge başlat.',
      body: 'İlk belgeyi oluşturduğunda düzenleme, OCR, kaşe ve export akışı tek yüzeyden devam eder.',
      primaryLabel: 'Taramayı başlat',
      secondaryLabel: 'Belgelerim',
    };
  }

  const pageCount = resolveDocumentPageCount(document);
  const status = resolveDocumentStatusLabel(document);

  return {
    eyebrow: 'Kaldığın yerden devam et',
    title: resolveDocumentTitle(document),
    subtitle: `${pageCount > 0 ? `${pageCount} sayfa` : 'Belge'} • ${formatDocumentDate(resolveDocumentUpdatedAt(document))}`,
    body:
      pageCount > 0
        ? `${status} durumundaki belgeye dön, düzenleme, OCR, kaşe ve export akışına devam et.`
        : 'Belge detayını aç, çıktı durumunu kontrol et ve sonraki adıma geç.',
    primaryLabel: 'Devam et',
    secondaryLabel: 'Kitaplık',
  };
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
  const copy = getContinueCopy(document);

  if (!document) {
    return (
      <View style={styles.continueCard}>
        <View style={styles.continueHeaderTextWrap}>
          <Text style={styles.continueEyebrow}>{copy.eyebrow}</Text>
          <Text style={styles.continueTitle}>{copy.title}</Text>
          <Text style={styles.continueSubtitle}>{copy.subtitle}</Text>
          <Text style={styles.continueBody}>{copy.body}</Text>
        </View>

        <View style={styles.continueFooterRow}>
          <Pressable
            onPress={onPress}
            style={({ pressed }) => [
              styles.continuePrimaryButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.continuePrimaryButtonText}>{copy.primaryLabel}</Text>
          </Pressable>

          <Pressable
            onPress={onOpenLibrary}
            style={({ pressed }) => [
              styles.continueSecondaryButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.continueSecondaryButtonText}>{copy.secondaryLabel}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const thumbnailPath = resolveDocumentThumbnailPath(document);
  const pageCount = resolveDocumentPageCount(document);
  const status = resolveDocumentStatusLabel(document);

  return (
    <View style={styles.continueCard}>
      <View style={styles.continueHeaderRow}>
        <View style={styles.continueHeaderTextWrap}>
          <Text style={styles.continueEyebrow}>{copy.eyebrow}</Text>
          <Text numberOfLines={1} style={styles.continueTitle}>
            {copy.title}
          </Text>
          <Text numberOfLines={2} style={styles.continueSubtitle}>
            {copy.subtitle}
          </Text>
        </View>

        <View style={styles.continueStatusWrap}>
          <InfoPill label={status} tone="accent" />
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
          <View style={styles.continueMetaPillRow}>
            <InfoPill label={`${pageCount} sayfa`} />
            <InfoPill label="Local-first" tone="success" />
          </View>

          <Text style={styles.continueBody}>{copy.body}</Text>

          <View style={styles.continueFooterRow}>
            <Pressable
              onPress={onPress}
              style={({ pressed }) => [
                styles.continuePrimaryButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.continuePrimaryButtonText}>{copy.primaryLabel}</Text>
            </Pressable>

            <Pressable
              onPress={onOpenLibrary}
              style={({ pressed }) => [
                styles.continueSecondaryButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.continueSecondaryButtonText}>{copy.secondaryLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
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

function HomePlanCard({
  canSave,
  canShare,
  canRemoveAds,
  onPress,
}: {
  canSave: boolean;
  canShare: boolean;
  canRemoveAds: boolean;
  onPress: () => void;
}) {
  if (!canSave) {
    return (
      <View style={styles.premiumCard}>
        <View style={styles.premiumHeaderRow}>
          <View style={styles.premiumIconWrap}>
            <Ionicons name="diamond-outline" size={20} color={colors.primary} />
          </View>

          <View style={styles.premiumTextWrap}>
            <Text style={styles.premiumTitle}>Free plan aktif</Text>
            <Text style={styles.premiumSubtitle}>
              Tüm araçlar açık. Kaydetme, export, paylaşma ve reklamsız kullanım
              premium ile açılır.
            </Text>
          </View>
        </View>

        <View style={styles.premiumFeatureRow}>
          <InfoPill label="Araçlar açık" tone="success" />
          <InfoPill label="Kaydetme kilitli" tone="warning" />
          <InfoPill label="Reklamlı" tone="accent" />
        </View>

        <Pressable
          onPress={onPress}
          style={({ pressed }) => [
            styles.premiumButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.premiumButtonText}>Premium’u gör</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.proCard}>
      <View style={styles.proBadgeRow}>
        <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
        <Text style={styles.proTitle}>Premium aktif</Text>
      </View>

      <Text style={styles.proSubtitle}>
        Kaydetme, paylaşma ve dışa aktarma açık. Reklamlar kapalı.
      </Text>

      <View style={styles.premiumFeatureRow}>
        <InfoPill label={canSave ? 'Export açık' : 'Export kapalı'} tone="success" />
        <InfoPill label={canShare ? 'Paylaşma açık' : 'Paylaşma kapalı'} tone="success" />
        <InfoPill label={canRemoveAds ? 'Reklamsız' : 'Reklamlı'} tone="success" />
      </View>

      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.proManageButton,
          pressed && styles.pressed,
        ]}
      >
        <Text style={styles.proManageButtonText}>Planı gör</Text>
      </Pressable>
    </View>
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
              Tara, düzenle, OCR yap, çevir ve sonucu local-first belge akışında
              cihazında yönet.
            </Text>
          </View>

          <View style={styles.heroStatusRow}>
            <InfoPill label={documentCountLabel} tone="accent" />
            {overview.processingCount > 0 ? (
              <InfoPill label={`${overview.processingCount} işleniyor`} tone="warning" />
            ) : null}
            <InfoPill
              label={capabilities.canRemoveAds ? 'Reklamsız' : 'Free'}
              tone={capabilities.canRemoveAds ? 'success' : 'default'}
            />
          </View>

          <View style={styles.heroActionRow}>
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

        <HomePlanCard
          canSave={capabilities.canSave}
          canShare={capabilities.canShare}
          canRemoveAds={capabilities.canRemoveAds}
          onPress={() => navigation.navigate('Pricing')}
        />
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
  heroStatusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  heroActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.sm,
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
  infoPillWarning: {
    borderColor: 'rgba(245, 158, 11, 0.24)',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
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
  infoPillTextWarning: {
    color: '#FBBF24',
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
  continueBody: {
    ...Typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  continueStatusWrap: {
    alignItems: 'flex-end',
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
  continueMetaPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
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
  premiumFeatureRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
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
  proManageButton: {
    minHeight: 44,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.xs,
  },
  proManageButtonText: {
    color: colors.text,
    fontWeight: '800',
    fontSize: 14,
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
