import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Image } from 'react-native';

import { getDb } from '../../db/sqlite';
import { useBillingStore } from '../../store/useBillingStore';
import { getAssetById } from '../assets/asset.service';
import {
  buildWordDocumentBytes,
  type BuildWordDocumentInput,
} from '../export/word-export.service';
import {
  optimizeImageForPdf,
  rotateImageRight,
} from '../imaging/imaging.service';
import { extractTextFromDocumentPages } from '../ocr/ocr.service';
import {
  getDocumentOverlays,
  getOverlaySignatureColor,
} from '../overlays/overlay.service';
import { generateImportedPdfThumbnail } from '../pdf/pdf-thumbnail.service';
import {
  buildPdfFromImages,
  type PdfOverlay,
  type SignatureStroke,
} from '../pdf/pdf.service';
import {
  ensureAppDirectories,
  getAppDirectories,
  getExtensionFromUri,
  persistImportedImage,
  removeFileIfExists,
  writeWordBytes,
} from '../storage/file.service';

export type DashboardStats = {
  documents: number;
  pages: number;
  assets: number;
};

export type DocumentSummary = {
  id: number;
  title: string;
  status: string;
  pdf_path: string | null;
  thumbnail_path: string | null;
  ocr_status: DocumentOcrStatus;
  word_path: string | null;
  page_count: number;
  created_at: string;
  updated_at: string;
};

export type DocumentPage = {
  id: number;
  document_id: number;
  image_path: string;
  page_order: number;
  width: number | null;
  height: number | null;
  created_at: string;
};

export type DocumentOcrStatus =
  | 'idle'
  | 'processing'
  | 'ready'
  | 'failed';

export type DocumentDetail = {
  id: number;
  title: string;
  status: string;
  pdf_path: string | null;
  thumbnail_path: string | null;
  ocr_text: string | null;
  ocr_status: DocumentOcrStatus;
  ocr_updated_at: string | null;
  ocr_error: string | null;
  word_path: string | null;
  word_updated_at: string | null;
  created_at: string;
  updated_at: string;
  pages: DocumentPage[];
};

export type LatestDocument = {
  id: number;
  title: string | null;
} | null;

export type CreateDraftResult = {
  documentId: number;
  title: string;
};

export type PickedImportFileInput = {
  uri: string;
  name?: string | null;
  mimeType?: string | null;
};

export type ImportPickedFilesResult = {
  firstDocumentId: number;
  createdDocumentIds: number[];
  createdCount: number;
  importedImageCount: number;
  importedPdfCount: number;
  unsupportedFiles: string[];
};

export type ExtractDocumentTextResult = {
  documentId: number;
  text: string;
  ocrStatus: DocumentOcrStatus;
  extractedPageCount: number;
  extractedCharacterCount: number;
  extractedAt: string;
};

export type WordExportResult = {
  fileName: string;
  fileUri: string;
  contentUri: string;
  documentId: number;
  textLength: number;
  exportedAt: string;
};

type OverlayContent = {
  assetId?: number;
  strokes?: SignatureStroke[];
  strokeColor?: string;
};

function isPositiveInteger(value: number) {
  return Number.isInteger(value) && value > 0;
}

function normalizeListLimit(limit: number) {
  if (!Number.isFinite(limit)) {
    return 20;
  }

  return Math.max(1, Math.min(100, Math.trunc(limit)));
}

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function buildDocumentTitle() {
  const now = new Date();

  const datePart = `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()}`;
  const timePart = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

  return `Belge ${datePart} ${timePart}`;
}

function buildDocumentTitleFromFileName(fileName?: string | null) {
  const trimmed = fileName?.trim();

  if (!trimmed) {
    return buildDocumentTitle();
  }

  const title = trimmed.replace(/\.[^.]+$/, '').trim();

  return title.length > 0 ? title : buildDocumentTitle();
}

function normalizeImportUri(uri: string) {
  const trimmed = uri.trim();

  if (!trimmed) {
    return trimmed;
  }

  if (
    trimmed.startsWith('file://') ||
    trimmed.startsWith('content://')
  ) {
    return trimmed;
  }

  if (trimmed.startsWith('/')) {
    return `file://${trimmed}`;
  }

  return trimmed;
}

