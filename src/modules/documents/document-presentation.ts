// src/modules/documents/document-presentation.ts
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

import {
  documentActionLabels,
  documentPresentationCopy,
  documentStatusCopy,
  type DocumentCopyTone,
} from './document-action-copy';

export type DocumentSurfaceItem = {
  id: number;
  title?: string | null;
  status?: string | null;
  ocr_status?: string | null;
  ocr_error?: string | null;
  pageCount?: number | null;
  page_count?: number | null;
  pages?: Array<unknown> | null;
  pdfPath?: string | null;
  pdf_path?: string | null;
  wordPath?: string | null;
  word_path?: string | null;
  thumbnailPath?: string | null;
  thumbnail_path?: string | null;
  createdAt?: string | null;
  created_at?: string | null;
  updatedAt?: string | null;
  updated_at?: string | null;
  isFavorite?: number | null;
  is_favorite?: number | null;
};

export type DocumentActionState =
  | 'idle'
  | 'processing'
  | 'ready'
  | 'failed'
  | 'requires_premium';

export type DocumentStatusTone = DocumentCopyTone;
export type DocumentPipelineSummaryTone = DocumentCopyTone;

export type DocumentPipelineSummaryIconName = ComponentProps<
  typeof Ionicons
>['name'];

export type DocumentPipelineSummaryStat = {
  label: string;
  tone?: DocumentPipelineSummaryTone;
  icon?: DocumentPipelineSummaryIconName;
};

export type DocumentPipelineSummaryAction = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
};

export type DocumentPipelineSummaryModel = {
  title: string;
  subtitle: string;
  message: string;
  tone?: DocumentPipelineSummaryTone;
  icon?: DocumentPipelineSummaryIconName;
  stats?: DocumentPipelineSummaryStat[];
  actions?: DocumentPipelineSummaryAction[];
};

export type DocumentHomeOverview<TDocument extends DocumentSurfaceItem> = {
  latestDocument: TDocument | null;
  recentDocuments: TDocument[];
  processingCount: number;
  failedCount: number;
  pdfReadyCount: number;
  favoriteCount: number;
  totalCount: number;
};

export type DocumentCollectionOverview<TDocument extends DocumentSurfaceItem> = {
  sortedDocuments: TDocument[];
  totalCount: number;
  totalPages: number;
  draftCount: number;
  readyCount: number;
  processingCount: number;
  failedCount: number;
  pdfReadyCount: number;
  favoriteCount: number;
};

export function resolveDocumentTitle(document: DocumentSurfaceItem) {
  const title = document.title?.trim();

  if (title) {
    return title;
  }

  return `Belge #${document.id}`;
}

export function resolveDocumentUpdatedAt(document: DocumentSurfaceItem) {
  return (
    document.updatedAt ??
    document.updated_at ??
    document.createdAt ??
    document.created_at ??
    null
  );
}

export function resolveDocumentPdfPath(document: DocumentSurfaceItem) {
  return document.pdfPath ?? document.pdf_path ?? null;
}

export function resolveDocumentWordPath(document: DocumentSurfaceItem) {
  return document.wordPath ?? document.word_path ?? null;
}

export function resolveDocumentThumbnailPath(document: DocumentSurfaceItem) {
  return document.thumbnailPath ?? document.thumbnail_path ?? null;
}

export function resolveDocumentPageCount(document: DocumentSurfaceItem) {
  const explicitPageCount = document.pageCount ?? document.page_count;

  if (
    typeof explicitPageCount === 'number' &&
    Number.isFinite(explicitPageCount) &&
    explicitPageCount > 0
  ) {
    return explicitPageCount;
  }

  if (Array.isArray(document.pages) && document.pages.length > 0) {
    return document.pages.length;
  }

  return 0;
}

export function resolveDocumentIsFavorite(document: DocumentSurfaceItem) {
  return document.is_favorite === 1 || document.isFavorite === 1;
}

export function resolveDocumentActionState(
  document: DocumentSurfaceItem,
): DocumentActionState {
  if (document.ocr_status === 'processing') {
    return 'processing';
  }

  if (document.ocr_status === 'failed') {
    return 'failed';
  }

  if (resolveDocumentPdfPath(document)) {
    return 'ready';
  }

  if (document.ocr_status === 'ready') {
    return 'ready';
  }

  if (document.status === 'ready') {
    return 'ready';
  }

  return 'idle';
}

