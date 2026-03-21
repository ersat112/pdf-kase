// src/screens/documents/DocumentDetailScreen.tsx
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DocumentBottomActionDock } from '../../components/documents/DocumentBottomActionDock';
import { DocumentPageStrip } from '../../components/documents/DocumentPageStrip';
import { DocumentPipelineSummaryCard } from '../../components/documents/DocumentPipelineSummaryCard';
import { LocalTrustBadge } from '../../components/trust/LocalTrustBadge';
import {
  getBillingPlanLabel,
  getPremiumGateFeatureLabel,
  getPremiumGateMessage,
  resolveBillingCapabilities,
  type PremiumCapabilityKey,
} from '../../modules/billing/billing-capabilities';
import {
  documentActionLabels,
  documentDetailCopy,
  resolveDocumentPlanActionLabel,
  resolveDocumentPlanHint,
  resolveDocumentPlanTitle,
  resolveDocumentPrintDockCaption,
  resolveDocumentShareDockCaption,
  resolveDocumentWordDockCaption,
  resolveExcelOutputCopy,
  resolveExcelPrimaryActionCopy,
  resolveNextStepCopy,
  resolvePdfOutputCopy,
  resolvePdfPrimaryActionCopy,
  resolveShareSummaryCopy,
  resolveWordOutputCopy,
  resolveWordPrimaryActionCopy,
} from '../../modules/documents/document-action-copy';
import type {
  DocumentAuditEntry,
  DocumentAuditStatus,
} from '../../modules/documents/document-audit.service';
import {
  listDocumentAuditEvents,
  logDocumentAuditEvent,
} from '../../modules/documents/document-audit.service';
import {
  buildDocumentDetailPipelineSummary,
  resolveDocumentIsFavorite,
  resolveDocumentPageCount,
  resolveDocumentPdfPath,
  resolveDocumentStatusLabel,
  resolveDocumentStatusTone,
  resolveDocumentThumbnailPath,
  resolveDocumentTitle,
  resolveDocumentUpdatedAt,
  resolveDocumentWordPath,
} from '../../modules/documents/document-presentation';
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
import { getTranslationRuntimeDisplayLabel } from '../../modules/translation/translation-runtime-config.service';
import type { RootScreenProps } from '../../navigation/types';
import { useBillingStore } from '../../store/useBillingStore';
import {
  Layout,
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
  | 'translate'
  | 'share_pdf'
  | 'share_word';

type TranslationPreview = {
  text: string;
  translatedAt: string;
  sourceLanguage: string | null;
  provider: string;
};

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

function OutputStatusRow({
  title,
  description,
  badgeLabel,
  badgeTone,
  actionLabel,
  actionDisabled,
  actionLoading,
  onPress,
}: {
  title: string;
  description: string;
  badgeLabel: string;
  badgeTone: 'default' | 'success' | 'accent' | 'muted' | 'danger' | 'warning';
  actionLabel?: string | null;
  actionDisabled?: boolean;
  actionLoading?: boolean;
  onPress?: () => void;
}) {
  return (
    <View style={styles.outputStatusRow}>
      <View style={styles.outputStatusTextWrap}>
        <View style={styles.outputStatusTopRow}>
          <Text style={styles.outputStatusTitle}>{title}</Text>
          <InfoBadge label={badgeLabel} tone={badgeTone} />
        </View>
        <Text style={styles.outputStatusDescription}>{description}</Text>
      </View>

      {actionLabel && onPress ? (
        <Pressable
          onPress={onPress}
          disabled={actionDisabled || actionLoading}
          style={({ pressed }) => [
            styles.outputActionButton,
            pressed && !(actionDisabled || actionLoading) && styles.pressed,
            (actionDisabled || actionLoading) && styles.actionButtonDisabled,
          ]}
        >
          {actionLoading ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Text style={styles.outputActionButtonText}>{actionLabel}</Text>
          )}
        </Pressable>
      ) : null}
    </View>
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
  const [selectedPageIndex, setSelectedPageIndex] = useState(0);

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
      title: resolveDocumentTitle(document),
    });
  }, [document, navigation]);

  useEffect(() => {
    setSelectedPageIndex(0);
  }, [documentId, document?.id]);

  const documentPages = useMemo(
    () => (document && Array.isArray(document.pages) ? document.pages : []),
    [document],
  );

  useEffect(() => {
    if (selectedPageIndex < documentPages.length) {
      return;
    }

    setSelectedPageIndex(0);
  }, [documentPages.length, selectedPageIndex]);

  const pageCount = document ? resolveDocumentPageCount(document) : 0;
  const hasPageBasedDocument = pageCount > 0;
  const statusTone = document ? resolveDocumentStatusTone(document) : 'default';
  const favorite = useMemo(
    () => (document ? resolveDocumentIsFavorite(document) : false),
    [document],
  );
  const documentTitle = document ? resolveDocumentTitle(document) : 'Belge';
  const documentUpdatedAt = document ? resolveDocumentUpdatedAt(document) : null;
  const documentPdfPath = document ? resolveDocumentPdfPath(document) : null;
  const documentWordPath = document ? resolveDocumentWordPath(document) : null;
  const documentThumbnailPath = document
    ? resolveDocumentThumbnailPath(document)
    : null;

  const selectedPage = documentPages[selectedPageIndex] ?? null;
  const previewImageUri = selectedPage?.image_path ?? documentThumbnailPath ?? null;

  const pdfActionCopy = useMemo(
    () =>
      resolvePdfPrimaryActionCopy({
        billingHydrated,
        canExport: capabilities.canExportPdf,
        hasFile: Boolean(documentPdfPath),
      }),
    [billingHydrated, capabilities.canExportPdf, documentPdfPath],
  );

  const wordActionCopy = useMemo(
    () =>
      resolveWordPrimaryActionCopy({
        billingHydrated,
        canExport: capabilities.canExportWord,
        hasFile: Boolean(documentWordPath),
      }),
    [billingHydrated, capabilities.canExportWord, documentWordPath],
  );

  const excelActionCopy = useMemo(
    () =>
      resolveExcelPrimaryActionCopy({
        billingHydrated,
        canExport: capabilities.canExportExcel,
      }),
    [billingHydrated, capabilities.canExportExcel],
  );

  const shareSummary = useMemo(
    () =>
      resolveShareSummaryCopy({
        billingHydrated,
        canShare: capabilities.canShare,
        hasPdf: Boolean(documentPdfPath),
        hasWord: Boolean(documentWordPath),
      }),
    [
      billingHydrated,
      capabilities.canShare,
      documentPdfPath,
      documentWordPath,
    ],
  );

  const nextStepCard = useMemo(
    () =>
      resolveNextStepCopy({
        hasPageBasedDocument,
        hasPdf: Boolean(documentPdfPath),
        canExportPdf: capabilities.canExportPdf,
        canShare: capabilities.canShare,
      }),
    [
      capabilities.canExportPdf,
      capabilities.canShare,
      documentPdfPath,
      hasPageBasedDocument,
    ],
  );

  const pdfOutputCopy = useMemo(
    () =>
      resolvePdfOutputCopy({
        billingHydrated,
        canExport: capabilities.canExportPdf,
        canShare: capabilities.canShare,
        hasFile: Boolean(documentPdfPath),
      }),
    [
      billingHydrated,
      capabilities.canExportPdf,
      capabilities.canShare,
      documentPdfPath,
    ],
  );

  const wordOutputCopy = useMemo(
    () =>
      resolveWordOutputCopy({
        billingHydrated,
        canExport: capabilities.canExportWord,
        canShare: capabilities.canShare,
        hasFile: Boolean(documentWordPath),
      }),
    [
      billingHydrated,
      capabilities.canExportWord,
      capabilities.canShare,
      documentWordPath,
    ],
  );

  const excelOutputCopy = useMemo(
    () =>
      resolveExcelOutputCopy({
        billingHydrated,
        canExport: capabilities.canExportExcel,
      }),
    [billingHydrated, capabilities.canExportExcel],
  );

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
      actionKey: ActionKey;
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
            text: documentActionLabels.openPremium,
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
      actionKey: Exclude<ActionKey, 'favorite' | 'editor' | 'share_pdf' | 'share_word'>;
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

    const nextFavorite = !resolveDocumentIsFavorite(document);
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

  const handleOpenDocuments = useCallback(() => {
    navigation.navigate('Documents');
  }, [navigation]);

  const handleShareFile = useCallback(
    async ({
      fileUri,
      actionKey,
      actionLabel,
      mimeType,
      uti,
    }: {
      fileUri: string;
      actionKey: 'share_pdf' | 'share_word';
      actionLabel: string;
      mimeType: string;
      uti?: string;
    }) => {
      if (!billingHydrated) {
        return;
      }

      if (!capabilities.canShare) {
        await handlePremiumGate({
          capability: 'share',
          actionKey,
          actionLabel,
        });
        return;
      }

      setActiveActionKey(actionKey);

      await safeLogAudit({
        actionKey,
        actionLabel,
        status: 'started',
      });

      try {
        const available = await Sharing.isAvailableAsync();

        if (!available) {
          throw new Error('Bu cihazda sistem paylaşımı kullanılamıyor.');
        }

        await Sharing.shareAsync(fileUri, {
          dialogTitle: `${documentTitle} paylaş`,
          mimeType,
          UTI: uti,
        });

        await safeLogAudit({
          actionKey,
          actionLabel,
          status: 'completed',
          metadata: {
            fileUri,
            mimeType,
          },
        });
      } catch (error) {
        const message = getErrorMessage(error, 'Dosya paylaşılamadı.');

        await safeLogAudit({
          actionKey,
          actionLabel,
          status: 'failed',
          reason: message,
        });

        Alert.alert('Paylaşım başarısız', message);
      } finally {
        setActiveActionKey(null);
      }
    },
    [
      billingHydrated,
      capabilities.canShare,
      documentTitle,
      handlePremiumGate,
      safeLogAudit,
    ],
  );

  const handleSharePdf = useCallback(async () => {
    if (!documentPdfPath) {
      return;
    }

    await handleShareFile({
      fileUri: documentPdfPath,
      actionKey: 'share_pdf',
      actionLabel: documentActionLabels.share,
      mimeType: 'application/pdf',
      uti: 'com.adobe.pdf',
    });
  }, [documentPdfPath, handleShareFile]);

  const handleShareWord = useCallback(async () => {
    if (!documentWordPath) {
      return;
    }

    await handleShareFile({
      fileUri: documentWordPath,
      actionKey: 'share_word',
      actionLabel: documentActionLabels.share,
      mimeType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      uti: 'org.openxmlformats.wordprocessingml.document',
    });
  }, [documentWordPath, handleShareFile]);

  const handleRunOcr = useCallback(async () => {
    if (!document || !hasPageBasedDocument) {
      return;
    }

    await runAuditedAction({
      actionKey: 'ocr',
      actionLabel: documentActionLabels.ocr,
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
        actionLabel: pdfActionCopy.label,
      });
      return;
    }

    await runAuditedAction({
      actionKey: 'pdf',
      actionLabel: pdfActionCopy.label,
      run: () => exportDocumentToPdf(document.id),
      successMessage: () =>
        documentPdfPath ? 'PDF yeniden oluşturuldu.' : 'PDF çıktısı oluşturuldu.',
      successMetadata: (result) => ({
        fileName: result.fileName,
        reExported: Boolean(documentPdfPath),
      }),
    });
  }, [
    billingHydrated,
    capabilities.canExportPdf,
    document,
    documentPdfPath,
    handlePremiumGate,
    hasPageBasedDocument,
    pdfActionCopy.label,
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
        actionLabel: wordActionCopy.label,
      });
      return;
    }

    await runAuditedAction({
      actionKey: 'word',
      actionLabel: wordActionCopy.label,
      run: () => exportDocumentToWord(document.id),
      successMessage: (result) =>
        documentWordPath
          ? `${result.fileName} yeniden oluşturuldu.`
          : `${result.fileName} hazır.`,
      successMetadata: (result) => ({
        fileName: result.fileName,
        textLength: result.textLength,
        reExported: Boolean(documentWordPath),
      }),
    });
  }, [
    billingHydrated,
    capabilities.canExportWord,
    document,
    documentWordPath,
    handlePremiumGate,
    hasPageBasedDocument,
    runAuditedAction,
    wordActionCopy.label,
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
        actionLabel: excelActionCopy.label,
      });
      return;
    }

    await runAuditedAction({
      actionKey: 'excel',
      actionLabel: excelActionCopy.label,
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
    excelActionCopy.label,
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
      actionLabel: documentActionLabels.translate,
      run: () => translateDocumentTextToTurkish(document.id),
      successMessage: () => 'Türkçe çeviri hazır.',
      successMetadata: (result) => ({
        provider: result.provider,
        sourceLanguage: result.sourceLanguage,
        translatedLength: result.translatedText.length,
      }),
      onSuccess: (result) => {
        setTranslationPreview({
          text: result.translatedText,
          translatedAt: result.translatedAt,
          sourceLanguage: result.sourceLanguage,
          provider: getTranslationRuntimeDisplayLabel(result.provider),
        });
      },
    });
  }, [document, hasPageBasedDocument, runAuditedAction]);

  const handlePrimaryShare = useCallback(async () => {
    if (documentPdfPath) {
      await handleSharePdf();
      return;
    }

    await handleExportPdf();
  }, [documentPdfPath, handleExportPdf, handleSharePdf]);

  const handlePrintSurface = useCallback(async () => {
    if (documentPdfPath) {
      await handleSharePdf();
      return;
    }

    await handleExportPdf();
  }, [documentPdfPath, handleExportPdf, handleSharePdf]);

  const pipelineSummary = useMemo(
    () =>
      buildDocumentDetailPipelineSummary({
        document,
        pageCount,
        actionDisabled: activeActionKey !== null,
        onOpenDocuments: handleOpenDocuments,
        onOpenEditor: handleOpenEditor,
        onRunOcr: () => {
          void handleRunOcr();
        },
      }),
    [
      activeActionKey,
      document,
      handleOpenDocuments,
      handleOpenEditor,
      handleRunOcr,
      pageCount,
    ],
  );

  const dockActions = useMemo(
    () => [
      {
        key: 'edit',
        label: documentActionLabels.edit,
        caption: documentDetailCopy.dockEditCaption,
        icon: 'create-outline' as const,
        onPress: handleOpenEditor,
        disabled: !hasPageBasedDocument || activeActionKey !== null,
        variant: 'primary' as const,
      },
      {
        key: 'share',
        label: documentActionLabels.share,
        caption: resolveDocumentShareDockCaption(Boolean(documentPdfPath)),
        icon: 'share-social-outline' as const,
        onPress: () => {
          void handlePrimaryShare();
        },
        disabled:
          !hasPageBasedDocument || activeActionKey !== null || !billingHydrated,
        loading: activeActionKey === 'pdf' || activeActionKey === 'share_pdf',
      },
      {
        key: 'word',
        label: documentActionLabels.word,
        caption: resolveDocumentWordDockCaption(Boolean(documentWordPath)),
        icon: 'document-text-outline' as const,
        onPress: () => {
          void handleExportWord();
        },
        disabled:
          !hasPageBasedDocument || activeActionKey !== null || !billingHydrated,
        loading: activeActionKey === 'word',
      },
      {
        key: 'print',
        label: documentActionLabels.print,
        caption: resolveDocumentPrintDockCaption(Boolean(documentPdfPath)),
        icon: 'print-outline' as const,
        onPress: () => {
          void handlePrintSurface();
        },
        disabled:
          !hasPageBasedDocument || activeActionKey !== null || !billingHydrated,
        loading: activeActionKey === 'pdf' || activeActionKey === 'share_pdf',
      },
    ],
    [
      activeActionKey,
      billingHydrated,
      documentPdfPath,
      documentWordPath,
      handleExportWord,
      handleOpenEditor,
      handlePrimaryShare,
      handlePrintSurface,
      hasPageBasedDocument,
    ],
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>{documentDetailCopy.loading}</Text>
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
            <Text style={styles.errorTitle}>{documentDetailCopy.errorTitle}</Text>
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
              <Text style={styles.primaryButtonText}>
                {documentDetailCopy.retry}
              </Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.previewCard}>
              <View style={styles.previewFrame}>
                {previewImageUri ? (
                  <Image
                    source={{ uri: previewImageUri }}
                    resizeMode="cover"
                    style={styles.previewImage}
                  />
                ) : (
                  <View style={styles.previewPlaceholder}>
                    <Ionicons
                      name="document-text-outline"
                      size={32}
                      color={colors.textTertiary}
                    />
                    <Text style={styles.previewPlaceholderText}>
                      {documentDetailCopy.previewEmpty}
                    </Text>
                  </View>
                )}

                <View style={styles.previewFloatingBadge}>
                  <Text style={styles.previewFloatingBadgeText}>
                    {selectedPage
                      ? `Sayfa ${selectedPageIndex + 1}`
                      : hasPageBasedDocument
                        ? `${pageCount} sayfa`
                        : 'Belge önizleme'}
                  </Text>
                </View>
              </View>

              <View style={styles.previewMetaSection}>
                <View style={styles.previewTopRow}>
                  <View style={styles.previewTitleWrap}>
                    <Text style={styles.previewTitle}>{documentTitle}</Text>
                    <Text style={styles.previewSubtitle}>
                      Güncellendi: {formatDateTime(documentUpdatedAt)}
                    </Text>
                  </View>

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

                <View style={styles.badgeRow}>
                  <InfoBadge
                    label={resolveDocumentStatusLabel(document)}
                    tone={statusTone}
                  />
                  <InfoBadge
                    label={`${pageCount} sayfa`}
                    tone="default"
                    icon="layers-outline"
                  />
                  <InfoBadge
                    label={documentDetailCopy.localBadge}
                    tone="muted"
                    icon="shield-checkmark-outline"
                  />
                  {favorite ? (
                    <InfoBadge
                      label={documentDetailCopy.favoriteBadge}
                      tone="success"
                      icon="star"
                    />
                  ) : null}
                  {documentPdfPath ? (
                    <InfoBadge
                      label={documentDetailCopy.pdfSavedBadge}
                      tone="success"
                    />
                  ) : null}
                  {documentWordPath ? (
                    <InfoBadge
                      label={documentDetailCopy.wordSavedBadge}
                      tone="accent"
                    />
                  ) : null}
                  {document.collection_name ? (
                    <InfoBadge label={document.collection_name} tone="default" />
                  ) : null}
                  {document.tag_names?.map((tag) => (
                    <InfoBadge key={tag} label={`#${tag}`} tone="default" />
                  ))}
                </View>

                <LocalTrustBadge compact />
              </View>
            </View>

            {documentPages.length > 0 ? (
              <DocumentPageStrip
                title="Sayfalar"
                subtitle="Dokun ve büyük önizlemeyi değiştir"
                items={documentPages.map((page, index) => ({
                  key: String(page.id),
                  label: `Sayfa ${index + 1}`,
                  imageUri: page.image_path,
                  isActive: selectedPageIndex === index,
                  badge: page.page_order !== index ? `${page.page_order + 1}` : null,
                  onPress: () => setSelectedPageIndex(index),
                }))}
              />
            ) : null}

            <DocumentBottomActionDock actions={dockActions} />

            {pipelineSummary ? (
              <DocumentPipelineSummaryCard
                title={pipelineSummary.title}
                subtitle={pipelineSummary.subtitle}
                message={pipelineSummary.message}
                tone={pipelineSummary.tone}
                icon={pipelineSummary.icon}
                stats={pipelineSummary.stats}
                actions={pipelineSummary.actions}
              />
            ) : null}

            <View style={styles.nextStepCard}>
              <View style={styles.nextStepHeader}>
                <View style={styles.nextStepIconWrap}>
                  <Ionicons
                    name={
                      nextStepCard.tone === 'success'
                        ? 'checkmark-circle-outline'
                        : nextStepCard.tone === 'accent'
                          ? 'arrow-forward-circle-outline'
                          : 'alert-circle-outline'
                    }
                    size={20}
                    color={
                      nextStepCard.tone === 'success'
                        ? colors.primary
                        : nextStepCard.tone === 'accent'
                          ? '#60A5FA'
                          : '#FBBF24'
                    }
                  />
                </View>
                <View style={styles.nextStepTextWrap}>
                  <Text style={styles.nextStepTitle}>{nextStepCard.title}</Text>
                  <Text style={styles.nextStepText}>{nextStepCard.text}</Text>
                </View>
              </View>
            </View>

            <View style={styles.planCard}>
              <View style={styles.planHeader}>
                <View style={styles.planTextWrap}>
                  <Text style={styles.planTitle}>
                    {resolveDocumentPlanTitle(isPro)}
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
                    {resolveDocumentPlanActionLabel(isPro)}
                  </Text>
                </Pressable>
              </View>

              {!billingHydrated ? (
                <View style={styles.inlineLoadingRow}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.inlineLoadingText}>
                    {documentDetailCopy.planLoading}
                  </Text>
                </View>
              ) : (
                <View style={styles.capabilityRow}>
                  <InfoBadge
                    label={capabilities.canSave ? 'Kaydetme Açık' : 'Kaydetme Kilitli'}
                    tone={capabilities.canSave ? 'success' : 'warning'}
                  />
                  <InfoBadge
                    label={
                      capabilities.canShare ? 'Paylaşma Açık' : 'Paylaşma Kilitli'
                    }
                    tone={capabilities.canShare ? 'success' : 'warning'}
                  />
                  <InfoBadge
                    label={capabilities.canRemoveAds ? 'Reklamsız' : 'Reklamlı'}
                    tone={capabilities.canRemoveAds ? 'success' : 'muted'}
                  />
                </View>
              )}

              <Text style={styles.planHint}>{resolveDocumentPlanHint(isPro)}</Text>
            </View>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                {documentDetailCopy.secondaryActionsTitle}
              </Text>
              <Text style={styles.sectionHint}>
                {activeActionKey
                  ? documentDetailCopy.secondaryActionsBusyHint
                  : documentDetailCopy.secondaryActionsHint}
              </Text>
            </View>

            <View style={styles.actionList}>
              <ActionButton
                icon="scan-outline"
                label={documentActionLabels.ocr}
                caption={documentDetailCopy.secondaryActionCaptions.ocr}
                disabled={!hasPageBasedDocument || activeActionKey !== null}
                loading={activeActionKey === 'ocr'}
                onPress={() => void handleRunOcr()}
              />
              <ActionButton
                icon="document-outline"
                label={pdfActionCopy.label}
                caption={pdfActionCopy.caption}
                disabled={
                  !hasPageBasedDocument ||
                  activeActionKey !== null ||
                  !billingHydrated
                }
                loading={activeActionKey === 'pdf'}
                onPress={() => void handleExportPdf()}
              />
              <ActionButton
                icon="grid-outline"
                label={excelActionCopy.label}
                caption={excelActionCopy.caption}
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
                label={documentActionLabels.translate}
                caption={documentDetailCopy.secondaryActionCaptions.translate}
                disabled={!hasPageBasedDocument || activeActionKey !== null}
                loading={activeActionKey === 'translate'}
                onPress={() => void handleTranslate()}
              />
            </View>

            <View style={styles.outputCard}>
              <View style={styles.outputHeader}>
                <View style={styles.outputHeaderTextWrap}>
                  <Text style={styles.outputTitle}>
                    {documentDetailCopy.outputTitle}
                  </Text>
                  <Text style={styles.outputSubtitle}>
                    {documentDetailCopy.outputSubtitle}
                  </Text>
                </View>
                {!isPro ? (
                  <InfoBadge
                    label={documentDetailCopy.outputPremiumBadge}
                    tone="warning"
                  />
                ) : (
                  <InfoBadge
                    label={documentDetailCopy.outputOpenBadge}
                    tone="success"
                  />
                )}
              </View>

              <OutputStatusRow
                title={pdfOutputCopy.title}
                description={pdfOutputCopy.description}
                badgeLabel={pdfOutputCopy.badgeLabel}
                badgeTone={pdfOutputCopy.badgeTone}
                actionLabel={pdfOutputCopy.actionLabel}
                actionDisabled={activeActionKey !== null || !billingHydrated}
                actionLoading={activeActionKey === 'pdf' || activeActionKey === 'share_pdf'}
                onPress={
                  documentPdfPath
                    ? () => {
                        void handleSharePdf();
                      }
                    : () => {
                        void handleExportPdf();
                      }
                }
              />

              <OutputStatusRow
                title={wordOutputCopy.title}
                description={wordOutputCopy.description}
                badgeLabel={wordOutputCopy.badgeLabel}
                badgeTone={wordOutputCopy.badgeTone}
                actionLabel={wordOutputCopy.actionLabel}
                actionDisabled={activeActionKey !== null || !billingHydrated}
                actionLoading={activeActionKey === 'word' || activeActionKey === 'share_word'}
                onPress={
                  documentWordPath
                    ? () => {
                        void handleShareWord();
                      }
                    : () => {
                        void handleExportWord();
                      }
                }
              />

              <OutputStatusRow
                title={excelOutputCopy.title}
                description={excelOutputCopy.description}
                badgeLabel={excelOutputCopy.badgeLabel}
                badgeTone={excelOutputCopy.badgeTone}
                actionLabel={excelOutputCopy.actionLabel}
                actionDisabled={activeActionKey !== null || !billingHydrated}
                actionLoading={activeActionKey === 'excel'}
                onPress={() => {
                  void handleExportExcel();
                }}
              />

              <View style={styles.shareSummaryCard}>
                <View style={styles.shareSummaryTextWrap}>
                  <Text style={styles.shareSummaryTitle}>{shareSummary.title}</Text>
                  <Text style={styles.shareSummaryText}>{shareSummary.text}</Text>
                </View>
                <InfoBadge
                  label={shareSummary.badgeLabel}
                  tone={shareSummary.tone}
                />
              </View>
            </View>

            {document.ocr_text ? (
              <View style={styles.resultCard}>
                <View style={styles.resultHeader}>
                  <Text style={styles.resultTitle}>
                    {documentDetailCopy.ocrPreviewTitle}
                  </Text>
                  <InfoBadge
                    label={
                      document.ocr_status === 'ready'
                        ? documentDetailCopy.resultReadyBadge
                        : documentDetailCopy.resultWaitingBadge
                    }
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
                  <Text style={styles.resultTitle}>
                    {documentDetailCopy.translationPreviewTitle}
                  </Text>
                  <InfoBadge
                    label={documentDetailCopy.resultReadyBadge}
                    tone="accent"
                  />
                </View>
                <Text style={styles.resultMeta}>
                  Kaynak dil: {translationPreview.sourceLanguage ?? 'Bilinmiyor'} •{' '}
                  Sağlayıcı: {translationPreview.provider} •{' '}
                  {formatDateTime(translationPreview.translatedAt)}
                </Text>
                <Text style={styles.resultText} numberOfLines={10}>
                  {translationPreview.text}
                </Text>
              </View>
            ) : null}

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                {documentDetailCopy.recentActionsTitle}
              </Text>
              <Text style={styles.sectionHint}>
                {documentDetailCopy.historyCount(auditEntries.length)}
              </Text>
            </View>

            {auditEntries.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>
                  {documentDetailCopy.recentActionsEmptyTitle}
                </Text>
                <Text style={styles.emptyText}>
                  {documentDetailCopy.recentActionsEmptyText}
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
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: Layout.screenHorizontalPadding,
    paddingTop: Layout.screenVerticalPadding,
    paddingBottom: Spacing['3xl'],
    gap: Spacing.lg,
  },
  previewCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    ...Shadows.sm,
  },
  previewFrame: {
    height: 340,
    backgroundColor: '#0F141B',
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  previewPlaceholderText: {
    ...Typography.bodySmall,
    color: colors.textTertiary,
  },
  previewFloatingBadge: {
    position: 'absolute',
    left: Spacing.md,
    bottom: Spacing.md,
    minHeight: 30,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(11, 15, 20, 0.18)',
    backgroundColor: 'rgba(11, 15, 20, 0.78)',
  },
  previewFloatingBadgeText: {
    ...Typography.caption,
    color: colors.text,
    fontWeight: '800',
  },
  previewMetaSection: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  previewTopRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'flex-start',
  },
  previewTitleWrap: {
    flex: 1,
    gap: 4,
  },
  previewTitle: {
    ...Typography.titleLarge,
    color: colors.text,
  },
  previewSubtitle: {
    ...Typography.bodySmall,
    color: colors.textSecondary,
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
  nextStepCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    gap: Spacing.md,
    ...Shadows.sm,
  },
  nextStepHeader: {
    flexDirection: 'row',
    gap: Spacing.md,
    alignItems: 'flex-start',
  },
  nextStepIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextStepTextWrap: {
    flex: 1,
    gap: 4,
  },
  nextStepTitle: {
    ...Typography.titleSmall,
    color: colors.text,
  },
  nextStepText: {
    ...Typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  planCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    gap: Spacing.md,
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
    gap: Spacing.md,
    ...Shadows.sm,
  },
  outputHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  outputHeaderTextWrap: {
    flex: 1,
    gap: 4,
  },
  outputTitle: {
    ...Typography.titleSmall,
    color: colors.text,
  },
  outputSubtitle: {
    ...Typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  outputStatusRow: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  outputStatusTextWrap: {
    flex: 1,
    gap: 6,
  },
  outputStatusTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  outputStatusTitle: {
    ...Typography.body,
    color: colors.text,
    fontWeight: '800',
    flex: 1,
  },
  outputStatusDescription: {
    ...Typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  outputActionButton: {
    minWidth: 92,
    minHeight: 42,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
  },
  outputActionButtonText: {
    ...Typography.bodySmall,
    color: colors.text,
    fontWeight: '800',
  },
  shareSummaryCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    padding: Spacing.md,
    flexDirection: 'row',
    gap: Spacing.md,
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  shareSummaryTextWrap: {
    flex: 1,
    gap: 4,
  },
  shareSummaryTitle: {
    ...Typography.bodySmall,
    color: colors.text,
    fontWeight: '800',
  },
  shareSummaryText: {
    ...Typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  resultCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    gap: Spacing.sm,
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
