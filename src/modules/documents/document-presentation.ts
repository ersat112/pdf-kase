// src/modules/documents/document-presentation.ts
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

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

export type DocumentStatusTone =
  | 'default'
  | 'success'
  | 'accent'
  | 'muted'
  | 'danger'
  | 'warning';

export type DocumentPipelineSummaryTone = DocumentStatusTone;

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
    return 'OCR İşleniyor';
  }

  if (actionState === 'failed') {
    return 'OCR Hata';
  }

  if (resolveDocumentPdfPath(document) && document.status === 'ready') {
    return 'PDF Hazır';
  }

  if (resolveDocumentWordPath(document)) {
    return 'WORD Hazır';
  }

  if (document.ocr_status === 'ready') {
    return 'OCR Hazır';
  }

  if (document.status === 'draft') {
    return 'Taslak';
  }

  if (document.status === 'ready') {
    return 'Hazır';
  }

  if (document.status === 'exported') {
    return 'PDF Oluşturuldu';
  }

  return 'Belge';
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
    pdfReadyCount: sorted.filter((item) => Boolean(resolveDocumentPdfPath(item))).length,
    favoriteCount: sorted.filter((item) => resolveDocumentIsFavorite(item)).length,
    totalCount: sorted.length,
  };
}

export function buildDocumentCollectionOverview<TDocument extends DocumentSurfaceItem>(
  documents: TDocument[],
): DocumentCollectionOverview<TDocument> {
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
    pdfReadyCount: sortedDocuments.filter((item) => Boolean(resolveDocumentPdfPath(item))).length,
    favoriteCount: sortedDocuments.filter((item) => resolveDocumentIsFavorite(item)).length,
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
      ? 'Başarısız OCR kayıtları için belge merkezinden retry akışına geç.'
      : overview.processingCount > 0
        ? 'Devam eden OCR işlemleri belge merkezinde canlı durum kartlarıyla görünür.'
        : 'Belge pipeline temiz durumda. Yeni işleme başlayabilir veya son belgeye dönebilirsin.';

  return {
    title: 'Belge işlem özeti',
    subtitle: 'OCR, export ve recovery görünürlüğü tek yerden takip ediliyor.',
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
        label: 'Belge merkezini aç',
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
    title: 'OCR recovery',
    subtitle: 'Başarısız belge işlemleri bu ekrandan toplu toparlanabilir.',
    message: `Bu filtrede ${options.failedVisibleCount} belge OCR hatası verdi. İstersen seçim moduna alıp toplu tekrar deneyebilirsin.`,
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
        label: 'Başarısızları seç',
        onPress: options.onSelectFailed,
        variant: 'secondary',
        disabled: options.busy,
      },
      {
        label: 'Tekrar dene',
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
      label: hasPageBasedDocument ? `${pageCount} sayfa` : 'Sayfa tabanlı değil',
      tone: hasPageBasedDocument ? 'default' : 'muted',
      icon: 'layers-outline',
    },
    {
      label: documentPdfPath ? 'PDF hazır' : 'PDF yok',
      tone: documentPdfPath ? 'success' : 'muted',
      icon: 'document-outline',
    },
    {
      label: documentWordPath ? 'Word hazır' : 'Word yok',
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
      title: 'İçe aktarılan PDF',
      subtitle: 'Bu kayıt sayfa tabanlı belge akışına henüz girmiyor.',
      message:
        'OCR, editör ve yeniden export v1 akışı için sayfa tabanlı belge gerekiyor.',
      tone: 'muted',
      icon: 'information-circle-outline',
      stats,
      actions: [
        {
          label: 'Belgelerim',
          onPress: options.onOpenDocuments,
          variant: 'secondary',
          disabled: options.actionDisabled,
        },
      ],
    };
  }

  if (document.ocr_status === 'failed') {
    return {
      title: 'OCR recovery gerekli',
      subtitle: 'Belge iş akışı hata verdi, aynı kayıttan tekrar deneyebilirsin.',
      message:
        document.ocr_error?.trim() ||
        'OCR işlemi tamamlanamadı. Düzenleme sonrası yeniden deneyebilirsin.',
      tone: 'warning',
      icon: 'refresh-outline',
      stats,
      actions: [
        {
          label: 'Editörde aç',
          onPress: options.onOpenEditor,
          variant: 'secondary',
          disabled: options.actionDisabled,
        },
        {
          label: 'OCR tekrar dene',
          onPress: options.onRunOcr,
          variant: 'primary',
          disabled: options.actionDisabled,
        },
      ],
    };
  }

  if (document.ocr_status === 'processing') {
    return {
      title: 'Belge işleniyor',
      subtitle: 'OCR pipeline çalışıyor.',
      message:
        'İşlem tamamlandığında OCR metni ve export yüzeyleri bu ekranda güncellenecek.',
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
      title: 'Belge hazır',
      subtitle: 'Düzenleme, OCR, çeviri ve export yüzeyleri aktif.',
      message: documentPdfPath
        ? 'PDF çıktısı hazır. Gerekirse yeniden üretip Word / Excel veya paylaşma akışına devam edebilirsin.'
        : document.ocr_status === 'ready'
          ? 'OCR metni hazır. Çeviri veya export adımına geçebilirsin.'
          : 'Belge düzenleme ve export için hazır durumda.',
      tone: documentPdfPath ? 'success' : statusTone,
      icon: documentPdfPath
        ? 'checkmark-circle-outline'
        : 'sparkles-outline',
      stats,
      actions: [
        {
          label: 'Editörde aç',
          onPress: options.onOpenEditor,
          variant: 'secondary',
          disabled: options.actionDisabled,
        },
      ],
    };
  }

  return {
    title: 'Belge taslak durumda',
    subtitle: 'Akış henüz tamamlanmadı.',
    message:
      'Editörde açabilir, OCR başlatabilir ve ardından export akışına geçebilirsin.',
    tone: 'default',
    icon: 'document-text-outline',
    stats,
    actions: [
      {
        label: 'Editörde aç',
        onPress: options.onOpenEditor,
        variant: 'secondary',
        disabled: options.actionDisabled,
      },
      {
        label: 'OCR çıkar',
        onPress: options.onRunOcr,
        variant: 'primary',
        disabled: options.actionDisabled,
      },
    ],
  };
}
