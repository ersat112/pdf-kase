// src/screens/documents/DocumentDetailScreen.tsx
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Screen } from '../../components/common/Screen';
import { LocalTrustBadge } from '../../components/trust/LocalTrustBadge';
import {
  getBillingPlanLabel,
  getPremiumGateFeatureLabel,
  getPremiumGateMessage,
  resolveBillingCapabilities,
  type PremiumCapabilityKey,
} from '../../modules/billing/billing-capabilities';
import type {
  DocumentAuditEntry,
  DocumentAuditStatus,
} from '../../modules/documents/document-audit.service';
import {
  listDocumentAuditEvents,
  logDocumentAuditEvent,
} from '../../modules/documents/document-audit.service';
import {
  exportDocumentToExcel,
  exportDocumentToPdf,
  exportDocumentToWord,
  extractDocumentText,
  getDocumentDetail,
  setDocumentFavorite,
  translateDocumentTextToTurkish,
  type DocumentDetail,
} from '../../modules/documents/document.service';
import type { RootScreenProps } from '../../navigation/types';
import { useBillingStore } from '../../store/useBillingStore';
import {
  Radius,
  Shadows,
  Spacing,
  Typography,
  colors,
} from '../../theme';

type ActionKey =
  | 'favorite'
  | 'editor'
  | 'ocr'
  | 'pdf'
  | 'word'
  | 'excel'
  | 'translate';

type TranslationPreview = {
  text: string;
  translatedAt: string;
  sourceLanguage: string | null;
};

function isFavorite(document: DocumentDetail) {
  return document.is_favorite === 1;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return 'Yok';
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return 'Yok';
  }

  return parsed.toLocaleString('tr-TR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getDocumentStatusLabel(document: DocumentDetail) {
  if (document.pdf_path && document.status === 'ready') {
    return 'PDF Hazır';
  }

  if (document.ocr_status === 'ready') {
    return 'OCR Hazır';
  }

  switch (document.status) {
    case 'draft':
      return 'Taslak';
    case 'ready':
      return 'Hazır';
    case 'exported':
      return 'PDF Oluşturuldu';
    default:
      return document.status;
  }
}

function getDocumentStatusTone(document: DocumentDetail) {
  if (document.pdf_path && document.status === 'ready') {
    return 'success' as const;
  }

  if (document.ocr_status === 'ready') {
    return 'accent' as const;
  }

  if (document.status === 'draft') {
    return 'muted' as const;
  }

  return 'default' as const;
}

function getAuditStatusLabel(status: DocumentAuditStatus) {
  switch (status) {
    case 'started':
      return 'Başladı';
    case 'completed':
      return 'Tamamlandı';
    case 'failed':
      return 'Hata';
    case 'requires_premium':
      return 'Premium gerekli';
    default:
      return status;
  }
}

function getAuditStatusTone(status: DocumentAuditStatus) {
  switch (status) {
    case 'completed':
      return 'success' as const;
    case 'failed':
      return 'danger' as const;
    case 'requires_premium':
      return 'warning' as const;
    case 'started':
      return 'accent' as const;
    default:
      return 'default' as const;
  }
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message.trim().length > 0
    ? error.message
    : fallback;
}

