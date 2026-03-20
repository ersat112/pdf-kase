// src/modules/documents/document-presentation.ts
export type DocumentSurfaceItem = {
  id: number;
  title?: string | null;
  status?: string | null;
  ocr_status?: string | null;
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