function normalizeFileBaseName(value: string) {
  const normalized = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[çğıöşüÇĞİÖŞÜ]/g, (char) => {
      switch (char) {
        case 'ç':
        case 'Ç':
          return 'c';
        case 'ğ':
        case 'Ğ':
          return 'g';
        case 'ı':
        case 'İ':
          return 'i';
        case 'ö':
        case 'Ö':
          return 'o';
        case 'ş':
        case 'Ş':
          return 's';
        case 'ü':
        case 'Ü':
          return 'u';
        default:
          return char;
      }
    })
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

  return normalized || 'document';
}

function buildUniqueImportedFileName(fileName?: string | null, extension = 'pdf') {
  const base = normalizeFileBaseName(buildDocumentTitleFromFileName(fileName));
  const random = Math.random().toString(36).slice(2, 8);
  return `${base}-${Date.now()}-${random}.${extension}`;
}

function safeParseOverlayContent(content: string | null): OverlayContent | null {
  if (!content) {
    return null;
  }

  try {
    return JSON.parse(content) as OverlayContent;
  } catch {
    return null;
  }
}

function collectUniqueFilePaths(paths: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      paths.filter(
        (value): value is string =>
          typeof value === 'string' && value.trim().length > 0,
      ),
    ),
  );
}

function normalizeDocumentText(value: string | null | undefined) {
  if (typeof value !== 'string') {
    return '';
  }

  return value
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message.trim().length > 0
    ? error.message
    : fallback;
}

function getImportDisplayName(input: PickedImportFileInput) {
  return input.name?.trim() || input.uri.trim() || 'dosya';
}

function isPdfImport(input: PickedImportFileInput) {
  if (input.mimeType?.toLowerCase() === 'application/pdf') {
    return true;
  }

  return /\.pdf(\?.*)?$/i.test(input.name ?? '') || /\.pdf(\?.*)?$/i.test(input.uri);
}

function isImageImport(input: PickedImportFileInput) {
  if (typeof input.mimeType === 'string' && input.mimeType.startsWith('image/')) {
    return true;
  }

  return /\.(png|jpe?g|webp|heic|heif)$/i.test(input.name ?? '') ||
    /\.(png|jpe?g|webp|heic|heif)$/i.test(input.uri);
}

function shouldPreserveTransparency(sourceUri: string) {
  return /\.png(\?.*)?$/i.test(sourceUri);
}

async function resolveImageSize(sourceUri: string) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    Image.getSize(
      sourceUri,
      (width, height) => resolve({ width, height }),
      () => reject(new Error('Görsel boyutu okunamadı.')),
    );
  });
}

function normalizeSignatureStrokes(strokes: SignatureStroke[] | undefined): SignatureStroke[] {
  if (!Array.isArray(strokes)) {
    return [];
  }

  return strokes
    .map((stroke) =>
      Array.isArray(stroke)
        ? stroke
            .map((point) => ({
              x:
                typeof point?.x === 'number' && Number.isFinite(point.x)
                  ? Math.max(0, Math.min(1, point.x))
                  : 0,
              y:
                typeof point?.y === 'number' && Number.isFinite(point.y)
                  ? Math.max(0, Math.min(1, point.y))
                  : 0,
            }))
            .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
        : [],
    )
    .filter((stroke) => stroke.length >= 2);
}

function normalizeSignatureColor(value: unknown) {
  if (typeof value !== 'string') {
    return '#111111';
  }

  const trimmed = value.trim();

  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) {
    return trimmed.toUpperCase();
  }

  return '#111111';
}

async function touchDocument(documentId: number) {
  if (!isPositiveInteger(documentId)) {
    return;
  }

  const db = await getDb();

  await db.runAsync(
    `
      UPDATE documents
      SET updated_at = ?
      WHERE id = ?
    `,
    new Date().toISOString(),
    documentId,
  );
}

async function deleteDocumentRow(documentId: number) {
  if (!isPositiveInteger(documentId)) {
    return;
  }

  const db = await getDb();

  await db.runAsync(
    `
      DELETE FROM documents
      WHERE id = ?
    `,
    documentId,
  );
}

async function getDocumentFilePaths(documentId: number) {
  if (!isPositiveInteger(documentId)) {
    return [];
  }

  const db = await getDb();

  const document = await db.getFirstAsync<{
    pdf_path: string | null;
    thumbnail_path: string | null;
    word_path: string | null;
  }>(
    `
      SELECT
        pdf_path,
        thumbnail_path,
        word_path
      FROM documents
      WHERE id = ?
    `,
    documentId,
  );

  const pages = await db.getAllAsync<{ image_path: string | null }>(
    `
      SELECT image_path
      FROM document_pages
      WHERE document_id = ?
    `,
    documentId,
  );

  return collectUniqueFilePaths([
    document?.pdf_path ?? null,
    document?.thumbnail_path ?? null,
    document?.word_path ?? null,
    ...pages.map((page) => page.image_path),
  ]);
}