export function resolveDocumentStatusLabel(document: DocumentSurfaceItem) {
  const actionState = resolveDocumentActionState(document);

  if (actionState === 'processing') {
    return documentStatusCopy.processing;
  }

  if (actionState === 'failed') {
    return documentStatusCopy.failed;
  }

  if (resolveDocumentPdfPath(document) && document.status === 'ready') {
    return documentStatusCopy.pdfReady;
  }

  if (resolveDocumentWordPath(document)) {
    return documentStatusCopy.wordReady;
  }

  if (document.ocr_status === 'ready') {
    return documentStatusCopy.ocrReady;
  }

  if (document.status === 'draft') {
    return documentStatusCopy.draft;
  }

  if (document.status === 'ready') {
    return documentStatusCopy.ready;
  }

  if (document.status === 'exported') {
    return documentStatusCopy.exported;
  }

  return documentStatusCopy.generic;
}

export function resolveDocumentStatusTone(
  document: DocumentSurfaceItem,
): DocumentStatusTone {
  const actionState = resolveDocumentActionState(document);

  if (actionState === 'processing') {
    return 'accent';
  }

  if (actionState === 'failed') {
    return 'danger';
  }

  if (resolveDocumentPdfPath(document)) {
    return 'success';
  }

  if (document.ocr_status === 'ready') {
    return 'accent';
  }

  if (document.status === 'draft') {
    return 'muted';
  }

  return 'default';
}

export function sortDocumentsByUpdatedAt<TDocument extends DocumentSurfaceItem>(
  list: TDocument[],
) {
  return [...list].sort((left, right) => {
    const leftTime = new Date(resolveDocumentUpdatedAt(left) ?? 0).getTime();
    const rightTime = new Date(resolveDocumentUpdatedAt(right) ?? 0).getTime();

    return rightTime - leftTime;
  });
}

export function buildDocumentHomeOverview<TDocument extends DocumentSurfaceItem>(
  documents: TDocument[],
): DocumentHomeOverview<TDocument> {
  const sorted = sortDocumentsByUpdatedAt(documents);

  return {
    latestDocument: sorted[0] ?? null,
    recentDocuments: sorted.slice(0, 8),
    processingCount: sorted.filter(
      (item) => resolveDocumentActionState(item) === 'processing',
    ).length,
    failedCount: sorted.filter(
      (item) => resolveDocumentActionState(item) === 'failed',
    ).length,
    pdfReadyCount: sorted.filter((item) => Boolean(resolveDocumentPdfPath(item)))
      .length,
    favoriteCount: sorted.filter((item) => resolveDocumentIsFavorite(item))
      .length,
    totalCount: sorted.length,
  };
}

export function buildDocumentCollectionOverview<
  TDocument extends DocumentSurfaceItem,
>(documents: TDocument[]): DocumentCollectionOverview<TDocument> {
  const sortedDocuments = sortDocumentsByUpdatedAt(documents);

  return {
    sortedDocuments,
    totalCount: sortedDocuments.length,
    totalPages: sortedDocuments.reduce(
      (sum, item) => sum + resolveDocumentPageCount(item),
      0,
    ),
    draftCount: sortedDocuments.filter((item) => item.status === 'draft').length,
    readyCount: sortedDocuments.filter((item) => item.status === 'ready').length,
    processingCount: sortedDocuments.filter(
      (item) => resolveDocumentActionState(item) === 'processing',
    ).length,
    failedCount: sortedDocuments.filter(
      (item) => resolveDocumentActionState(item) === 'failed',
    ).length,
    pdfReadyCount: sortedDocuments.filter((item) => Boolean(resolveDocumentPdfPath(item)))
      .length,
    favoriteCount: sortedDocuments.filter((item) => resolveDocumentIsFavorite(item))
      .length,
  };
}