function InfoBadge({
  label,
  tone = 'default',
  icon,
}: {
  label: string;
  tone?: 'default' | 'success' | 'accent' | 'muted' | 'danger' | 'warning';
  icon?: React.ComponentProps<typeof Ionicons>['name'];
}) {
  return (
    <View
      style={[
        styles.infoBadge,
        tone === 'success' && styles.infoBadgeSuccess,
        tone === 'accent' && styles.infoBadgeAccent,
        tone === 'muted' && styles.infoBadgeMuted,
        tone === 'danger' && styles.infoBadgeDanger,
        tone === 'warning' && styles.infoBadgeWarning,
      ]}
    >
      {icon ? (
        <Ionicons
          name={icon}
          size={12}
          color={
            tone === 'success'
              ? colors.primary
              : tone === 'accent'
              ? '#60A5FA'
              : tone === 'danger'
              ? '#F87171'
              : tone === 'warning'
              ? '#FBBF24'
              : colors.textSecondary
          }
        />
      ) : null}
      <Text
        style={[
          styles.infoBadgeText,
          tone === 'success' && styles.infoBadgeTextSuccess,
          tone === 'accent' && styles.infoBadgeTextAccent,
          tone === 'muted' && styles.infoBadgeTextMuted,
          tone === 'danger' && styles.infoBadgeTextDanger,
          tone === 'warning' && styles.infoBadgeTextWarning,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

function ActionButton({
  icon,
  label,
  caption,
  disabled,
  loading,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  caption: string;
  disabled?: boolean;
  loading?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.actionButton,
        pressed && !(disabled || loading) && styles.pressed,
        (disabled || loading) && styles.actionButtonDisabled,
      ]}
    >
      <View style={styles.actionButtonIconWrap}>
        {loading ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Ionicons name={icon} size={18} color={colors.primary} />
        )}
      </View>

      <View style={styles.actionButtonTextWrap}>
        <Text style={styles.actionButtonLabel}>{label}</Text>
        <Text style={styles.actionButtonCaption}>{caption}</Text>
      </View>

      <Ionicons
        name="chevron-forward"
        size={18}
        color={colors.textTertiary}
      />
    </Pressable>
  );
}

function AuditRow({ item }: { item: DocumentAuditEntry }) {
  const tone = getAuditStatusTone(item.status);

  return (
    <View style={styles.auditRow}>
      <View style={styles.auditRowTop}>
        <Text style={styles.auditRowTitle}>{item.action_label}</Text>
        <InfoBadge label={getAuditStatusLabel(item.status)} tone={tone} />
      </View>

      <Text style={styles.auditRowMeta}>{formatDateTime(item.created_at)}</Text>

      {item.reason ? (
        <Text style={styles.auditRowReason}>{item.reason}</Text>
      ) : null}
    </View>
  );
}

export function DocumentDetailScreen({
  navigation,
  route,
}: RootScreenProps<'DocumentDetail'>) {
  const documentId = route.params.documentId;

  const billingHydrated = useBillingStore((state) => state.hydrated);
  const isPro = useBillingStore((state) => state.isPro);
  const plan = useBillingStore((state) => state.plan);
  const expiresAt = useBillingStore((state) => state.expiresAt);

  const [document, setDocument] = useState<DocumentDetail | null>(null);
  const [auditEntries, setAuditEntries] = useState<DocumentAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeActionKey, setActiveActionKey] = useState<ActionKey | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [translationPreview, setTranslationPreview] =
    useState<TranslationPreview | null>(null);

  const capabilities = useMemo(
    () =>
      resolveBillingCapabilities({
        isPro,
        plan,
        expiresAt,
      }),
    [expiresAt, isPro, plan],
  );

  const loadData = useCallback(
    async (showLoading = true) => {
      try {
        if (showLoading) {
          setLoading(true);
        }

        setErrorMessage(null);

        const [documentDetail, audits] = await Promise.all([
          getDocumentDetail(documentId),
          listDocumentAuditEvents(documentId, 12),
        ]);

        setDocument(documentDetail);
        setAuditEntries(audits);
      } catch (error) {
        console.warn('[DocumentDetail] Load failed:', error);
        setDocument(null);
        setAuditEntries([]);
        setErrorMessage(
          getErrorMessage(error, 'Belge detayı yüklenemedi.'),
        );
      } finally {
        if (showLoading) {
          setLoading(false);
        }
      }
    },
    [documentId],
  );

  useFocusEffect(
    useCallback(() => {
      void loadData(true);
    }, [loadData]),
  );

  useEffect(() => {
    setTranslationPreview(null);
  }, [documentId]);

  useEffect(() => {
    if (!document) {
      return;
    }

    navigation.setOptions({
      title: document.title,
    });
  }, [document, navigation]);

  const pageCount = document?.pages.length ?? 0;
  const hasPageBasedDocument = pageCount > 0;
  const statusTone = document ? getDocumentStatusTone(document) : 'default';
  const favorite = useMemo(
    () => (document ? isFavorite(document) : false),
    [document],
  );

  const pdfActionLabel = document?.pdf_path
    ? 'PDF yeniden üret'
    : 'PDF üret';
  const wordActionLabel = document?.word_path
    ? 'Word yeniden üret'
    : 'Word dışa aktar';

  const pdfActionCaption = !billingHydrated
    ? 'Premium durumu yükleniyor'
    : capabilities.canExportPdf
      ? document?.pdf_path
        ? 'Mevcut PDF çıktısını güncelle'
        : 'Güncel sayfalardan PDF oluştur'
      : 'Premium ile PDF kaydetmeyi aç';

  const wordActionCaption = !billingHydrated
    ? 'Premium durumu yükleniyor'
    : capabilities.canExportWord
      ? document?.word_path
        ? 'Mevcut Word çıktısını güncelle'
        : 'OCR metnini Word olarak hazırla'
      : 'Premium ile Word kaydetmeyi aç';

  const excelActionCaption = !billingHydrated
    ? 'Premium durumu yükleniyor'
    : capabilities.canExportExcel
      ? 'OCR metnini Excel olarak hazırla'
      : 'Premium ile Excel kaydetmeyi aç';

  const safeLogAudit = useCallback(
    async ({
      actionKey,
      actionLabel,
      status,
      reason,
      metadata,
    }: {
      actionKey: string;
      actionLabel: string;
      status: DocumentAuditStatus;
      reason?: string | null;
      metadata?: Record<string, unknown> | null;
    }) => {
      try {
        await logDocumentAuditEvent({
          documentId,
          actionKey,
          actionLabel,
          status,
          reason,
          metadata,
        });
      } catch (error) {
        console.warn('[DocumentDetail] Audit log failed:', error);
      }
    },
    [documentId],
  );

  const handlePremiumGate = useCallback(
    async ({
      capability,
      actionKey,
      actionLabel,
    }: {
      capability: PremiumCapabilityKey;
      actionKey: 'pdf' | 'word' | 'excel';
      actionLabel: string;
    }) => {
      const reason = `${getPremiumGateFeatureLabel(
        capability,
      )} özelliği premium gerektiriyor.`;

      await safeLogAudit({
        actionKey,
        actionLabel,
        status: 'requires_premium',
        reason,
      });

      Alert.alert(
        'Premium gerekli',
        getPremiumGateMessage(capability),
        [
          {
            text: 'Şimdi değil',
            style: 'cancel',
          },
          {
            text: "Premium'u gör",
            onPress: () => navigation.navigate('Pricing'),
          },
        ],
      );
    },
    [navigation, safeLogAudit],
  );

  const runAuditedAction = useCallback(
    async <T,>({
      actionKey,
      actionLabel,
      run,
      successMessage,
      successMetadata,
      onSuccess,
    }: {
      actionKey: Exclude<ActionKey, 'favorite' | 'editor'>;
      actionLabel: string;
      run: () => Promise<T>;
      successMessage: (result: T) => string;
      successMetadata?: (result: T) => Record<string, unknown> | null;
      onSuccess?: (result: T) => void | Promise<void>;
    }) => {
      setActiveActionKey(actionKey);

      await safeLogAudit({
        actionKey,
        actionLabel,
        status: 'started',
      });

      try {
        const result = await run();

        await safeLogAudit({
          actionKey,
          actionLabel,
          status: 'completed',
          metadata: successMetadata ? successMetadata(result) : null,
        });

        if (onSuccess) {
          await onSuccess(result);
        }

        await loadData(false);
        Alert.alert('Tamamlandı', successMessage(result));
      } catch (error) {
        const message = getErrorMessage(
          error,
          'İşlem sırasında beklenmeyen hata oluştu.',
        );

        await safeLogAudit({
          actionKey,
          actionLabel,
          status: 'failed',
          reason: message,
        });

        await loadData(false);
        Alert.alert('İşlem başarısız', message);
      } finally {
        setActiveActionKey(null);
      }
    },
    [loadData, safeLogAudit],
  );

  const handleToggleFavorite = useCallback(async () => {
    if (!document) {
      return;
    }

    const nextFavorite = !isFavorite(document);
    setActiveActionKey('favorite');

    try {
      await setDocumentFavorite(document.id, nextFavorite);
      await loadData(false);
    } catch (error) {
      Alert.alert(
        'Hata',
        getErrorMessage(error, 'Favori durumu güncellenemedi.'),
      );
    } finally {
      setActiveActionKey(null);
    }
  }, [document, loadData]);

  const handleOpenEditor = useCallback(() => {
    if (!document || !hasPageBasedDocument) {
      return;
    }

    navigation.navigate('PdfEditor', {
      documentId: document.id,
    });
  }, [document, hasPageBasedDocument, navigation]);

  const handleRunOcr = useCallback(async () => {
    if (!document || !hasPageBasedDocument) {
      return;
    }

    await runAuditedAction({
      actionKey: 'ocr',
      actionLabel: 'OCR çıkar',
      run: () => extractDocumentText(document.id),
      successMessage: (result) =>
        `${result.extractedPageCount} sayfadan metin çıkarıldı.`,
      successMetadata: (result) => ({
        extractedPageCount: result.extractedPageCount,
        extractedCharacterCount: result.extractedCharacterCount,
      }),
    });
  }, [document, hasPageBasedDocument, runAuditedAction]);

  const handleExportPdf = useCallback(async () => {
    if (!document || !hasPageBasedDocument) {
      return;
    }

    if (!billingHydrated) {
      return;
    }

    if (!capabilities.canExportPdf) {
      await handlePremiumGate({
        capability: 'export_pdf',
        actionKey: 'pdf',
        actionLabel: pdfActionLabel,
      });
      return;
    }

    await runAuditedAction({
      actionKey: 'pdf',
      actionLabel: pdfActionLabel,
      run: () => exportDocumentToPdf(document.id),
      successMessage: () =>
        document.pdf_path ? 'PDF yeniden oluşturuldu.' : 'PDF çıktısı oluşturuldu.',
      successMetadata: (result) => ({
        fileName: result.fileName,
        reExported: Boolean(document.pdf_path),
      }),
    });
  }, [
    billingHydrated,
    capabilities.canExportPdf,
    document,
    handlePremiumGate,
    hasPageBasedDocument,
    pdfActionLabel,
    runAuditedAction,
  ]);

  const handleExportWord = useCallback(async () => {
    if (!document || !hasPageBasedDocument) {
      return;
    }

    if (!billingHydrated) {
      return;
    }

    if (!capabilities.canExportWord) {
      await handlePremiumGate({
        capability: 'export_word',
        actionKey: 'word',
        actionLabel: wordActionLabel,
      });
      return;
    }

    await runAuditedAction({
      actionKey: 'word',
      actionLabel: wordActionLabel,
      run: () => exportDocumentToWord(document.id),
      successMessage: (result) =>
        document.word_path
          ? `${result.fileName} yeniden oluşturuldu.`
          : `${result.fileName} hazır.`,
      successMetadata: (result) => ({
        fileName: result.fileName,
        textLength: result.textLength,
        reExported: Boolean(document.word_path),
      }),
    });
  }, [
    billingHydrated,
    capabilities.canExportWord,
    document,
    handlePremiumGate,
    hasPageBasedDocument,
    runAuditedAction,
    wordActionLabel,
  ]);

  const handleExportExcel = useCallback(async () => {
    if (!document || !hasPageBasedDocument) {
      return;
    }

    if (!billingHydrated) {
      return;
    }

    if (!capabilities.canExportExcel) {
      await handlePremiumGate({
        capability: 'export_excel',
        actionKey: 'excel',
        actionLabel: 'Excel dışa aktar',
      });
      return;
    }

    await runAuditedAction({
      actionKey: 'excel',
      actionLabel: 'Excel dışa aktar',
      run: () => exportDocumentToExcel(document.id),
      successMessage: (result) => `${result.fileName} hazır.`,
      successMetadata: (result) => ({
        fileName: result.fileName,
        textLength: result.textLength,
      }),
    });
  }, [
    billingHydrated,
    capabilities.canExportExcel,
    document,
    handlePremiumGate,
    hasPageBasedDocument,
    runAuditedAction,
  ]);

  const handleTranslate = useCallback(async () => {
    if (!document || !hasPageBasedDocument) {
      return;
    }

    await runAuditedAction({
      actionKey: 'translate',
      actionLabel: 'Türkçeye çevir',
      run: () => translateDocumentTextToTurkish(document.id),
      successMessage: () => 'Türkçe çeviri hazır.',
      successMetadata: (result) => ({
        sourceLanguage: result.sourceLanguage,
        translatedLength: result.translatedText.length,
      }),
      onSuccess: (result) => {
        setTranslationPreview({
          text: result.translatedText,
          translatedAt: result.translatedAt,
          sourceLanguage: result.sourceLanguage,
        });
      },
    });
  }, [document, hasPageBasedDocument, runAuditedAction]);

  return (
    <Screen
      title="Belge Detayı"
      subtitle="Belgeyi incele, devam et ve son işlemleri yönet."
    >
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Belge detayı yükleniyor...</Text>
        </View>
      ) : errorMessage || !document ? (
        <View style={styles.errorCard}>
          <View style={styles.errorIconWrap}>
            <Ionicons
              name="alert-circle-outline"
              size={24}
              color="#F87171"
            />
          </View>
          <Text style={styles.errorTitle}>Belge açılamadı</Text>
          <Text style={styles.errorText}>
            {errorMessage ?? 'Belge kaydı bulunamadı.'}
          </Text>

          <Pressable
            onPress={() => void loadData(true)}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.primaryButtonText}>Tekrar dene</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <View style={styles.heroCard}>
            <View style={styles.heroHeader}>
              <View style={styles.thumbnailFrame}>
                {document.thumbnail_path ? (
                  <Image
                    source={{ uri: document.thumbnail_path }}
                    style={styles.thumbnail}
                  />
                ) : (
                  <View style={styles.thumbnailPlaceholder}>
                    <Ionicons
                      name="document-text-outline"
                      size={26}
                      color={colors.textTertiary}
                    />
                    <Text style={styles.thumbnailPlaceholderText}>
                      Önizleme yok
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.heroContent}>
                <View style={styles.heroTitleRow}>
                  <Text style={styles.heroTitle}>{document.title}</Text>

                  <Pressable
                    onPress={() => void handleToggleFavorite()}
                    disabled={activeActionKey !== null}
                    style={({ pressed }) => [
                      styles.favoriteButton,
                      pressed && activeActionKey === null && styles.pressed,
                      activeActionKey !== null && styles.actionButtonDisabled,
                    ]}
                  >
                    {activeActionKey === 'favorite' ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <Ionicons
                        name={favorite ? 'star' : 'star-outline'}
                        size={18}
                        color={favorite ? colors.primary : colors.textSecondary}
                      />
                    )}
                  </Pressable>
                </View>

                <Text style={styles.heroMeta}>
                  Güncellendi: {formatDateTime(document.updated_at)}
                </Text>

                <View style={styles.badgeRow}>
                  <InfoBadge
                    label={getDocumentStatusLabel(document)}
                    tone={statusTone}
                  />
                  <InfoBadge
                    label={`${pageCount} sayfa`}
                    tone="default"
                    icon="layers-outline"
                  />
                  <InfoBadge
                    label="LOCAL"
                    tone="muted"
                    icon="shield-checkmark-outline"
                  />
                  {favorite ? (
                    <InfoBadge label="Favori" tone="success" icon="star" />
                  ) : null}
                  {document.pdf_path ? (
                    <InfoBadge label="PDF Kayıtlı" tone="success" />
                  ) : null}
                  {document.word_path ? (
                    <InfoBadge label="WORD Kayıtlı" tone="accent" />
                  ) : null}
                  {document.collection_name ? (
                    <InfoBadge label={document.collection_name} tone="default" />
                  ) : null}
                  {document.tag_names.map((tag) => (
                    <InfoBadge key={tag} label={`#${tag}`} tone="default" />
                  ))}
                </View>
              </View>
            </View>

            <LocalTrustBadge />

            {!hasPageBasedDocument ? (
              <View style={styles.noticeCard}>
                <View style={styles.noticeIconWrap}>
                  <Ionicons
                    name="information-circle-outline"
                    size={18}
                    color="#60A5FA"
                  />
                </View>
                <View style={styles.noticeTextWrap}>
                  <Text style={styles.noticeTitle}>Dışarıdan PDF kayıt</Text>
                  <Text style={styles.noticeText}>
                    Bu kayıt dışarıdan PDF olarak içe aktarılmış. Sayfa bazlı
                    düzenleme, OCR ve yeniden export v1 akışı için sayfa tabanlı
                    belge gerekiyor.
                  </Text>
                </View>
              </View>
            ) : null}
          </View>

          <View style={styles.planCard}>
            <View style={styles.planHeader}>
              <View style={styles.planTextWrap}>
                <Text style={styles.planTitle}>
                  {isPro ? 'Premium aktif' : 'Free plan'}
                </Text>
                <Text style={styles.planText}>
                  Plan: {getBillingPlanLabel(plan)}
                  {expiresAt ? ` • Bitiş: ${formatDateTime(expiresAt)}` : ''}
                </Text>
              </View>

              <Pressable
                onPress={() => navigation.navigate('Pricing')}
                style={({ pressed }) => [
                  styles.planActionButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.planActionButtonText}>
                  {isPro ? 'Planı gör' : "Premium'u gör"}
                </Text>
              </Pressable>
            </View>

            {!billingHydrated ? (
              <View style={styles.inlineLoadingRow}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.inlineLoadingText}>
                  Premium durumu yükleniyor...
                </Text>
              </View>
            ) : (
              <View style={styles.capabilityRow}>
                <InfoBadge
                  label={capabilities.canSave ? 'Kaydetme Açık' : 'Kaydetme Kilitli'}
                  tone={capabilities.canSave ? 'success' : 'warning'}
                />
                <InfoBadge
                  label={capabilities.canShare ? 'Paylaşma Açık' : 'Paylaşma Kilitli'}
                  tone={capabilities.canShare ? 'success' : 'warning'}
                />
                <InfoBadge
                  label={capabilities.canRemoveAds ? 'Reklamsız' : 'Reklamlı'}
                  tone={capabilities.canRemoveAds ? 'success' : 'muted'}
                />
              </View>
            )}

            {!isPro ? (
              <Text style={styles.planHint}>
                Free kullanıcı tüm araçları deneyebilir. PDF / Word / Excel
                kaydetme ve paylaşma premium ile açılır.
              </Text>
            ) : (
              <Text style={styles.planHint}>
                Premium aktif. Export ve paylaşma yüzeyleri açık.
              </Text>
            )}
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Hızlı işlemler</Text>
            {activeActionKey ? (
              <Text style={styles.sectionHint}>İşlem sürüyor</Text>
            ) : (
              <Text style={styles.sectionHint}>Tek dokunuşla devam et</Text>
            )}
          </View>

          <View style={styles.actionList}>
            <ActionButton
              icon="create-outline"
              label="Editörde aç"
              caption="Kaşe, imza ve sayfa düzenine devam et"
              disabled={!hasPageBasedDocument || activeActionKey !== null}
              loading={activeActionKey === 'editor'}
              onPress={handleOpenEditor}
            />
            <ActionButton
              icon="scan-outline"
              label="OCR çıkar"
              caption="Sayfalardaki metni algıla"
              disabled={!hasPageBasedDocument || activeActionKey !== null}
              loading={activeActionKey === 'ocr'}
              onPress={() => void handleRunOcr()}
            />
            <ActionButton
              icon="document-outline"
              label={pdfActionLabel}
              caption={pdfActionCaption}
              disabled={
                !hasPageBasedDocument ||
                activeActionKey !== null ||
                !billingHydrated
              }
              loading={activeActionKey === 'pdf'}
              onPress={() => void handleExportPdf()}
            />
            <ActionButton
              icon="document-text-outline"
              label={wordActionLabel}
              caption={wordActionCaption}
              disabled={
                !hasPageBasedDocument ||
                activeActionKey !== null ||
                !billingHydrated
              }
              loading={activeActionKey === 'word'}
              onPress={() => void handleExportWord()}
            />
            <ActionButton
              icon="grid-outline"
              label="Excel dışa aktar"
              caption={excelActionCaption}
              disabled={
                !hasPageBasedDocument ||
                activeActionKey !== null ||
                !billingHydrated
              }
              loading={activeActionKey === 'excel'}
              onPress={() => void handleExportExcel()}
            />
            <ActionButton
              icon="language-outline"
              label="Türkçeye çevir"
              caption="Algılanan metni Türkçeye çevir"
              disabled={!hasPageBasedDocument || activeActionKey !== null}
              loading={activeActionKey === 'translate'}
              onPress={() => void handleTranslate()}
            />
          </View>

          <View style={styles.outputCard}>
            <View style={styles.outputHeader}>
              <Text style={styles.outputTitle}>Kayıt ve export durumu</Text>
              {!isPro ? (
                <InfoBadge label="Premium yüzeyi" tone="warning" />
              ) : (
                <InfoBadge label="Export açık" tone="success" />
              )}
            </View>

            <View style={styles.outputRow}>
              <Text style={styles.outputLabel}>PDF</Text>
              {document.pdf_path ? (
                <InfoBadge label="Hazır" tone="success" />
              ) : capabilities.canExportPdf ? (
                <InfoBadge label="Hazır değil" tone="muted" />
              ) : (
                <InfoBadge label="Premium gerekli" tone="warning" />
              )}
            </View>

            <View style={styles.outputRow}>
              <Text style={styles.outputLabel}>Word</Text>
              {document.word_path ? (
                <InfoBadge label="Hazır" tone="accent" />
              ) : capabilities.canExportWord ? (
                <InfoBadge label="Hazır değil" tone="muted" />
              ) : (
                <InfoBadge label="Premium gerekli" tone="warning" />
              )}
            </View>

            <View style={styles.outputRow}>
              <Text style={styles.outputLabel}>Excel</Text>
              {capabilities.canExportExcel ? (
                <InfoBadge label="İsteğe bağlı export" tone="accent" />
              ) : (
                <InfoBadge label="Premium gerekli" tone="warning" />
              )}
            </View>

            <View style={styles.outputRow}>
              <Text style={styles.outputLabel}>Paylaşma</Text>
              {capabilities.canShare ? (
                <InfoBadge label="Açık" tone="success" />
              ) : (
                <InfoBadge label="Premium gerekli" tone="warning" />
              )}
            </View>
          </View>

          {document.ocr_status === 'failed' && document.ocr_error ? (
            <View style={styles.resultCard}>
              <View style={styles.resultHeader}>
                <Text style={styles.resultTitle}>OCR hatası</Text>
                <InfoBadge label="Hata" tone="danger" />
              </View>
              <Text style={styles.resultText}>{document.ocr_error}</Text>
            </View>
          ) : null}

          {document.ocr_text ? (
            <View style={styles.resultCard}>
              <View style={styles.resultHeader}>
                <Text style={styles.resultTitle}>OCR önizleme</Text>
                <InfoBadge
                  label={document.ocr_status === 'ready' ? 'Hazır' : 'Bekliyor'}
                  tone={document.ocr_status === 'ready' ? 'success' : 'muted'}
                />
              </View>
              <Text style={styles.resultMeta}>
                OCR güncelleme: {formatDateTime(document.ocr_updated_at)}
              </Text>
              <Text style={styles.resultText} numberOfLines={8}>
                {document.ocr_text}
              </Text>
            </View>
          ) : null}

          {translationPreview ? (
            <View style={styles.resultCard}>
              <View style={styles.resultHeader}>
                <Text style={styles.resultTitle}>Türkçe çeviri önizleme</Text>
                <InfoBadge label="Hazır" tone="accent" />
              </View>
              <Text style={styles.resultMeta}>
                Kaynak dil: {translationPreview.sourceLanguage ?? 'Bilinmiyor'} •{' '}
                {formatDateTime(translationPreview.translatedAt)}
              </Text>
              <Text style={styles.resultText} numberOfLines={10}>
                {translationPreview.text}
              </Text>
            </View>
          ) : null}

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Sayfalar</Text>
            <Text style={styles.sectionHint}>
              {hasPageBasedDocument ? `${pageCount} kayıt` : 'Sayfa yok'}
            </Text>
          </View>

          {!hasPageBasedDocument ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>Sayfa önizlemesi yok</Text>
              <Text style={styles.emptyText}>
                Bu belge sayfa tabanlı değil. Düzenleme akışı için kamera veya
                görsel tabanlı belge kullan.
              </Text>
            </View>
          ) : (
            <View style={styles.pageList}>
              {document.pages.map((page, index) => (
                <Pressable
                  key={page.id}
                  onPress={handleOpenEditor}
                  disabled={activeActionKey !== null}
                  style={({ pressed }) => [
                    styles.pageCard,
                    pressed && activeActionKey === null && styles.pressed,
                  ]}
                >
                  <Image
                    source={{ uri: page.image_path }}
                    style={styles.pageThumbnail}
                  />

                  <View style={styles.pageContent}>
                    <Text style={styles.pageTitle}>Sayfa {index + 1}</Text>
                    <Text style={styles.pageMeta}>
                      Sıra: {page.page_order + 1}
                    </Text>
                  </View>

                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={colors.textTertiary}
                  />
                </Pressable>
              ))}
            </View>
          )}

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Son işlemler</Text>
            <Text style={styles.sectionHint}>{auditEntries.length} kayıt</Text>
          </View>

          {auditEntries.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>Henüz işlem geçmişi yok</Text>
              <Text style={styles.emptyText}>
                OCR, export veya çeviri çalıştırdığında burada son işlemler
                görünecek.
              </Text>
            </View>
          ) : (
            <View style={styles.auditList}>
              {auditEntries.map((item) => (
                <AuditRow key={item.id} item={item} />
              ))}
            </View>
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    gap: Spacing.md,
    marginBottom: Spacing.lg,
    ...Shadows.sm,
  },
  heroHeader: {
    flexDirection: 'row',
    gap: Spacing.md,
    alignItems: 'flex-start',
  },
  thumbnailFrame: {
    width: 96,
    height: 128,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    backgroundColor: '#0F141B',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  thumbnailPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 8,
  },
  thumbnailPlaceholderText: {
    color: colors.textTertiary,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  heroContent: {
    flex: 1,
    gap: 8,
  },
  heroTitleRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'flex-start',
  },
  heroTitle: {
    flex: 1,
    ...Typography.titleLarge,
    color: colors.text,
    lineHeight: 28,
  },
  favoriteButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroMeta: {
    ...Typography.bodySmall,
    color: colors.textSecondary,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  infoBadge: {
    minHeight: 30,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoBadgeSuccess: {
    backgroundColor: 'rgba(53, 199, 111, 0.12)',
    borderColor: 'rgba(53, 199, 111, 0.28)',
  },
  infoBadgeAccent: {
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    borderColor: 'rgba(59, 130, 246, 0.28)',
  },
  infoBadgeMuted: {
    backgroundColor: 'rgba(148, 163, 184, 0.12)',
    borderColor: 'rgba(148, 163, 184, 0.22)',
  },
  infoBadgeDanger: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: 'rgba(239, 68, 68, 0.24)',
  },
  infoBadgeWarning: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: 'rgba(245, 158, 11, 0.24)',
  },
  infoBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  infoBadgeTextSuccess: {
    color: colors.primary,
  },
  infoBadgeTextAccent: {
    color: '#60A5FA',
  },
  infoBadgeTextMuted: {
    color: colors.textSecondary,
  },
  infoBadgeTextDanger: {
    color: '#F87171',
  },
  infoBadgeTextWarning: {
    color: '#FBBF24',
  },
  noticeCard: {
    flexDirection: 'row',
    gap: Spacing.sm,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.24)',
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
    padding: Spacing.md,
  },
  noticeIconWrap: {
    paddingTop: 2,
  },
  noticeTextWrap: {
    flex: 1,
    gap: 4,
  },
  noticeTitle: {
    color: colors.text,
    fontWeight: '800',
    fontSize: 14,
  },
  noticeText: {
    color: colors.textSecondary,
    lineHeight: 20,
    fontSize: 13,
  },
  planCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    gap: Spacing.md,
    marginBottom: Spacing.lg,
    ...Shadows.sm,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  planTextWrap: {
    flex: 1,
    gap: 4,
  },
  planTitle: {
    ...Typography.titleSmall,
    color: colors.text,
  },
  planText: {
    ...Typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  planActionButton: {
    minHeight: 38,
    borderRadius: Radius.lg,
    backgroundColor: colors.primary,
    paddingHorizontal: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planActionButtonText: {
    color: colors.onPrimary,
    fontWeight: '800',
    fontSize: 13,
  },
  capabilityRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  planHint: {
    ...Typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  inlineLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inlineLoadingText: {
    ...Typography.bodySmall,
    color: colors.textSecondary,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    ...Typography.titleLarge,
    color: colors.text,
  },
  sectionHint: {
    ...Typography.bodySmall,
    color: colors.textTertiary,
  },
  actionList: {
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  actionButton: {
    minHeight: 64,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    ...Shadows.sm,
  },
  actionButtonDisabled: {
    opacity: 0.6,
  },
  actionButtonIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonTextWrap: {
    flex: 1,
    gap: 2,
  },
  actionButtonLabel: {
    color: colors.text,
    fontWeight: '800',
    fontSize: 15,
  },
  actionButtonCaption: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  outputCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
    ...Shadows.sm,
  },
  outputHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
    marginBottom: 4,
  },
  outputTitle: {
    ...Typography.titleSmall,
    color: colors.text,
  },
  outputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  outputLabel: {
    ...Typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: '700',
  },
  resultCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
    ...Shadows.sm,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  resultTitle: {
    ...Typography.titleSmall,
    color: colors.text,
  },
  resultMeta: {
    ...Typography.bodySmall,
    color: colors.textSecondary,
  },
  resultText: {
    color: colors.text,
    lineHeight: 22,
  },
  pageList: {
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  pageCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: Radius.xl,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    ...Shadows.sm,
  },
  pageThumbnail: {
    width: 54,
    height: 72,
    borderRadius: Radius.md,
    backgroundColor: '#0F141B',
  },
  pageContent: {
    flex: 1,
    gap: 4,
  },
  pageTitle: {
    color: colors.text,
    fontWeight: '800',
    fontSize: 15,
  },
  pageMeta: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  auditList: {
    gap: Spacing.sm,
  },
  auditRow: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: Radius.xl,
    padding: Spacing.md,
    gap: 6,
    ...Shadows.sm,
  },
  auditRowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.md,
  },
  auditRowTitle: {
    flex: 1,
    color: colors.text,
    fontWeight: '800',
    fontSize: 14,
  },
  auditRowMeta: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  auditRowReason: {
    color: colors.textSecondary,
    lineHeight: 20,
    fontSize: 13,
  },
  emptyCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
    ...Shadows.sm,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  emptyText: {
    color: colors.textSecondary,
    lineHeight: 22,
  },
  errorCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    gap: Spacing.md,
    ...Shadows.sm,
  },
  errorIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  errorText: {
    color: colors.textSecondary,
    lineHeight: 22,
  },
  primaryButton: {
    minHeight: 46,
    borderRadius: Radius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  primaryButtonText: {
    color: colors.onPrimary,
    fontWeight: '800',
    fontSize: 15,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 10,
  },
  loadingText: {
    color: colors.textSecondary,
  },
  pressed: {
    opacity: 0.92,
  },
});