async function cleanupDocumentFiles(documentId: number) {
  const filePaths = await getDocumentFilePaths(documentId);

  await Promise.all(filePaths.map((filePath) => removeFileIfExists(filePath)));
}

async function invalidateDocumentOutput(documentId: number) {
  if (!isPositiveInteger(documentId)) {
    return;
  }

  const db = await getDb();

  const row = await db.getFirstAsync<{
    pdf_path: string | null;
    word_path: string | null;
  }>(
    `
      SELECT pdf_path, word_path
      FROM documents
      WHERE id = ?
    `,
    documentId,
  );

  await Promise.all(
    collectUniqueFilePaths([row?.pdf_path ?? null, row?.word_path ?? null]).map((uri) =>
      removeFileIfExists(uri),
    ),
  );

  await db.runAsync(
    `
      UPDATE documents
      SET
        pdf_path = NULL,
        status = 'draft',
        ocr_text = NULL,
        ocr_status = 'idle',
        ocr_updated_at = NULL,
        ocr_error = NULL,
        word_path = NULL,
        word_updated_at = NULL,
        updated_at = ?
      WHERE id = ?
    `,
    new Date().toISOString(),
    documentId,
  );
}

async function createDocumentRow(title: string) {
  const db = await getDb();
  const now = new Date().toISOString();

  await db.runAsync(
    `
      INSERT INTO documents (
        title,
        status,
        pdf_path,
        thumbnail_path,
        created_at,
        updated_at
      )
      VALUES (?, 'draft', NULL, NULL, ?, ?)
    `,
    title,
    now,
    now,
  );

  const row = await db.getFirstAsync<{ id: number }>(
    'SELECT last_insert_rowid() AS id',
  );

  if (!row?.id) {
    throw new Error('Belge kaydı oluşturulamadı.');
  }

  return {
    documentId: row.id,
    createdAt: now,
  };
}

async function createImportedPdfDocumentRow(
  title: string,
  pdfPath: string,
  thumbnailPath: string | null,
) {
  const db = await getDb();
  const now = new Date().toISOString();

  await db.runAsync(
    `
      INSERT INTO documents (
        title,
        status,
        pdf_path,
        thumbnail_path,
        created_at,
        updated_at
      )
      VALUES (?, 'ready', ?, ?, ?, ?)
    `,
    title,
    pdfPath,
    thumbnailPath,
    now,
    now,
  );

  const row = await db.getFirstAsync<{ id: number }>(
    'SELECT last_insert_rowid() AS id',
  );

  if (!row?.id) {
    throw new Error('PDF belge kaydı oluşturulamadı.');
  }

  return {
    documentId: row.id,
    createdAt: now,
  };
}

async function updateDocumentThumbnail(
  documentId: number,
  thumbnailPath: string | null,
) {
  const db = await getDb();

  await db.runAsync(
    `
      UPDATE documents
      SET
        thumbnail_path = ?,
        updated_at = ?
      WHERE id = ?
    `,
    thumbnailPath,
    new Date().toISOString(),
    documentId,
  );
}

async function insertPageRows(
  documentId: number,
  sourceUris: string[],
  createdAt: string,
  startOrder = 0,
) {
  const db = await getDb();
  const persistedUris: string[] = [];

  try {
    for (let index = 0; index < sourceUris.length; index += 1) {
      const persisted = await persistImportedImage(sourceUris[index], 'page');
      persistedUris.push(persisted.uri);

      await db.runAsync(
        `
          INSERT INTO document_pages (
            document_id,
            image_path,
            page_order,
            width,
            height,
            created_at
          )
          VALUES (?, ?, ?, NULL, NULL, ?)
        `,
        documentId,
        persisted.uri,
        startOrder + index,
        createdAt,
      );
    }

    return persistedUris;
  } catch (error) {
    await Promise.all(persistedUris.map((uri) => removeFileIfExists(uri)));
    throw error;
  }
}

