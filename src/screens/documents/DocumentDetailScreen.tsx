import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { Screen } from '../../components/common/Screen';
import { useAdGate } from '../../hooks/useAdGate';
import {
  appendScannedPagesToDocument,
  autoCropDocumentPage,
  exportDocumentToPdf,
  extractDocumentText,
  getDocumentDetail,
  replaceDocumentPageFromScan,
  rotateDocumentPageLeft,
  type DocumentDetail,
} from '../../modules/documents/document.service';
import { launchNativeScanner } from '../../modules/scanner/scanner.service';
import type { RootStackParamList } from '../../navigation/types';
import { useBillingStore } from '../../store/useBillingStore';
import {
  Radius,
  Shadows,
  Spacing,
  Typography,
  colors,
} from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'DocumentDetail'>;

const DEFAULT_BUSY_MESSAGE = 'İşlem uygulanıyor...';
const WORD_MIME_TYPE =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message.trim().length > 0
    ? error.message
    : fallback;
}

function formatDate(value?: string | null) {
  if (!value) {
    return 'Tarih yok';
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return 'Tarih yok';
  }

  return parsed.toLocaleString('tr-TR');
}

function getOcrStatusLabel(status: DocumentDetail['ocr_status']) {
  switch (status) {
    case 'processing':
      return 'İşleniyor';
    case 'ready':
      return 'Hazır';
    case 'failed':
      return 'Hata';
    case 'idle':
    default:
      return 'Bekliyor';
  }
}

function buildPreviewText(value?: string | null) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return '';
  }

  if (trimmed.length <= 280) {
    return trimmed;
  }

  return `${trimmed.slice(0, 280).trimEnd()}…`;
}

function ActionPill({
  title,
  onPress,
  disabled,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.actionPill,
        disabled && styles.actionPillDisabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Text style={styles.actionPillText}>{title}</Text>
    </Pressable>
  );
}

function PrimaryButton({
  title,
  onPress,
  disabled,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.primaryButton,
        disabled && styles.primaryButtonDisabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Text style={styles.primaryButtonText}>{title}</Text>
    </Pressable>
  );
}

function SecondaryButton({
  title,
  onPress,
  disabled,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.secondaryButton,
        disabled && styles.secondaryButtonDisabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Text style={styles.secondaryButtonText}>{title}</Text>
    </Pressable>
  );
}

