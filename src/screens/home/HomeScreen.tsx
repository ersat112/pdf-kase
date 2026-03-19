import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { BannerStrip } from '../../components/ads/BannerStrip';
import { executeToolPrimaryAction } from '../../features/tools/tools.actions';
import { findToolByKey } from '../../features/tools/tools.registry';
import { useAdGate } from '../../hooks/useAdGate';
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

type HomeDocument = {
  id: number;
  title?: string | null;
  status?: string | null;
  pageCount?: number | null;
  page_count?: number | null;
  pdfPath?: string | null;
  pdf_path?: string | null;
  thumbnailPath?: string | null;
  thumbnail_path?: string | null;
  createdAt?: string | null;
  created_at?: string | null;
  updatedAt?: string | null;
  updated_at?: string | null;
};

type DocumentServiceShape = typeof documentService & {
  getLatestDocument?: () => Promise<HomeDocument | null>;
  listDocuments?: () => Promise<HomeDocument[]>;
  getDocuments?: () => Promise<HomeDocument[]>;
};

type QuickActionItem = {
  key:
    | 'scan'
    | 'pdf-tools'
    | 'import-images'
    | 'import-files'
    | 'id-card'
    | 'ocr'
    | 'id-photo'
    | 'all';
  title: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
};

type NativePdfRendererProps = {
  source: string;
  singlePage?: boolean;
  maxZoom?: number;
  distanceBetweenPages?: number;
  maxPageResolution?: number;
  style?: StyleProp<ViewStyle>;
};

const QUICK_ACTIONS: QuickActionItem[] = [
  {
    key: 'scan',
    title: 'Tara',
    icon: 'scan-outline',
  },
  {
    key: 'pdf-tools',
    title: 'Pdf Araçları',
    icon: 'construct-outline',
  },
  {
    key: 'import-images',
    title: 'Görüntüleri İçe Aktar',
    icon: 'images-outline',
  },
  {
    key: 'import-files',
    title: 'Dosyaları İçe Aktar',
    icon: 'folder-open-outline',
  },
  {
    key: 'id-card',
    title: 'Kimlik Kartları',
    icon: 'card-outline',
  },
  {
    key: 'ocr',
    title: 'Metin Çıkar',
    icon: 'document-text-outline',
  },
  {
    key: 'id-photo',
    title: 'Kimlik Fotoğraf Yapıcı',
    icon: 'person-circle-outline',
  },
  {
    key: 'all',
    title: 'Tümü',
    icon: 'grid-outline',
  },
];

function normalizeText(value: string) {
  return value.trim().toLocaleLowerCase('tr-TR');
}

function resolveDocumentTitle(document: HomeDocument) {
  const title = document.title?.trim();

  if (title) {
    return title;
  }

  return `Belge #${document.id}`;
}

function resolveDocumentUpdatedAt(document: HomeDocument) {
  return (
    document.updatedAt ??
    document.updated_at ??
    document.createdAt ??
    document.created_at ??
    null
  );
}

function resolveDocumentPdfPath(document: HomeDocument) {
  return document.pdfPath ?? document.pdf_path ?? null;
}

function resolveDocumentThumbnailPath(document: HomeDocument) {
  return document.thumbnailPath ?? document.thumbnail_path ?? null;
}

function resolveDocumentPageCount(document: HomeDocument) {
  const pageCount = document.pageCount ?? document.page_count;

  if (typeof pageCount === 'number' && Number.isFinite(pageCount) && pageCount > 0) {
    return pageCount;
  }

  return null;
}

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
  if (typeof service.listDocuments === 'function') {
    const list = await service.listDocuments();

    if (Array.isArray(list)) {
      return list;
    }
  }

  if (typeof service.getDocuments === 'function') {
    const list = await service.getDocuments();

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

function sortDocuments(list: HomeDocument[]) {
  return [...list].sort((left, right) => {
    const leftTime = new Date(resolveDocumentUpdatedAt(left) ?? 0).getTime();
    const rightTime = new Date(resolveDocumentUpdatedAt(right) ?? 0).getTime();

    return rightTime - leftTime;
  });
}

function QuickActionTile({
  title,
  icon,
  onPress,
}: {
  title: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.quickActionTile,
        pressed && styles.cardPressed,
      ]}
    >
      <View style={styles.quickActionIconWrap}>
        <Ionicons name={icon} size={22} color={colors.primary} />
      </View>
      <Text numberOfLines={2} style={styles.quickActionTitle}>
        {title}
      </Text>
    </Pressable>
  );
}