async function createDraftFromSourceImages(
  sourceUris: string[],
): Promise<CreateDraftResult> {
  const filteredSourceUris = sourceUris
    .map((uri) => uri?.trim())
    .filter((uri): uri is string => Boolean(uri));

  if (!filteredSourceUris.length) {
    throw new Error('Taslak oluşturmak için en az bir görsel gerekli.');
  }

  const title = buildDocumentTitle();
  const { documentId, createdAt } = await createDocumentRow(title);

  try {
    const persistedUris = await insertPageRows(
      documentId,
      filteredSourceUris,
      createdAt,
      0,
    );

    await updateDocumentThumbnail(documentId, persistedUris[0] ?? null);

    return {
      documentId,
      title,
    };
  } catch (error) {
    try {
      await cleanupDocumentFiles(documentId);
    } catch (cleanupError) {
      console.warn('[DocumentService] Draft cleanup failed:', cleanupError);
    }

    await deleteDocumentRow(documentId);
    throw error;
  }
}

async function createDocumentFromImportedPdf(
  input: PickedImportFileInput,
): Promise<CreateDraftResult> {
  const normalizedUri = normalizeImportUri(input.uri);

  if (!normalizedUri) {
    throw new Error('Geçerli PDF dosyası bulunamadı.');
  }

  await ensureAppDirectories();

  const sourceFile = new File(normalizedUri);

  if (!sourceFile.exists) {
    throw new Error('Seçilen PDF dosyası okunamadı.');
  }

  const extension = isPdfImport(input)
    ? 'pdf'
    : getExtensionFromUri(normalizedUri) || 'pdf';

  const destinationFile = new File(
    getAppDirectories().pdfDirectory,
    buildUniqueImportedFileName(input.name, extension),
  );

  if (destinationFile.exists) {
    destinationFile.delete();
  }

  sourceFile.copy(destinationFile);

  let thumbnailPath: string | null = null;

  try {
    const title = buildDocumentTitleFromFileName(input.name);

    try {
      thumbnailPath = await generateImportedPdfThumbnail({
        pdfUri: destinationFile.uri,
        pageNumber: 1,
        scale: 1.4,
        prefix: 'pdf-thumb',
      });
    } catch (thumbnailError) {
      console.warn(
        '[DocumentService] Imported PDF thumbnail generation failed:',
        thumbnailError,
      );
      thumbnailPath = null;
    }

    const { documentId } = await createImportedPdfDocumentRow(
      title,
      destinationFile.uri,
      thumbnailPath,
    );

    return {
      documentId,
      title,
    };
  } catch (error) {
    await removeFileIfExists(destinationFile.uri);

    if (thumbnailPath) {
      await removeFileIfExists(thumbnailPath);
    }

    throw error;
  }
}

async function getPageRow(pageId: number) {
  if (!isPositiveInteger(pageId)) {
    throw new Error('Geçersiz sayfa kimliği.');
  }

  const db = await getDb();
  const row = await db.getFirstAsync<{
    id: number;
    document_id: number;
    page_order: number;
    image_path: string;
  }>(
    `
      SELECT id, document_id, page_order, image_path
      FROM document_pages
      WHERE id = ?
    `,
    pageId,
  );

  if (!row) {
    throw new Error('Sayfa bulunamadı.');
  }

  return row;
}

async function replaceDocumentPageImage(
  pageId: number,
  nextSourceUri: string,
  persistPrefix: string,
) {
  const page = await getPageRow(pageId);
  const persisted = await persistImportedImage(nextSourceUri, persistPrefix);
  let pageUpdated = false;

  try {
    const db = await getDb();

    await db.runAsync(
      `
        UPDATE document_pages
        SET image_path = ?
        WHERE id = ?
      `,
      persisted.uri,
      pageId,
    );

    pageUpdated = true;

    const detail = await getDocumentDetail(page.document_id);
    const firstPage = detail.pages.find((item) => item.page_order === 0);

    await updateDocumentThumbnail(page.document_id, firstPage?.image_path ?? persisted.uri);
    await invalidateDocumentOutput(page.document_id);
    await removeFileIfExists(page.image_path);

    return {
      documentId: page.document_id,
      pageId,
      imageUri: persisted.uri,
    };
  } catch (error) {
    if (!pageUpdated) {
      await removeFileIfExists(persisted.uri);
    }

    throw error;
  }
}

export async function createDraftFromImportedImage(sourceUri: string) {
  return createDraftFromSourceImages([sourceUri]);
}

export async function createDraftFromImportedImages(sourceUris: string[]) {
  return createDraftFromSourceImages(sourceUris);
}