export function DocumentDetailScreen({ route, navigation }: Props) {
  const { documentId } = route.params;
  const { preloadInterstitial, runAfterTask } = useAdGate();
  const isPro = useBillingStore((state) => state.isPro);

  const [document, setDocument] = useState<DocumentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [busyMessage, setBusyMessage] = useState(DEFAULT_BUSY_MESSAGE);
  const [error, setError] = useState<string | null>(null);
  const [pagerWidth, setPagerWidth] = useState(0);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);

  const mountedRef = useRef(true);
  const busyRef = useRef(false);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const currentPage = document?.pages[currentPageIndex] ?? null;
  const ocrPreview = useMemo(() => buildPreviewText(document?.ocr_text), [document?.ocr_text]);

  const setBusyState = useCallback((value: boolean, message = DEFAULT_BUSY_MESSAGE) => {
    busyRef.current = value;

    if (mountedRef.current) {
      setBusy(value);
      setBusyMessage(message);
    }
  }, []);

  const resetBusyState = useCallback(() => {
    busyRef.current = false;

    if (mountedRef.current) {
      setBusy(false);
      setBusyMessage(DEFAULT_BUSY_MESSAGE);
    }
  }, []);

  const loadDocument = useCallback(async () => {
    try {
      if (mountedRef.current) {
        setLoading(true);
      }

      const next = await getDocumentDetail(documentId);

      if (!mountedRef.current) {
        return;
      }

      setDocument(next);
      setError(null);
      setCurrentPageIndex((current) => {
        if (next.pages.length === 0) {
          return 0;
        }

        return Math.min(current, next.pages.length - 1);
      });
    } catch (loadError) {
      if (!mountedRef.current) {
        return;
      }

      setDocument(null);
      setError(getErrorMessage(loadError, 'Belge yüklenemedi.'));
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [documentId]);

  useFocusEffect(
    useCallback(() => {
      preloadInterstitial();
      void loadDocument();
    }, [loadDocument, preloadInterstitial]),
  );

  const handleExtractText = useCallback(async () => {
    if (busyRef.current) {
      return;
    }

    if (!document?.pages.length) {
      Alert.alert('OCR kullanılamıyor', 'Bu belgede OCR için sayfa bulunamadı.');
      return;
    }

    try {
      setBusyState(true, 'Belgeden metin çıkarılıyor...');

      const result = await runAfterTask(async () => {
        const extraction = await extractDocumentText(documentId);
        await loadDocument();
        return extraction;
      });

      Alert.alert(
        'Metin çıkarıldı',
        `${result.extractedPageCount} sayfa işlendi.\n${result.extractedCharacterCount} karakter çıkarıldı.`,
      );
    } catch (actionError) {
      Alert.alert('Hata', getErrorMessage(actionError, 'Metin çıkarılamadı.'));
    } finally {
      resetBusyState();
    }
  }, [document?.pages.length, documentId, loadDocument, resetBusyState, runAfterTask, setBusyState]);

  const handleExportPdf = useCallback(async () => {
    if (busyRef.current) {
      return;
    }

    if (!document?.pages.length) {
      Alert.alert('PDF oluşturulamıyor', 'Bu belgede oluşturulacak sayfa yok.');
      return;
    }

    try {
      setBusyState(true, 'PDF hazırlanıyor...');

      const result = await runAfterTask(async () => {
        const exportResult = await exportDocumentToPdf(documentId);
        await loadDocument();
        return exportResult;
      });

      Alert.alert('PDF hazır', result.fileName);
    } catch (actionError) {
      Alert.alert('Hata', getErrorMessage(actionError, 'PDF oluşturulamadı.'));
    } finally {
      resetBusyState();
    }
  }, [document?.pages.length, documentId, loadDocument, resetBusyState, runAfterTask, setBusyState]);

  const handleSharePdf = useCallback(async () => {
    if (!document?.pdf_path) {
      Alert.alert('PDF yok', 'Önce PDF oluştur.');
      return;
    }

    try {
      setBusyState(true, 'Paylaşım hazırlanıyor...');

      const isAvailable = await Sharing.isAvailableAsync();

      if (!isAvailable) {
        Alert.alert('Paylaşım yok', 'Bu cihazda paylaşım desteklenmiyor.');
        return;
      }

      await Sharing.shareAsync(document.pdf_path, {
        mimeType: 'application/pdf',
        dialogTitle: document.title,
      });
    } catch (shareError) {
      Alert.alert('Hata', getErrorMessage(shareError, 'PDF paylaşılamadı.'));
    } finally {
      resetBusyState();
    }
  }, [document, resetBusyState, setBusyState]);

  const handleShareWord = useCallback(async () => {
    if (!document?.word_path) {
      Alert.alert('Word yok', 'Önce Word çıktısı oluştur.');
      return;
    }

    try {
      setBusyState(true, 'Word paylaşımı hazırlanıyor...');

      const isAvailable = await Sharing.isAvailableAsync();

      if (!isAvailable) {
        Alert.alert('Paylaşım yok', 'Bu cihazda paylaşım desteklenmiyor.');
        return;
      }

      await Sharing.shareAsync(document.word_path, {
        mimeType: WORD_MIME_TYPE,
        dialogTitle: `${document.title}.docx`,
      });
    } catch (shareError) {
      Alert.alert('Hata', getErrorMessage(shareError, 'Word paylaşılamadı.'));
    } finally {
      resetBusyState();
    }
  }, [document?.title, document?.word_path, resetBusyState, setBusyState]);

  const handleRetakePage = useCallback(async () => {
    if (busyRef.current || !currentPage) {
      return;
    }

    try {
      setBusyState(true, 'Tarayıcı açılıyor...');

      const result = await launchNativeScanner();

      if (result.status === 'cancel' || result.pages.length === 0) {
        return;
      }

      await replaceDocumentPageFromScan(currentPage.id, result.pages[0].normalizedUri);
      await loadDocument();
      Alert.alert('Tamamlandı', 'Seçili sayfa yeniden alındı.');
    } catch (actionError) {
      Alert.alert('Hata', getErrorMessage(actionError, 'Sayfa yeniden alınamadı.'));
    } finally {
      resetBusyState();
    }
  }, [currentPage, loadDocument, resetBusyState, setBusyState]);

  const handleRotateLeft = useCallback(async () => {
    if (busyRef.current || !currentPage) {
      return;
    }

    try {
      setBusyState(true, 'Sayfa sola döndürülüyor...');
      await rotateDocumentPageLeft(currentPage.id);
      await loadDocument();
    } catch (actionError) {
      Alert.alert('Hata', getErrorMessage(actionError, 'Sayfa döndürülemedi.'));
    } finally {
      resetBusyState();
    }
  }, [currentPage, loadDocument, resetBusyState, setBusyState]);

  const handleAutoCrop = useCallback(async () => {
    if (busyRef.current || !currentPage) {
      return;
    }

    try {
      setBusyState(true, 'Sayfa otomatik kırpılıyor...');
      await autoCropDocumentPage(currentPage.id);
      await loadDocument();
      Alert.alert('Tamamlandı', 'Sayfaya otomatik kırpma uygulandı.');
    } catch (actionError) {
      Alert.alert('Hata', getErrorMessage(actionError, 'Sayfa kırpılamadı.'));
    } finally {
      resetBusyState();
    }
  }, [currentPage, loadDocument, resetBusyState, setBusyState]);

  const handleAddPage = useCallback(async () => {
    if (busyRef.current || !document) {
      return;
    }

    try {
      setBusyState(true, 'Yeni sayfa için tarayıcı açılıyor...');

      const result = await launchNativeScanner();

      if (result.status === 'cancel' || result.pages.length === 0) {
        return;
      }

      await appendScannedPagesToDocument(
        document.id,
        result.pages.map((page) => page.normalizedUri),
      );
      await loadDocument();
      setCurrentPageIndex(document.pages.length);
    } catch (actionError) {
      Alert.alert('Hata', getErrorMessage(actionError, 'Yeni sayfa eklenemedi.'));
    } finally {
      resetBusyState();
    }
  }, [document, loadDocument, resetBusyState, setBusyState]);

  const handleOpenSignaturePad = useCallback(() => {
    if (!currentPage || busyRef.current) {
      return;
    }

    navigation.navigate('SignaturePad', {
      documentId,
      pageId: currentPage.id,
    });
  }, [currentPage, documentId, navigation]);

  const handleOpenSmartErase = useCallback(() => {
    if (!currentPage || busyRef.current) {
      return;
    }

    navigation.navigate('SmartErase', {
      documentId,
      pageId: currentPage.id,
    });
  }, [currentPage, documentId, navigation]);

  const handlePagerLayout = useCallback((event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout;
    setPagerWidth(width);
  }, []);

  const handlePagerScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (pagerWidth <= 0 || !document) {
        return;
      }

      const offsetX = event.nativeEvent.contentOffset.x;
      const nextIndex = Math.round(offsetX / pagerWidth);

      if (nextIndex < document.pages.length) {
        setCurrentPageIndex(nextIndex);
      }
    },
    [document, pagerWidth],
  );

  if (loading) {
    return (
      <Screen title="Belge Detayı" subtitle="Tarama ekranı hazırlanıyor...">
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.centerStateText}>Belge yükleniyor...</Text>
        </View>
      </Screen>
    );
  }

  if (!document) {
    return (
      <Screen title="Belge Detayı" subtitle="Belge açılamadı">
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>Belge yüklenemedi</Text>
          <Text style={styles.errorText}>{error ?? 'Beklenmeyen hata oluştu.'}</Text>
          <View style={styles.errorActions}>
            <SecondaryButton title="Tekrar dene" onPress={() => void loadDocument()} />
            <SecondaryButton title="Geri dön" onPress={() => navigation.goBack()} />
          </View>
        </View>
      </Screen>
    );
  }

  if (!document.pages.length) {
    return (
      <Screen title={document.title} subtitle="Bu kayıt dışarıdan PDF olarak içe aktarılmış.">
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>Sayfa tabanlı düzenleme yok</Text>
          <Text style={styles.errorText}>
            Bu ekrandaki tarama düzenleme araçları sayfalı belgeler için çalışır.
          </Text>
          <View style={styles.errorActions}>
            <SecondaryButton title="PDF paylaş" onPress={() => void handleSharePdf()} />
            <SecondaryButton title="Belgelerime dön" onPress={() => navigation.navigate('Documents')} />
          </View>
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      title={document.title}
      subtitle={`Sayfa ${Math.min(currentPageIndex + 1, document.pages.length)} / ${document.pages.length} • OCR ${getOcrStatusLabel(document.ocr_status)}`}
    >
      <View style={styles.summaryCard}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>OCR</Text>
          <Text style={styles.summaryValue}>{getOcrStatusLabel(document.ocr_status)}</Text>
        </View>

        <View style={styles.summaryDivider} />

        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>PDF</Text>
          <Text style={styles.summaryValue}>{document.pdf_path ? 'Hazır' : 'Yok'}</Text>
        </View>

        <View style={styles.summaryDivider} />

        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Plan</Text>
          <Text style={styles.summaryValue}>{isPro ? 'Premium' : 'Free'}</Text>
        </View>
      </View>

      {!isPro ? (
        <View style={styles.noticeCard}>
          <Text style={styles.noticeTitle}>Free sürüm</Text>
          <Text style={styles.noticeText}>
            Free kullanımda oluşturulan PDF çıktısına filigran eklenir.
          </Text>
        </View>
      ) : null}

      <View style={styles.pagerCard} onLayout={handlePagerLayout}>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handlePagerScrollEnd}
          scrollEventThrottle={16}
        >
          {document.pages.map((page, index) => (
            <View
              key={page.id}
              style={[
                styles.pageSlide,
                {
                  width: Math.max(1, pagerWidth),
                },
              ]}
            >
              <View style={styles.pageTopRow}>
                <Text style={styles.pageTitle}>Sayfa {index + 1}</Text>
                {index === currentPageIndex ? (
                  <View style={styles.activeBadge}>
                    <Text style={styles.activeBadgeText}>Aktif</Text>
                  </View>
                ) : null}
              </View>

              <Image
                source={{ uri: page.image_path }}
                resizeMode="contain"
                style={styles.pageImage}
              />
            </View>
          ))}

          <View
            style={[
              styles.pageSlide,
              {
                width: Math.max(1, pagerWidth),
              },
            ]}
          >
            <View style={styles.addPageCard}>
              <Text style={styles.addPageTitle}>Yeni sayfa ekle</Text>
              <Text style={styles.addPageText}>
                Belgenin sonuna yeni tarama sayfası eklemek için dokun.
              </Text>
              <PrimaryButton title="Yeni sayfa ekle" onPress={() => void handleAddPage()} disabled={busy} />
            </View>
          </View>
        </ScrollView>
      </View>

      <View style={styles.bottomToolbarCard}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.bottomToolbarRow}
        >
          <ActionPill title="Tekrar al" onPress={() => void handleRetakePage()} disabled={busy || !currentPage} />
          <ActionPill title="Sola döndür" onPress={() => void handleRotateLeft()} disabled={busy || !currentPage} />
          <ActionPill title="Kırp" onPress={() => void handleAutoCrop()} disabled={busy || !currentPage} />
          <ActionPill title="Akıllı Sil" onPress={handleOpenSmartErase} disabled={busy || !currentPage} />
          <ActionPill title="Metin Çıkar" onPress={() => void handleExtractText()} disabled={busy || !currentPage} />
          <ActionPill title="İmzala" onPress={handleOpenSignaturePad} disabled={busy || !currentPage} />
        </ScrollView>
      </View>

      {busy ? (
        <View style={styles.busyRow}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.busyText}>{busyMessage}</Text>
        </View>
      ) : null}

      <View style={styles.outputCard}>
        <Text style={styles.outputTitle}>Çıktılar</Text>

        <View style={styles.outputActions}>
          <PrimaryButton title={document.pdf_path ? 'PDF güncelle' : 'PDF oluştur'} onPress={() => void handleExportPdf()} disabled={busy} />
          <SecondaryButton title="PDF paylaş" onPress={() => void handleSharePdf()} disabled={busy || !document.pdf_path} />
          <SecondaryButton title="Word paylaş" onPress={() => void handleShareWord()} disabled={busy || !document.word_path} />
          <SecondaryButton title="Kaşe editörünü aç" onPress={() => navigation.navigate('PdfEditor', { documentId })} disabled={busy} />
        </View>
      </View>

      <View style={styles.metaCard}>
        <Text style={styles.metaTitle}>Belge bilgileri</Text>
        <Text style={styles.metaText}>OCR güncelleme: {formatDate(document.ocr_updated_at)}</Text>
        <Text style={styles.metaText}>Belge güncelleme: {formatDate(document.updated_at)}</Text>
        {ocrPreview ? <Text style={styles.ocrPreview}>{ocrPreview}</Text> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centerState: {
    paddingVertical: 48,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  centerStateText: {
    ...Typography.body,
    color: colors.textSecondary,
  },
  summaryCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    flexDirection: 'row',
    alignItems: 'stretch',
    ...Shadows.sm,
  },
  summaryItem: {
    flex: 1,
    gap: 6,
  },
  summaryLabel: {
    ...Typography.caption,
    color: colors.textTertiary,
    fontWeight: '700',
  },
  summaryValue: {
    ...Typography.body,
    color: colors.text,
    fontWeight: '800',
  },
  summaryDivider: {
    width: 1,
    backgroundColor: colors.border,
    marginHorizontal: Spacing.md,
  },
  noticeCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  noticeTitle: {
    ...Typography.titleSmall,
    color: colors.text,
    marginBottom: 6,
  },
  noticeText: {
    ...Typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  pagerCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  pageSlide: {
    padding: Spacing.lg,
  },
  pageTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  pageTitle: {
    ...Typography.titleSmall,
    color: colors.text,
  },
  activeBadge: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
  },
  activeBadgeText: {
    ...Typography.caption,
    color: colors.textSecondary,
    fontWeight: '700',
  },
  pageImage: {
    width: '100%',
    height: 430,
    borderRadius: Radius.lg,
    backgroundColor: '#0F141B',
  },
  addPageCard: {
    minHeight: 430,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  addPageTitle: {
    ...Typography.titleLarge,
    color: colors.text,
    marginBottom: Spacing.sm,
  },
  addPageText: {
    ...Typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.lg,
  },
  bottomToolbarCard: {
    marginBottom: Spacing.md,
  },
  bottomToolbarRow: {
    gap: Spacing.sm,
    paddingRight: Spacing.md,
  },
  actionPill: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: Radius.full,
    paddingVertical: 12,
    paddingHorizontal: 16,
    ...Shadows.sm,
  },
  actionPillDisabled: {
    opacity: 0.55,
  },
  actionPillText: {
    color: colors.text,
    fontWeight: '800',
    fontSize: 14,
  },
  busyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  busyText: {
    ...Typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: '700',
  },
  outputCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  outputTitle: {
    ...Typography.titleSmall,
    color: colors.text,
    marginBottom: Spacing.md,
  },
  outputActions: {
    gap: Spacing.sm,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: Radius.xl,
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: colors.onPrimary,
    textAlign: 'center',
    fontWeight: '800',
    fontSize: 15,
  },
  secondaryButton: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: Radius.xl,
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  secondaryButtonDisabled: {
    opacity: 0.55,
  },
  secondaryButtonText: {
    color: colors.text,
    textAlign: 'center',
    fontWeight: '700',
    fontSize: 15,
  },
  metaCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    ...Shadows.sm,
  },
  metaTitle: {
    ...Typography.titleSmall,
    color: colors.text,
    marginBottom: Spacing.sm,
  },
  metaText: {
    ...Typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  ocrPreview: {
    ...Typography.bodySmall,
    color: colors.text,
    lineHeight: 20,
    marginTop: Spacing.sm,
  },
  errorCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    ...Shadows.sm,
  },
  errorTitle: {
    ...Typography.titleSmall,
    color: colors.text,
    marginBottom: Spacing.sm,
  },
  errorText: {
    ...Typography.body,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  errorActions: {
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  pressed: {
    opacity: 0.92,
  },
});