function RecentDocumentThumbnail({
  thumbnailPath,
  pdfPath,
}: {
  thumbnailPath: string | null;
  pdfPath: string | null;
}) {
  const NativePdfRendererView = useMemo(() => {
    if (Platform.OS === 'web') {
      return null;
    }

    try {
      return require('react-native-pdf-renderer')
        .default as React.ComponentType<NativePdfRendererProps>;
    } catch {
      return null;
    }
  }, []);

  if (thumbnailPath) {
    return (
      <View style={styles.thumbnailWrap}>
        <Image
          source={{ uri: thumbnailPath }}
          resizeMode="cover"
          style={styles.thumbnailImage}
        />
      </View>
    );
  }

  if (pdfPath && NativePdfRendererView) {
    return (
      <View style={styles.thumbnailWrap}>
        <View style={styles.thumbnailPdfViewport}>
          <NativePdfRendererView
            source={pdfPath}
            singlePage
            maxZoom={1}
            distanceBetweenPages={0}
            maxPageResolution={512}
            style={styles.thumbnailPdf}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.thumbnailWrap}>
      <View style={styles.thumbnailFallback}>
        <Ionicons name="document-text-outline" size={22} color={colors.textTertiary} />
      </View>
    </View>
  );
}

function RecentDocumentCard({
  document,
  selected,
  onToggleSelect,
  onShare,
  onView,
  onToWord,
}: {
  document: HomeDocument;
  selected: boolean;
  onToggleSelect: () => void;
  onShare: () => void;
  onView: () => void;
  onToWord: () => void;
}) {
  const title = resolveDocumentTitle(document);
  const pageCount = resolveDocumentPageCount(document);
  const updatedAt = formatDocumentDate(resolveDocumentUpdatedAt(document));
  const thumbnailPath = resolveDocumentThumbnailPath(document);
  const pdfPath = resolveDocumentPdfPath(document);

  return (
    <View style={styles.recentCard}>
      <View style={styles.recentBodyRow}>
        <RecentDocumentThumbnail thumbnailPath={thumbnailPath} pdfPath={pdfPath} />

        <View style={styles.recentMainColumn}>
          <View style={styles.recentCardHeader}>
            <View style={styles.recentCardTextWrap}>
              <Text numberOfLines={1} style={styles.recentCardTitle}>
                {title}
              </Text>
              <Text style={styles.recentCardMeta}>
                {pageCount ? `${pageCount} sayfa • ` : 'PDF • '}
                {updatedAt}
              </Text>
            </View>

            <Pressable
              onPress={onToggleSelect}
              hitSlop={10}
              style={({ pressed }) => [styles.checkboxButton, pressed && styles.pressed]}
            >
              <Ionicons
                name={selected ? 'checkbox' : 'square-outline'}
                size={22}
                color={selected ? colors.primary : colors.textTertiary}
              />
            </Pressable>
          </View>

          <View style={styles.recentActionRow}>
            <Pressable
              onPress={onShare}
              style={({ pressed }) => [
                styles.inlineActionButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.inlineActionText}>Paylaş</Text>
            </Pressable>

            <Pressable
              onPress={onToWord}
              style={({ pressed }) => [
                styles.inlineActionButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.inlineActionText}>To Word</Text>
            </Pressable>

            <Pressable
              onPress={onView}
              style={({ pressed }) => [
                styles.inlineActionButtonPrimary,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.inlineActionTextPrimary}>Görüntüle</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

export function HomeScreen({ navigation }: Props) {
  const isPro = useBillingStore((state) => state.isPro);
  const { preloadInterstitial } = useAdGate();

  const [documents, setDocuments] = useState<HomeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<number[]>([]);

  const convertWordTool = useMemo(() => findToolByKey('convert-word') ?? null, []);

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

          setDocuments(sortDocuments(list));
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

  const normalizedQuery = normalizeText(searchQuery);

  const filteredQuickActions = useMemo(() => {
    if (!normalizedQuery) {
      return QUICK_ACTIONS;
    }

    return QUICK_ACTIONS.filter((item) =>
      item.title.toLocaleLowerCase('tr-TR').includes(normalizedQuery),
    );
  }, [normalizedQuery]);

  const filteredDocuments = useMemo(() => {
    if (!normalizedQuery) {
      return documents;
    }

    return documents.filter((document) =>
      resolveDocumentTitle(document)
        .toLocaleLowerCase('tr-TR')
        .includes(normalizedQuery),
    );
  }, [documents, normalizedQuery]);

  const recentDocuments = filteredDocuments.slice(0, 8);

  const toggleDocumentSelection = useCallback((documentId: number) => {
    setSelectedDocumentIds((current) =>
      current.includes(documentId)
        ? current.filter((id) => id !== documentId)
        : [...current, documentId],
    );
  }, []);

  const handleShareDocument = useCallback(async (document: HomeDocument) => {
    const title = resolveDocumentTitle(document);
    const path = resolveDocumentPdfPath(document);

    try {
      await Share.share({
        title,
        message: path ? `${title}\n${path}` : `${title} belgesini paylaş`,
        url: path ?? undefined,
      });
    } catch (error) {
      console.warn('[HomeScreen] Share failed:', error);
      Alert.alert('Paylaşım başarısız', 'Belge paylaşılırken hata oluştu.');
    }
  }, []);

  const handleOpenDocument = useCallback(
    (documentId: number) => {
      navigation.navigate('DocumentDetail', { documentId });
    },
    [navigation],
  );

  const handleToWord = useCallback(() => {
    if (!convertWordTool) {
      Alert.alert('Araç bulunamadı', 'Word dönüşüm aracı kayıtlı değil.');
      return;
    }

    void executeToolPrimaryAction(convertWordTool, navigation);
  }, [convertWordTool, navigation]);

  const handleQuickActionPress = useCallback(
    (action: QuickActionItem) => {
      switch (action.key) {
        case 'scan':
          navigation.navigate('ScanEntry', { initialMode: 'camera' });
          return;
        case 'pdf-tools':
        case 'all':
          navigation.navigate('ToolsTab');
          return;
        case 'import-images':
          navigation.navigate('ScanEntry', { initialMode: 'import-images' });
          return;
        case 'import-files':
          navigation.navigate('ScanEntry', { initialMode: 'import-files' });
          return;
        case 'id-card':
          navigation.navigate('ScanEntry', { initialMode: 'id-card' });
          return;
        case 'ocr':
          navigation.navigate('ScanEntry', { initialMode: 'ocr' });
          return;
        case 'id-photo':
          navigation.navigate('ScanEntry', { initialMode: 'id-photo' });
          return;
        default:
          return;
      }
    },
    [navigation],
  );

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.searchCard}>
          <Ionicons name="search-outline" size={20} color={colors.textTertiary} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Uygulama içinde ara"
            placeholderTextColor={colors.textTertiary}
            style={styles.searchInput}
          />
        </View>

        <View style={styles.quickSection}>
          <View style={styles.quickGrid}>
            {filteredQuickActions.map((item) => (
              <QuickActionTile
                key={item.key}
                title={item.title}
                icon={item.icon}
                onPress={() => handleQuickActionPress(item)}
              />
            ))}
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Son Kullanılanlar</Text>
          <Text style={styles.sectionHint}>
            {loading
              ? 'Yükleniyor'
              : `${filteredDocuments.length} belge${
                  selectedDocumentIds.length > 0
                    ? ` • ${selectedDocumentIds.length} seçili`
                    : ''
                }`}
          </Text>
        </View>

        {loading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.loadingText}>Belgeler yükleniyor...</Text>
          </View>
        ) : recentDocuments.length > 0 ? (
          <View style={styles.recentList}>
            {recentDocuments.map((document) => (
              <RecentDocumentCard
                key={document.id}
                document={document}
                selected={selectedDocumentIds.includes(document.id)}
                onToggleSelect={() => toggleDocumentSelection(document.id)}
                onShare={() => void handleShareDocument(document)}
                onView={() => handleOpenDocument(document.id)}
                onToWord={handleToWord}
              />
            ))}
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Henüz belge yok</Text>
            <Text style={styles.emptyText}>
              İlk taramayı başlatmak için üstteki Tara kısayolunu kullan.
            </Text>

            <Pressable
              onPress={() => navigation.navigate('ScanEntry', { initialMode: 'camera' })}
              style={({ pressed }) => [
                styles.emptyPrimaryButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.emptyPrimaryButtonText}>Taramayı Başlat</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      <BannerStrip hidden={isPro} />
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
  searchCard: {
    minHeight: 56,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    ...Shadows.sm,
  },
  searchInput: {
    flex: 1,
    minHeight: 56,
    color: colors.text,
    ...Typography.body,
  },
  quickSection: {
    gap: Spacing.md,
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: Spacing.md,
  },
  quickActionTile: {
    width: '23%',
    minHeight: 104,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    ...Shadows.sm,
  },
  quickActionIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionTitle: {
    ...Typography.bodySmall,
    color: colors.text,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 17,
  },
  sectionHeader: {
    marginTop: Spacing.xs,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  sectionTitle: {
    ...Typography.titleLarge,
    color: colors.text,
  },
  sectionHint: {
    ...Typography.bodySmall,
    color: colors.textTertiary,
    textAlign: 'right',
  },
  recentList: {
    gap: Spacing.md,
  },
  recentCard: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: Spacing.lg,
    ...Shadows.sm,
  },
  recentBodyRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: Spacing.md,
  },
  thumbnailWrap: {
    width: 86,
    height: 112,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  thumbnailPdfViewport: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  thumbnailPdf: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  thumbnailFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentMainColumn: {
    flex: 1,
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  recentCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  recentCardTextWrap: {
    flex: 1,
    gap: 4,
  },
  recentCardTitle: {
    ...Typography.titleSmall,
    color: colors.text,
  },
  recentCardMeta: {
    ...Typography.bodySmall,
    color: colors.textSecondary,
  },
  checkboxButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 2,
  },
  recentActionRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  inlineActionButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
  },
  inlineActionButtonPrimary: {
    flex: 1,
    minHeight: 42,
    borderRadius: Radius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
  },
  inlineActionText: {
    ...Typography.bodySmall,
    color: colors.text,
    fontWeight: '700',
  },
  inlineActionTextPrimary: {
    ...Typography.bodySmall,
    color: colors.onPrimary,
    fontWeight: '800',
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
  emptyCard: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: Spacing.xl,
    gap: Spacing.sm,
    ...Shadows.sm,
  },
  emptyTitle: {
    ...Typography.titleLarge,
    color: colors.text,
  },
  emptyText: {
    ...Typography.body,
    color: colors.textSecondary,
  },
  emptyPrimaryButton: {
    marginTop: Spacing.sm,
    minHeight: 50,
    borderRadius: Radius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  emptyPrimaryButtonText: {
    color: colors.onPrimary,
    fontWeight: '800',
    fontSize: 15,
  },
  cardPressed: {
    opacity: 0.94,
    transform: [{ scale: 0.997 }],
  },
  pressed: {
    opacity: 0.92,
  },
});