export async function createDraftFromScannedImages(sourceUris: string[]) {
  return createDraftFromSourceImages(sourceUris);
}

export async function appendScannedPagesToDocument(
  documentId: number,
  sourceUris: string[],
) {
  if (!isPositiveInteger(documentId)) {
    throw new Error('Geçersiz belge kimliği.');
  }

  const filteredSourceUris = sourceUris
    .map((uri) => uri?.trim())
    .filter((uri): uri is string => Boolean(uri));

  if (!filteredSourceUris.length) {
    throw new Error('Eklenecek geçerli tarama bulunamadı.');
  }

  const document = await getDocumentDetail(documentId);
  const lastOrder = document.pages.length
    ? Math.max(...document.pages.map((page) => page.page_order))
    : -1;
  const now = new Date().toISOString();

  const persistedUris = await insertPageRows(
    documentId,
    filteredSourceUris,
    now,
    lastOrder + 1,
  );

  if (!document.thumbnail_path && persistedUris[0]) {
    await updateDocumentThumbnail(documentId, persistedUris[0]);
  }

  await invalidateDocumentOutput(documentId);

  return {
    documentId,
    addedPageCount: persistedUris.length,
  };
}

export async function replaceDocumentPageFromScan(pageId: number, sourceUri: string) {
  return replaceDocumentPageImage(pageId, sourceUri, 'page-retake');
}

export async function rotateDocumentPage(pageId: number) {
  if (!isPositiveInteger(pageId)) {
    throw new Error('Geçersiz sayfa kimliği.');
  }

  const page = await getPageRow(pageId);
  const rotatedTempUri = await rotateImageRight(page.image_path);

  try {
    return await replaceDocumentPageImage(pageId, rotatedTempUri, 'page-rotated');
  } finally {
    if (rotatedTempUri && rotatedTempUri !== page.image_path) {
      await removeFileIfExists(rotatedTempUri);
    }
  }
}

export async function rotateDocumentPageLeft(pageId: number) {
  if (!isPositiveInteger(pageId)) {
    throw new Error('Geçersiz sayfa kimliği.');
  }

  const page = await getPageRow(pageId);
  const temporaryUris: string[] = [];
  let currentUri = page.image_path;

  try {
    for (let index = 0; index < 3; index += 1) {
      const rotatedUri = await rotateImageRight(currentUri);

      if (currentUri !== page.image_path) {
        temporaryUris.push(currentUri);
      }

      currentUri = rotatedUri;
    }

    return await replaceDocumentPageImage(pageId, currentUri, 'page-rotated-left');
  } finally {
    await Promise.all(
      collectUniqueFilePaths([
        ...temporaryUris,
        currentUri !== page.image_path ? currentUri : null,
      ]).map((uri) => removeFileIfExists(uri)),
    );
  }
}

export async function autoCropDocumentPage(pageId: number) {
  if (!isPositiveInteger(pageId)) {
    throw new Error('Geçersiz sayfa kimliği.');
  }

  const page = await getPageRow(pageId);
  const size = await resolveImageSize(page.image_path);

  const marginX = Math.max(8, Math.round(size.width * 0.025));
  const marginY = Math.max(8, Math.round(size.height * 0.025));
  const cropWidth = Math.max(1, size.width - marginX * 2);
  const cropHeight = Math.max(1, size.height - marginY * 2);

  if (cropWidth <= 1 || cropHeight <= 1) {
    throw new Error('Sayfa kırpılamadı.');
  }

  const context = ImageManipulator.manipulate(page.image_path);
  context.crop({
    originX: marginX,
    originY: marginY,
    width: cropWidth,
    height: cropHeight,
  });

  const rendered = await context.renderAsync();
  const cropped = await rendered.saveAsync({
    format: shouldPreserveTransparency(page.image_path)
      ? SaveFormat.PNG
      : SaveFormat.JPEG,
    compress: 0.98,
  });

  try {
    return await replaceDocumentPageImage(pageId, cropped.uri, 'page-cropped');
  } finally {
    await removeFileIfExists(cropped.uri);
  }
}