export function buildHomeDocumentPipelineSummary(
  overview: DocumentHomeOverview<DocumentSurfaceItem>,
  options: {
    onOpenDocuments: () => void;
  },
): DocumentPipelineSummaryModel {
  const tone: DocumentPipelineSummaryTone =
    overview.failedCount > 0
      ? 'warning'
      : overview.processingCount > 0
        ? 'accent'
        : 'default';

  const message =
    overview.failedCount > 0
      ? documentPresentationCopy.homeSummary.failedMessage
      : overview.processingCount > 0
        ? documentPresentationCopy.homeSummary.processingMessage
        : documentPresentationCopy.homeSummary.cleanMessage;

  return {
    title: documentPresentationCopy.homeSummary.title,
    subtitle: documentPresentationCopy.homeSummary.subtitle,
    message,
    tone,
    icon: 'pulse-outline',
    stats: [
      {
        label: `${overview.processingCount} işleniyor`,
        tone: 'accent',
        icon: 'hourglass-outline',
      },
      {
        label: `${overview.failedCount} hata`,
        tone: overview.failedCount > 0 ? 'warning' : 'muted',
        icon: 'alert-circle-outline',
      },
      {
        label: `${overview.pdfReadyCount} PDF hazır`,
        tone: 'success',
        icon: 'document-outline',
      },
      {
        label: `${overview.favoriteCount} favori`,
        tone: 'default',
        icon: 'star-outline',
      },
    ],
    actions: [
      {
        label: documentActionLabels.documentCenter,
        onPress: options.onOpenDocuments,
        variant: 'secondary',
      },
    ],
  };
}

export function buildDocumentsRecoverySummary(
  options: {
    overview: DocumentCollectionOverview<DocumentSurfaceItem>;
    failedVisibleCount: number;
    filteredCount: number;
    busy: boolean;
    onSelectFailed: () => void;
    onRetryFailed: () => void;
  },
): DocumentPipelineSummaryModel | null {
  if (options.failedVisibleCount <= 0) {
    return null;
  }

  return {
    title: documentPresentationCopy.recoverySummary.title,
    subtitle: documentPresentationCopy.recoverySummary.subtitle,
    message: documentPresentationCopy.recoverySummary.message(
      options.failedVisibleCount,
    ),
    tone: 'warning',
    icon: 'refresh-outline',
    stats: [
      {
        label: `${options.failedVisibleCount} hata`,
        tone: 'warning',
        icon: 'alert-circle-outline',
      },
      {
        label: `${options.overview.processingCount} işleniyor`,
        tone: options.overview.processingCount > 0 ? 'accent' : 'muted',
        icon: 'hourglass-outline',
      },
      {
        label: `${options.filteredCount} görünür`,
        tone: 'default',
        icon: 'documents-outline',
      },
    ],
    actions: [
      {
        label: documentPresentationCopy.recoverySummary.selectFailed,
        onPress: options.onSelectFailed,
        variant: 'secondary',
        disabled: options.busy,
      },
      {
        label: documentActionLabels.ocr,
        onPress: options.onRetryFailed,
        variant: 'primary',
        disabled: options.busy,
      },
    ],
  };
}

function buildDocumentDetailPipelineStats(
  document: DocumentSurfaceItem,
  pageCount: number,
): DocumentPipelineSummaryStat[] {
  const hasPageBasedDocument = pageCount > 0;
  const documentPdfPath = resolveDocumentPdfPath(document);
  const documentWordPath = resolveDocumentWordPath(document);

  return [
    {
      label: resolveDocumentStatusLabel(document),
      tone: resolveDocumentStatusTone(document),
      icon: 'pulse-outline',
    },
    {
      label: hasPageBasedDocument
        ? `${pageCount} sayfa`
        : documentPresentationCopy.detailSummary.stats.nonPageBased,
      tone: hasPageBasedDocument ? 'default' : 'muted',
      icon: 'layers-outline',
    },
    {
      label: documentPdfPath
        ? documentPresentationCopy.detailSummary.stats.pdfReady
        : documentPresentationCopy.detailSummary.stats.pdfMissing,
      tone: documentPdfPath ? 'success' : 'muted',
      icon: 'document-outline',
    },
    {
      label: documentWordPath
        ? documentPresentationCopy.detailSummary.stats.wordReady
        : documentPresentationCopy.detailSummary.stats.wordMissing,
      tone: documentWordPath ? 'accent' : 'muted',
      icon: 'document-text-outline',
    },
  ];
}

