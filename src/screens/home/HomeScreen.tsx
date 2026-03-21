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
import { DocumentPipelineSummaryCard } from '../../components/documents/DocumentPipelineSummaryCard';
import {
  HomePrimaryActionGrid,
  type HomePrimaryActionItem,
} from '../../components/home/HomePrimaryActionGrid';
import {
  HomeSmartCollectionsRow,
  type HomeSmartCollectionItem,
} from '../../components/home/HomeSmartCollectionsRow';
import { LocalTrustBadge } from '../../components/trust/LocalTrustBadge';
import { executeToolPrimaryAction } from '../../features/tools/tools.actions';
import { findToolByKey } from '../../features/tools/tools.registry';
import { useAdGate } from '../../hooks/useAdGate';
import { resolveBillingCapabilities } from '../../modules/billing/billing-capabilities';
import {
  buildDocumentHomeOverview,
  buildHomeDocumentPipelineSummary,
  resolveDocumentPageCount,
  resolveDocumentPdfPath,
  resolveDocumentStatusLabel,
  resolveDocumentThumbnailPath,
  resolveDocumentTitle,
  resolveDocumentUpdatedAt,
  resolveDocumentWordPath,
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

function getStartOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

function getStartOfWeek() {
  const date = new Date();
  const day = date.getDay();
  const diff = day === 0 ? 6 : day - 1;
  date.setDate(date.getDate() - diff);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function getUpdatedTimestamp(document: HomeDocument) {
  const value = resolveDocumentUpdatedAt(document);

  if (!value) {
    return 0;
  }

  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
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
  const pageCount = resolveDocumentPageCount(document);
  const updatedAt = formatDocumentDate(resolveDocumentUpdatedAt(document));

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
              size={20}
              color={colors.textTertiary}
            />
          </View>
        )}
      </View>

      <View style={styles.recentMiniBody}>
        <Text numberOfLines={1} style={styles.recentMiniTitle}>
          {title}
        </Text>
        <Text numberOfLines={1} style={styles.recentMiniMeta}>
          {status}
        </Text>
        <Text numberOfLines={1} style={styles.recentMiniFootnote}>
          {pageCount > 0 ? `${pageCount} sayfa` : 'Belge'} • {updatedAt}
        </Text>
      </View>
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

  const handleOpenDocuments = useCallback(() => {
    navigation.navigate('DocumentsTab');
  }, [navigation]);

  const handleOpenLatest = useCallback(() => {
    if (!latestDocument) {
      handleToolPress('scan-camera');
      return;
    }

    navigation.navigate('DocumentDetail', {
      documentId: latestDocument.id,
    });
  }, [handleToolPress, latestDocument, navigation]);

  const handleOpenCameraTab = useCallback(() => {
    navigation.navigate('CameraTab');
  }, [navigation]);

  const handleOpenStampManager = useCallback(() => {
    navigation.navigate('StampManager');
  }, [navigation]);

  const documentCountLabel = loading
    ? 'Belgeler hazırlanıyor'
    : `${overview.totalCount} belge`;

  const homeActions = useMemo(() => {
    const latestSubtitle = latestDocument
      ? `${resolveDocumentStatusLabel(latestDocument)} • ${formatDocumentDate(resolveDocumentUpdatedAt(latestDocument))}`
      : 'Henüz belge yok';

    const latestBadge =
      latestDocument && resolveDocumentPageCount(latestDocument) > 0
        ? `${resolveDocumentPageCount(latestDocument)} sayfa`
        : null;

    const featuredAction: HomePrimaryActionItem = {
      key: 'scan-camera',
      title: 'Tara',
      subtitle: 'Yeni belgeyi doğrudan kamera akışıyla başlat.',
      icon: 'scan-outline',
      onPress: () => handleToolPress('scan-camera'),
      badge: overview.processingCount > 0 ? `${overview.processingCount} işleniyor` : 'Belge akışı',
      ctaLabel: 'Tarama akışını aç',
    };

    const secondaryActions: HomePrimaryActionItem[] = [
      {
        key: 'import-files',
        title: 'PDF içe aktar',
        subtitle: 'Mevcut PDF veya dosyayı belge merkezine ekle.',
        icon: 'document-attach-outline',
        onPress: () => handleToolPress('import-files'),
      },
      {
        key: 'camera-tab',
        title: 'Kamera ile devam et',
        subtitle: 'Canlı kamera yüzeyine dön ve çekime devam et.',
        icon: 'camera-outline',
        onPress: handleOpenCameraTab,
      },
      {
        key: 'stamp-manager',
        title: 'İmzala / Kaşele',
        subtitle: 'Kaşe ve imza kütüphanesini yönet.',
        icon: 'color-wand-outline',
        onPress: handleOpenStampManager,
      },
      {
        key: 'latest-document',
        title: 'Son belgeyi aç',
        subtitle: latestSubtitle,
        icon: 'document-text-outline',
        onPress: handleOpenLatest,
        badge: latestBadge,
      },
    ];

    return {
      featuredAction,
      secondaryActions,
    };
  }, [
    handleOpenCameraTab,
    handleOpenLatest,
    handleOpenStampManager,
    handleToolPress,
    latestDocument,
    overview.processingCount,
  ]);

  const smartCollections = useMemo<HomeSmartCollectionItem[]>(() => {
    const todayStart = getStartOfToday();
    const weekStart = getStartOfWeek();

    const todayCount = documents.filter(
      (item) => getUpdatedTimestamp(item) >= todayStart,
    ).length;

    const weekCount = documents.filter(
      (item) => getUpdatedTimestamp(item) >= weekStart,
    ).length;

    const signableCount = documents.filter(
      (item) =>
        resolveDocumentPageCount(item) > 0 &&
        !resolveDocumentPdfPath(item),
    ).length;

    const sharedCount = documents.filter(
      (item) =>
        Boolean(resolveDocumentPdfPath(item) || resolveDocumentWordPath(item)),
    ).length;

    return [
      {
        key: 'today',
        title: 'Bugün',
        subtitle: 'Bugün dokunulan belgeler',
        count: todayCount,
        icon: 'today-outline',
        tone: 'accent',
        onPress: handleOpenDocuments,
      },
      {
        key: 'week',
        title: 'Bu hafta',
        subtitle: 'Haftalık belge hareketi',
        count: weekCount,
        icon: 'calendar-outline',
        tone: 'default',
        onPress: handleOpenDocuments,
      },
      {
        key: 'signable',
        title: 'İmzalanacaklar',
        subtitle: 'Henüz sonuçlandırılmamış sayfalı belgeler',
        count: signableCount,
        icon: 'create-outline',
        tone: signableCount > 0 ? 'warning' : 'default',
        onPress: handleOpenDocuments,
      },
      {
        key: 'shared',
        title: 'Paylaşılanlar',
        subtitle: 'PDF / Word çıktısı hazır kayıtlar',
        count: sharedCount,
        icon: 'share-social-outline',
        tone: sharedCount > 0 ? 'success' : 'default',
        onPress: handleOpenDocuments,
      },
    ];
  }, [documents, handleOpenDocuments]);

  const pipelineSummary = useMemo(
    () =>
      buildHomeDocumentPipelineSummary(overview, {
        onOpenDocuments: handleOpenDocuments,
      }),
    [handleOpenDocuments, overview],
  );

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroCard}>
          <View style={styles.heroTextWrap}>
            <Text style={styles.heroEyebrow}>PDF Kaşe</Text>
            <Text style={styles.heroTitle}>Belge merkezi</Text>
            <Text style={styles.heroSubtitle}>
              Tara, içe aktar, son belgeye dön ve belge akışını tek yüzeyden yönet.
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
            <Text style={styles.loadingText}>Belge merkezi hazırlanıyor...</Text>
          </View>
        ) : (
          <HomePrimaryActionGrid
            featuredAction={homeActions.featuredAction}
            secondaryActions={homeActions.secondaryActions}
          />
        )}

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
              İlk belgeyi oluşturduğunda burada hızlı geri dönüş kartları görünecek.
            </Text>
          </View>
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Akıllı koleksiyonlar</Text>
          <Text style={styles.sectionHint}>Bugün, hafta ve sonuç akışı</Text>
        </View>

        <HomeSmartCollectionsRow items={smartCollections} />

        <DocumentPipelineSummaryCard
          title={pipelineSummary.title}
          subtitle={pipelineSummary.subtitle}
          message={pipelineSummary.message}
          tone={pipelineSummary.tone}
          icon={pipelineSummary.icon}
          stats={pipelineSummary.stats}
          actions={pipelineSummary.actions}
        />

        <Pressable
          onPress={() => navigation.navigate('ToolsTab')}
          style={({ pressed }) => [
            styles.toolsHubCard,
            pressed && styles.pressed,
          ]}
        >
          <View style={styles.toolsHubIconWrap}>
            <Ionicons name="apps-outline" size={20} color={colors.primary} />
          </View>

          <View style={styles.toolsHubTextWrap}>
            <Text style={styles.toolsHubTitle}>Diğer araçlar</Text>
            <Text style={styles.toolsHubSubtitle}>
              OCR, çeviri, QR ve yardımcı araçlar ayrı merkezde kalsın; Home belge
              odaklı kalsın.
            </Text>
          </View>

          <Ionicons
            name="chevron-forward"
            size={18}
            color={colors.textTertiary}
          />
        </Pressable>

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
  heroCard: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: Spacing.lg,
    gap: Spacing.md,
    ...Shadows.sm,
  },
  heroTextWrap: {
    gap: 6,
  },
  heroEyebrow: {
    ...Typography.caption,
    color: colors.primary,
    fontWeight: '800',
    textTransform: 'uppercase',
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
    backgroundColor: colors.surfaceElevated,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  recentScroll: {
    marginHorizontal: -Layout.screenHorizontalPadding,
  },
  recentScrollContent: {
    paddingHorizontal: Layout.screenHorizontalPadding,
    gap: Spacing.md,
  },
  recentMiniCard: {
    width: 176,
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
    height: 118,
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
  recentMiniBody: {
    gap: 4,
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
  recentMiniFootnote: {
    ...Typography.caption,
    color: colors.textTertiary,
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
  toolsHubCard: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    ...Shadows.sm,
  },
  toolsHubIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolsHubTextWrap: {
    flex: 1,
    gap: 4,
  },
  toolsHubTitle: {
    ...Typography.body,
    color: colors.text,
    fontWeight: '800',
  },
  toolsHubSubtitle: {
    ...Typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 20,
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