export async function importDocumentsFromPickedFiles(
  files: PickedImportFileInput[],
): Promise<ImportPickedFilesResult> {
  const normalizedInputs = files
    .map((file) => ({
      uri: file.uri?.trim() ?? '',
      name: file.name?.trim() ?? null,
      mimeType: file.mimeType?.trim() ?? null,
    }))
    .filter((file) => file.uri.length > 0);

  if (!normalizedInputs.length) {
    throw new Error('İçe aktarılacak geçerli dosya bulunamadı.');
  }

  const imageFiles = normalizedInputs.filter(isImageImport);
  const pdfFiles = normalizedInputs.filter(isPdfImport);
  const unsupportedFiles = normalizedInputs
    .filter((file) => !isImageImport(file) && !isPdfImport(file))
    .map(getImportDisplayName);

  const createdDocumentIds: number[] = [];

  if (imageFiles.length > 0) {
    const imageDraft = await createDraftFromSourceImages(
      imageFiles.map((file) => file.uri),
    );
    createdDocumentIds.push(imageDraft.documentId);
  }

  for (const pdfFile of pdfFiles) {
    const importedPdf = await createDocumentFromImportedPdf(pdfFile);
    createdDocumentIds.push(importedPdf.documentId);
  }

  if (!createdDocumentIds.length) {
    if (unsupportedFiles.length > 0) {
      throw new Error('Seçilen dosya türleri henüz desteklenmiyor.');
    }

    throw new Error('İçe aktarılabilecek dosya bulunamadı.');
  }

  return {
    firstDocumentId: createdDocumentIds[0],
    createdDocumentIds,
    createdCount: createdDocumentIds.length,
    importedImageCount: imageFiles.length,
    importedPdfCount: pdfFiles.length,
    unsupportedFiles,
  };
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const db = await getDb();

  const documentRow = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM documents',
  );
  const pageRow = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM document_pages',
  );
  const assetRow = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM assets',
  );

  return {
    documents: documentRow?.count ?? 0,
    pages: pageRow?.count ?? 0,
    assets: assetRow?.count ?? 0,
  };
}

export async function getRecentDocuments(limit = 20): Promise<DocumentSummary[]> {
  const db = await getDb();

  return db.getAllAsync<DocumentSummary>(
    `
      SELECT
        d.id,
        d.title,
        d.status,
        d.pdf_path,
        d.thumbnail_path,
        COALESCE(d.ocr_status, 'idle') AS ocr_status,
        d.word_path,
        d.created_at,
        d.updated_at,
        COALESCE((
          SELECT COUNT(*)
          FROM document_pages p
          WHERE p.document_id = d.id
        ), 0) AS page_count
      FROM documents d
      ORDER BY d.updated_at DESC
      LIMIT ?
    `,
    normalizeListLimit(limit),
  );
}

export async function listDocuments(limit = 50): Promise<DocumentSummary[]> {
  return getRecentDocuments(limit);
}

export async function getDocuments(limit = 50): Promise<DocumentSummary[]> {
  return getRecentDocuments(limit);
}

export async function getLatestDocument(): Promise<LatestDocument> {
  const db = await getDb();

  const row = await db.getFirstAsync<LatestDocument>(
    `
      SELECT
        id,
        title
      FROM documents
      ORDER BY updated_at DESC
      LIMIT 1
    `,
  );

  return row ?? null;
}

export async function getDocumentDetail(
  documentId: number,
): Promise<DocumentDetail> {
  if (!isPositiveInteger(documentId)) {
    throw new Error('Geçersiz belge kimliği.');
  }

  const db = await getDb();

  const document = await db.getFirstAsync<Omit<DocumentDetail, 'pages'>>(
    `
      SELECT
        id,
        title,
        status,
        pdf_path,
        thumbnail_path,
        ocr_text,
        COALESCE(ocr_status, 'idle') AS ocr_status,
        ocr_updated_at,
        ocr_error,
        word_path,
        word_updated_at,
        created_at,
        updated_at
      FROM documents
      WHERE id = ?
    `,
    documentId,
  );

  if (!document) {
    throw new Error('Belge bulunamadı.');
  }

  const pages = await db.getAllAsync<DocumentPage>(
    `
      SELECT
        id,
        document_id,
        image_path,
        page_order,
        width,
        height,
        created_at
      FROM document_pages
      WHERE document_id = ?
      ORDER BY page_order ASC
    `,
    documentId,
  );

  return {
    ...document,
    pages,
  };
}