export function buildDocumentDetailPipelineSummary(
  options: {
    document: DocumentSurfaceItem | null;
    pageCount: number;
    actionDisabled: boolean;
    onOpenDocuments: () => void;
    onOpenEditor: () => void;
    onRunOcr: () => void;
  },
): DocumentPipelineSummaryModel | null {
  const { document } = options;

  if (!document) {
    return null;
  }

  const hasPageBasedDocument = options.pageCount > 0;
  const documentPdfPath = resolveDocumentPdfPath(document);
  const documentWordPath = resolveDocumentWordPath(document);
  const statusTone = resolveDocumentStatusTone(document);
  const stats = buildDocumentDetailPipelineStats(document, options.pageCount);

  if (!hasPageBasedDocument) {
    return {
      title: documentPresentationCopy.detailSummary.importedPdf.title,
      subtitle: documentPresentationCopy.detailSummary.importedPdf.subtitle,
      message: documentPresentationCopy.detailSummary.importedPdf.message,
      tone: 'muted',
      icon: 'information-circle-outline',
      stats,
      actions: [
        {
          label: documentActionLabels.documentCenter,
          onPress: options.onOpenDocuments,
          variant: 'secondary',
          disabled: options.actionDisabled,
        },
      ],
    };
  }

  if (document.ocr_status === 'failed') {
    return {
      title: documentPresentationCopy.detailSummary.ocrFailed.title,
      subtitle: documentPresentationCopy.detailSummary.ocrFailed.subtitle,
      message:
        document.ocr_error?.trim() ||
        documentPresentationCopy.detailSummary.ocrFailed.fallbackMessage,
      tone: 'warning',
      icon: 'refresh-outline',
      stats,
      actions: [
        {
          label: documentActionLabels.edit,
          onPress: options.onOpenEditor,
          variant: 'secondary',
          disabled: options.actionDisabled,
        },
        {
          label: documentActionLabels.ocr,
          onPress: options.onRunOcr,
          variant: 'primary',
          disabled: options.actionDisabled,
        },
      ],
    };
  }

  if (document.ocr_status === 'processing') {
    return {
      title: documentPresentationCopy.detailSummary.processing.title,
      subtitle: documentPresentationCopy.detailSummary.processing.subtitle,
      message: documentPresentationCopy.detailSummary.processing.message,
      tone: 'accent',
      icon: 'hourglass-outline',
      stats,
      actions: [],
    };
  }

  if (
    documentPdfPath ||
    documentWordPath ||
    document.ocr_status === 'ready' ||
    document.status === 'ready'
  ) {
    return {
      title: documentPresentationCopy.detailSummary.ready.title,
      subtitle: documentPresentationCopy.detailSummary.ready.subtitle,
      message: documentPdfPath
        ? documentPresentationCopy.detailSummary.ready.pdfReadyMessage
        : document.ocr_status === 'ready'
          ? documentPresentationCopy.detailSummary.ready.ocrReadyMessage
          : documentPresentationCopy.detailSummary.ready.defaultMessage,
      tone: documentPdfPath ? 'success' : statusTone,
      icon: documentPdfPath
        ? 'checkmark-circle-outline'
        : 'sparkles-outline',
      stats,
      actions: [
        {
          label: documentActionLabels.edit,
          onPress: options.onOpenEditor,
          variant: 'secondary',
          disabled: options.actionDisabled,
        },
      ],
    };
  }

  return {
    title: documentPresentationCopy.detailSummary.draft.title,
    subtitle: documentPresentationCopy.detailSummary.draft.subtitle,
    message: documentPresentationCopy.detailSummary.draft.message,
    tone: 'default',
    icon: 'document-text-outline',
    stats,
    actions: [
      {
        label: documentActionLabels.edit,
        onPress: options.onOpenEditor,
        variant: 'secondary',
        disabled: options.actionDisabled,
      },
      {
        label: documentActionLabels.ocr,
        onPress: options.onRunOcr,
        variant: 'primary',
        disabled: options.actionDisabled,
      },
    ],
  };
}