export async function extractDocumentText(
  documentId: number,
): Promise<ExtractDocumentTextResult> {
  if (!isPositiveInteger(documentId)) {
    throw new Error('Geçersiz belge kimliği.');
  }

  const db = await getDb();
  const document = await getDocumentDetail(documentId);

  if (!document.pages.length) {
    throw new Error(
      'Bu belge dışarıdan PDF olarak içe aktarılmış. OCR için önce sayfa görselleri olan bir belge gerekir.',
    );
  }

  const startedAt = new Date().toISOString();

  await db.runAsync(
    `
      UPDATE documents
      SET
        ocr_status = 'processing',
        ocr_error = NULL,
        updated_at = ?
      WHERE id = ?
    `,
    startedAt,
    documentId,
  );

  try {
    const extraction = await extractTextFromDocumentPages(
      document.pages.map((page) => ({
        pageId: page.id,
        pageOrder: page.page_order,
        imageUri: page.image_path,
      })),
    );

    const extractedAt = new Date().toISOString();
    const normalizedText = normalizeDocumentText(extraction.text);
    const previousWordPath = document.word_path;

    await db.runAsync(
      `
        UPDATE documents
        SET
          ocr_text = ?,
          ocr_status = 'ready',
          ocr_updated_at = ?,
          ocr_error = NULL,
          word_path = NULL,
          word_updated_at = NULL,
          updated_at = ?
        WHERE id = ?
      `,
      normalizedText,
      extractedAt,
      extractedAt,
      documentId,
    );

    if (previousWordPath) {
      await removeFileIfExists(previousWordPath);
    }

    return {
      documentId,
      text: normalizedText,
      ocrStatus: 'ready',
      extractedPageCount: extraction.pages.length,
      extractedCharacterCount: normalizedText.length,
      extractedAt,
    };
  } catch (error) {
    const failedAt = new Date().toISOString();
    const message = getErrorMessage(
      error,
      'Belgeden metin çıkarılırken beklenmeyen hata oluştu.',
    );

    await db.runAsync(
      `
        UPDATE documents
        SET
          ocr_status = 'failed',
          ocr_error = ?,
          ocr_updated_at = ?,
          updated_at = ?
        WHERE id = ?
      `,
      message,
      failedAt,
      failedAt,
      documentId,
    );

    throw error;
  }
}

export async function exportDocumentToWord(
  documentId: number,
): Promise<WordExportResult> {
  if (!isPositiveInteger(documentId)) {
    throw new Error('Geçersiz belge kimliği.');
  }

  const db = await getDb();
  const document = await getDocumentDetail(documentId);

  if (!document.pages.length) {
    throw new Error(
      'Bu belge dışarıdan PDF olarak içe aktarılmış. Word çıktısı için önce sayfa görselleri olan bir belge gerekir.',
    );
  }

  let text = document.ocr_text;
  let ocrUpdatedAt = document.ocr_updated_at;

  if (document.ocr_status !== 'ready' || text === null) {
    const extraction = await extractDocumentText(documentId);
    text = extraction.text;
    ocrUpdatedAt = extraction.extractedAt;
  }

  const normalizedText = normalizeDocumentText(text);

  const wordInput: BuildWordDocumentInput = {
    title: document.title,
    text: normalizedText,
    pageCount: document.pages.length,
    generatedAt: new Date().toISOString(),
    ocrUpdatedAt,
  };

  const bytes = await buildWordDocumentBytes(wordInput);
  const previousWordPath = document.word_path;
  const wordFile = await writeWordBytes(document.title, bytes);
  const exportedAt = new Date().toISOString();

  try {
    await db.runAsync(
      `
        UPDATE documents
        SET
          word_path = ?,
          word_updated_at = ?,
          updated_at = ?
        WHERE id = ?
      `,
      wordFile.fileUri,
      exportedAt,
      exportedAt,
      documentId,
    );
  } catch (error) {
    await removeFileIfExists(wordFile.fileUri);
    throw error;
  }

  if (previousWordPath && previousWordPath !== wordFile.fileUri) {
    await removeFileIfExists(previousWordPath);
  }

  return {
    fileName: wordFile.fileName,
    fileUri: wordFile.fileUri,
    contentUri: wordFile.contentUri,
    documentId,
    textLength: normalizedText.length,
    exportedAt,
  };
}

export async function exportDocumentToPdf(documentId: number) {
  if (!isPositiveInteger(documentId)) {
    throw new Error('Geçersiz belge kimliği.');
  }

  const db = await getDb();
  const document = await getDocumentDetail(documentId);

  if (!document.pages.length) {
    throw new Error('PDF oluşturmak için en az bir sayfa gerekli.');
  }

  const optimizedPages: Array<{
    pageId: number;
    imageUri: string;
  }> = [];

  const temporaryPageUris: string[] = [];

  try {
    for (const page of document.pages) {
      const optimizedUri = await optimizeImageForPdf(page.image_path, 'balanced');

      if (optimizedUri !== page.image_path) {
        temporaryPageUris.push(optimizedUri);
      }

      optimizedPages.push({
        pageId: page.id,
        imageUri: optimizedUri,
      });
    }

    const rawOverlays = await getDocumentOverlays(documentId);
    const resolvedOverlays: PdfOverlay[] = [];
    const assetCache = new Map<number, string>();

    for (const overlay of rawOverlays) {
      if (!overlay.page_id) {
        continue;
      }

      const parsed = safeParseOverlayContent(overlay.content);

      if (overlay.type === 'stamp') {
        const assetId = parsed?.assetId;

        if (!assetId || !isPositiveInteger(assetId)) {
          continue;
        }

        let assetPath = assetCache.get(assetId);

        if (!assetPath) {
          const asset = await getAssetById(assetId);

          if (!asset?.file_path) {
            continue;
          }

          assetPath = asset.file_path;
          assetCache.set(assetId, assetPath);
        }

        resolvedOverlays.push({
          type: 'stamp',
          pageId: overlay.page_id,
          imageUri: assetPath,
          x: overlay.x,
          y: overlay.y,
          width: overlay.width,
          height: overlay.height,
          rotation: overlay.rotation,
          opacity: overlay.opacity,
        });

        continue;
      }

      if (overlay.type === 'signature') {
        const signatureStrokes = normalizeSignatureStrokes(parsed?.strokes);
        const strokeColor = getOverlaySignatureColor(overlay);

        if (signatureStrokes.length > 0) {
          resolvedOverlays.push({
            type: 'signature',
            pageId: overlay.page_id,
            x: overlay.x,
            y: overlay.y,
            width: overlay.width,
            height: overlay.height,
            rotation: overlay.rotation,
            opacity: overlay.opacity,
            strokes: signatureStrokes,
            strokeColor: normalizeSignatureColor(strokeColor),
          });
          continue;
        }

        const assetId = parsed?.assetId;

        if (assetId && isPositiveInteger(assetId)) {
          let assetPath = assetCache.get(assetId);

          if (!assetPath) {
            const asset = await getAssetById(assetId);

            if (!asset?.file_path) {
              continue;
            }

            assetPath = asset.file_path;
            assetCache.set(assetId, assetPath);
          }

          resolvedOverlays.push({
            type: 'signature',
            pageId: overlay.page_id,
            imageUri: assetPath,
            x: overlay.x,
            y: overlay.y,
            width: overlay.width,
            height: overlay.height,
            rotation: overlay.rotation,
            opacity: overlay.opacity,
            strokeColor: normalizeSignatureColor(parsed?.strokeColor),
          });
        }
      }
    }

    const previousPdfPath = document.pdf_path;
    const isPro = useBillingStore.getState().isPro;

    const pdf = await buildPdfFromImages({
      title: document.title,
      pages: optimizedPages,
      overlays: resolvedOverlays,
      author: 'PDF Kaşe',
      subject: 'Taranmış belge',
      creator: 'PDF Kaşe',
      addFreeWatermark: !isPro,
    });

    await db.runAsync(
      `
        UPDATE documents
        SET
          pdf_path = ?,
          status = 'ready',
          updated_at = ?
        WHERE id = ?
      `,
      pdf.fileUri,
      new Date().toISOString(),
      documentId,
    );

    if (previousPdfPath && previousPdfPath !== pdf.fileUri) {
      await removeFileIfExists(previousPdfPath);
    }

    return pdf;
  } finally {
    await Promise.all(
      collectUniqueFilePaths(temporaryPageUris).map((uri) => removeFileIfExists(uri)),
    );
  }
}

export const documentService = {
  createDraftFromImportedImage,
  createDraftFromImportedImages,
  createDraftFromScannedImages,
  appendScannedPagesToDocument,
  replaceDocumentPageFromScan,
  rotateDocumentPage,
  rotateDocumentPageLeft,
  autoCropDocumentPage,
  importDocumentsFromPickedFiles,
  getDashboardStats,
  getRecentDocuments,
  listDocuments,
  getDocuments,
  getLatestDocument,
  getDocumentDetail,
  extractDocumentText,
  exportDocumentToWord,
  exportDocumentToPdf,
  touchDocument,
};