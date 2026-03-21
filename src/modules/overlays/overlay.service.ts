import { getDb } from '../../db/sqlite';
import { getAssetById } from '../assets/asset.service';
import { removeFileIfExists } from '../storage/file.service';

export type OverlayType = 'stamp' | 'signature' | 'text';

export type SignatureStrokePoint = {
  x: number;
  y: number;
};

export type SignatureStroke = SignatureStrokePoint[];

export type DocumentOverlay = {
  id: number;
  document_id: number;
  page_id: number | null;
  type: OverlayType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  content: string | null;
  created_at: string;
};

export type StampOverlayPayload = {
  documentId: number;
  pageId: number;
  assetId: number;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  opacity?: number;
};

export type SignatureOverlayPayload = {
  documentId: number;
  pageId: number;
  x: number;
  y: number;
  width: number;
  height: number;
  strokes: SignatureStroke[];
  strokeColor?: string;
  rotation?: number;
  opacity?: number;
};

export type SignatureAssetOverlayPayload = {
  documentId: number;
  pageId: number;
  assetId: number;
  x: number;
  y: number;
  width: number;
  height: number;
  strokeColor?: string;
  rotation?: number;
  opacity?: number;
};

export type UpdateOverlayTransformPayload = {
  overlayId: number;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  opacity?: number;
};

export type ReplaceStampOverlayAssetPayload = {
  overlayId: number;
  assetId: number;
};

export type UpdateSignatureOverlayStylePayload = {
  overlayId: number;
  strokeColor?: string;
  opacity?: number;
};

type OverlayContentShape = {
  assetId?: number;
  strokes?: SignatureStroke[];
  strokeColor?: string;
  color?: string;
};

const DEFAULT_SIGNATURE_COLOR = '#111111';

function isPositiveInteger(value: number) {
  return Number.isInteger(value) && value > 0;
}

function clamp01(value: number) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 0;
  }

  return Math.max(0, Math.min(1, value));
}

function normalizeRotation(value?: number) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 0;
  }

  return value;
}

function normalizeSignatureColor(value?: string | null) {
  if (typeof value !== 'string') {
    return DEFAULT_SIGNATURE_COLOR;
  }

  const trimmed = value.trim();

  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) {
    return trimmed.toUpperCase();
  }

  return DEFAULT_SIGNATURE_COLOR;
}

function safeParseOverlayContent(content: string | null): OverlayContentShape | null {
  if (!content) {
    return null;
  }

  try {
    return JSON.parse(content) as OverlayContentShape;
  } catch {
    return null;
  }
}

function buildStampOverlayContent(assetId: number) {
  return JSON.stringify({ assetId });
}

function normalizeSignatureStrokes(strokes: SignatureStroke[]) {
  if (!Array.isArray(strokes)) {
    throw new Error('Geçerli imza verisi gerekli.');
  }

  const normalized = strokes
    .map((stroke) =>
      Array.isArray(stroke)
        ? stroke
            .map((point) => ({
              x: clamp01(point?.x),
              y: clamp01(point?.y),
            }))
            .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
        : [],
    )
    .filter((stroke) => stroke.length >= 2);

  if (!normalized.length) {
    throw new Error('Kaydedilecek geçerli imza çizgisi bulunamadı.');
  }

  return normalized;
}

function buildSignatureOverlayContent(
  strokes: SignatureStroke[],
  strokeColor?: string,
) {
  const normalizedColor = normalizeSignatureColor(strokeColor);

  return JSON.stringify({
    strokes: normalizeSignatureStrokes(strokes),
    strokeColor: normalizedColor,
    color: normalizedColor,
  });
}

function buildSignatureAssetOverlayContent(
  assetId: number,
  strokeColor?: string,
) {
  const normalizedColor = normalizeSignatureColor(strokeColor);

  return JSON.stringify({
    assetId,
    strokeColor: normalizedColor,
    color: normalizedColor,
  });
}

function normalizeOverlayFrame(input: {
  x: number;
  y: number;
  width: number;
  height: number;
}) {
  const width = clamp01(input.width);
  const height = clamp01(input.height);

  if (width <= 0 || height <= 0) {
    throw new Error('Overlay boyutu sıfırdan büyük olmalı.');
  }

  const x = Math.min(clamp01(input.x), 1 - width);
  const y = Math.min(clamp01(input.y), 1 - height);

  return {
    x: Math.max(0, x),
    y: Math.max(0, y),
    width,
    height,
  };
}

async function markDocumentDirty(documentId: number) {
  if (!isPositiveInteger(documentId)) {
    return;
  }

  const db = await getDb();
  const row = await db.getFirstAsync<{ pdf_path: string | null }>(
    `
      SELECT pdf_path
      FROM documents
      WHERE id = ?
    `,
    documentId,
  );

  if (row?.pdf_path) {
    await removeFileIfExists(row.pdf_path);
  }

  await db.runAsync(
    `
      UPDATE documents
      SET
        pdf_path = NULL,
        status = 'draft',
        updated_at = ?
      WHERE id = ?
    `,
    new Date().toISOString(),
    documentId,
  );
}

async function assertDocumentExists(documentId: number) {
  const db = await getDb();
  const row = await db.getFirstAsync<{ id: number }>(
    `
      SELECT id
      FROM documents
      WHERE id = ?
    `,
    documentId,
  );

  if (!row?.id) {
    throw new Error('Belge bulunamadı.');
  }
}

async function assertPageBelongsToDocument(pageId: number, documentId: number) {
  const db = await getDb();
  const row = await db.getFirstAsync<{ id: number }>(
    `
      SELECT id
      FROM document_pages
      WHERE id = ? AND document_id = ?
    `,
    pageId,
    documentId,
  );

  if (!row?.id) {
    throw new Error('Sayfa bilgisi belge ile eşleşmiyor.');
  }
}

async function assertAssetExists(
  assetId: number,
  expectedType?: 'stamp' | 'signature',
) {
  const asset = await getAssetById(assetId);

  if (!asset) {
    throw new Error('Seçilen görsel bulunamadı.');
  }

  if (expectedType && asset.type !== expectedType) {
    throw new Error(
      expectedType === 'signature'
        ? 'Seçilen imza görseli bulunamadı.'
        : 'Seçilen kaşe görseli bulunamadı.',
    );
  }

  return asset;
}

export function getOverlayAssetId(overlay: Pick<DocumentOverlay, 'content'>): number | null {
  const parsed = safeParseOverlayContent(overlay.content);
  const assetId = parsed?.assetId;

  return typeof assetId === 'number' && Number.isFinite(assetId) ? assetId : null;
}

export function getOverlaySignatureColor(
  overlay: Pick<DocumentOverlay, 'content'>,
): string {
  const parsed = safeParseOverlayContent(overlay.content);
  return normalizeSignatureColor(parsed?.strokeColor ?? parsed?.color);
}

export function getOverlaySignatureStrokes(
  overlay: Pick<DocumentOverlay, 'content'>,
): SignatureStroke[] {
  const parsed = safeParseOverlayContent(overlay.content);
  const strokes = parsed?.strokes;

  if (!Array.isArray(strokes)) {
    return [];
  }

  return strokes
    .map((stroke) =>
      Array.isArray(stroke)
        ? stroke
            .map((point) => ({
              x: clamp01(point?.x),
              y: clamp01(point?.y),
            }))
            .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
        : [],
    )
    .filter((stroke) => stroke.length >= 2);
}

export async function getOverlayById(overlayId: number) {
  if (!isPositiveInteger(overlayId)) {
    return null;
  }

  const db = await getDb();

  return db.getFirstAsync<DocumentOverlay>(
    `
      SELECT
        id,
        document_id,
        page_id,
        type,
        x,
        y,
        width,
        height,
        rotation,
        opacity,
        content,
        created_at
      FROM overlay_items
      WHERE id = ?
    `,
    overlayId,
  );
}

export async function addStampOverlay(payload: StampOverlayPayload) {
  if (!isPositiveInteger(payload.documentId)) {
    throw new Error('Geçerli belge bilgisi gerekli.');
  }

  if (!isPositiveInteger(payload.pageId)) {
    throw new Error('Geçerli sayfa bilgisi gerekli.');
  }

  if (!isPositiveInteger(payload.assetId)) {
    throw new Error('Geçerli asset bilgisi gerekli.');
  }

  const normalizedFrame = normalizeOverlayFrame({
    x: payload.x,
    y: payload.y,
    width: payload.width,
    height: payload.height,
  });

  await assertDocumentExists(payload.documentId);
  await assertPageBelongsToDocument(payload.pageId, payload.documentId);
  await assertAssetExists(payload.assetId, 'stamp');

  const db = await getDb();
  const now = new Date().toISOString();

  await db.runAsync(
    `
      INSERT INTO overlay_items (
        document_id,
        page_id,
        type,
        x,
        y,
        width,
        height,
        rotation,
        opacity,
        content,
        created_at
      )
      VALUES (?, ?, 'stamp', ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    payload.documentId,
    payload.pageId,
    normalizedFrame.x,
    normalizedFrame.y,
    normalizedFrame.width,
    normalizedFrame.height,
    normalizeRotation(payload.rotation),
    clamp01(payload.opacity ?? 1),
    buildStampOverlayContent(payload.assetId),
    now,
  );

  const row = await db.getFirstAsync<{ id: number }>(
    'SELECT last_insert_rowid() AS id',
  );

  if (!row?.id) {
    throw new Error('Overlay kaydedilemedi.');
  }

  await markDocumentDirty(payload.documentId);

  return row.id;
}

export async function addSignatureOverlay(payload: SignatureOverlayPayload) {
  if (!isPositiveInteger(payload.documentId)) {
    throw new Error('Geçerli belge bilgisi gerekli.');
  }

  if (!isPositiveInteger(payload.pageId)) {
    throw new Error('Geçerli sayfa bilgisi gerekli.');
  }

  const normalizedFrame = normalizeOverlayFrame({
    x: payload.x,
    y: payload.y,
    width: payload.width,
    height: payload.height,
  });

  const content = buildSignatureOverlayContent(
    payload.strokes,
    payload.strokeColor,
  );

  await assertDocumentExists(payload.documentId);
  await assertPageBelongsToDocument(payload.pageId, payload.documentId);

  const db = await getDb();
  const now = new Date().toISOString();

  await db.runAsync(
    `
      INSERT INTO overlay_items (
        document_id,
        page_id,
        type,
        x,
        y,
        width,
        height,
        rotation,
        opacity,
        content,
        created_at
      )
      VALUES (?, ?, 'signature', ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    payload.documentId,
    payload.pageId,
    normalizedFrame.x,
    normalizedFrame.y,
    normalizedFrame.width,
    normalizedFrame.height,
    normalizeRotation(payload.rotation),
    clamp01(payload.opacity ?? 1),
    content,
    now,
  );

  const row = await db.getFirstAsync<{ id: number }>(
    'SELECT last_insert_rowid() AS id',
  );

  if (!row?.id) {
    throw new Error('İmza kaydedilemedi.');
  }

  await markDocumentDirty(payload.documentId);

  return row.id;
}

export async function addSignatureAssetOverlay(
  payload: SignatureAssetOverlayPayload,
) {
  if (!isPositiveInteger(payload.documentId)) {
    throw new Error('Geçerli belge bilgisi gerekli.');
  }

  if (!isPositiveInteger(payload.pageId)) {
    throw new Error('Geçerli sayfa bilgisi gerekli.');
  }

  if (!isPositiveInteger(payload.assetId)) {
    throw new Error('Geçerli imza bilgisi gerekli.');
  }

  const normalizedFrame = normalizeOverlayFrame({
    x: payload.x,
    y: payload.y,
    width: payload.width,
    height: payload.height,
  });

  await assertDocumentExists(payload.documentId);
  await assertPageBelongsToDocument(payload.pageId, payload.documentId);
  await assertAssetExists(payload.assetId, 'signature');

  const db = await getDb();
  const now = new Date().toISOString();

  await db.runAsync(
    `
      INSERT INTO overlay_items (
        document_id,
        page_id,
        type,
        x,
        y,
        width,
        height,
        rotation,
        opacity,
        content,
        created_at
      )
      VALUES (?, ?, 'signature', ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    payload.documentId,
    payload.pageId,
    normalizedFrame.x,
    normalizedFrame.y,
    normalizedFrame.width,
    normalizedFrame.height,
    normalizeRotation(payload.rotation),
    clamp01(payload.opacity ?? 1),
    buildSignatureAssetOverlayContent(payload.assetId, payload.strokeColor),
    now,
  );

  const row = await db.getFirstAsync<{ id: number }>(
    'SELECT last_insert_rowid() AS id',
  );

  if (!row?.id) {
    throw new Error('Hazır imza kaydedilemedi.');
  }

  await markDocumentDirty(payload.documentId);

  return row.id;
}

export async function updateOverlayTransform(payload: UpdateOverlayTransformPayload) {
  if (!isPositiveInteger(payload.overlayId)) {
    throw new Error('Geçerli overlay bilgisi gerekli.');
  }

  const overlay = await getOverlayById(payload.overlayId);

  if (!overlay) {
    throw new Error('Overlay bulunamadı.');
  }

  const normalizedFrame = normalizeOverlayFrame({
    x: payload.x,
    y: payload.y,
    width: payload.width,
    height: payload.height,
  });

  const db = await getDb();

  await db.runAsync(
    `
      UPDATE overlay_items
      SET
        x = ?,
        y = ?,
        width = ?,
        height = ?,
        rotation = ?,
        opacity = ?
      WHERE id = ?
    `,
    normalizedFrame.x,
    normalizedFrame.y,
    normalizedFrame.width,
    normalizedFrame.height,
    normalizeRotation(payload.rotation),
    clamp01(payload.opacity ?? overlay.opacity),
    payload.overlayId,
  );

  await markDocumentDirty(overlay.document_id);

  return payload.overlayId;
}

export async function updateSignatureOverlayStyle(
  payload: UpdateSignatureOverlayStylePayload,
) {
  if (!isPositiveInteger(payload.overlayId)) {
    throw new Error('Geçerli overlay bilgisi gerekli.');
  }

  const overlay = await getOverlayById(payload.overlayId);

  if (!overlay) {
    throw new Error('Overlay bulunamadı.');
  }

  if (overlay.type !== 'signature') {
    throw new Error('Sadece imza overlay renk güncellemesi destekleniyor.');
  }

  const parsed = safeParseOverlayContent(overlay.content);
  const existingAssetId =
    typeof parsed?.assetId === 'number' && Number.isFinite(parsed.assetId)
      ? parsed.assetId
      : null;
  const existingStrokes = getOverlaySignatureStrokes(overlay);
  const currentOpacity = clamp01(payload.opacity ?? overlay.opacity);
  const nextColor = normalizeSignatureColor(
    payload.strokeColor ?? getOverlaySignatureColor(overlay),
  );

  let nextContent: string;

  if (existingAssetId) {
    nextContent = buildSignatureAssetOverlayContent(existingAssetId, nextColor);
  } else if (existingStrokes.length) {
    nextContent = buildSignatureOverlayContent(existingStrokes, nextColor);
  } else {
    throw new Error('Güncellenecek geçerli imza verisi bulunamadı.');
  }

  const db = await getDb();

  await db.runAsync(
    `
      UPDATE overlay_items
      SET
        content = ?,
        opacity = ?
      WHERE id = ?
    `,
    nextContent,
    currentOpacity,
    payload.overlayId,
  );

  await markDocumentDirty(overlay.document_id);

  return payload.overlayId;
}

export async function replaceStampOverlayAsset(payload: ReplaceStampOverlayAssetPayload) {
  if (!isPositiveInteger(payload.overlayId)) {
    throw new Error('Geçerli overlay bilgisi gerekli.');
  }

  if (!isPositiveInteger(payload.assetId)) {
    throw new Error('Geçerli asset bilgisi gerekli.');
  }

  const overlay = await getOverlayById(payload.overlayId);

  if (!overlay) {
    throw new Error('Overlay bulunamadı.');
  }

  if (overlay.type !== 'stamp') {
    throw new Error('Sadece kaşe overlay asset değişimi destekleniyor.');
  }

  await assertAssetExists(payload.assetId, 'stamp');

  const db = await getDb();

  await db.runAsync(
    `
      UPDATE overlay_items
      SET content = ?
      WHERE id = ?
    `,
    buildStampOverlayContent(payload.assetId),
    payload.overlayId,
  );

  await markDocumentDirty(overlay.document_id);

  return payload.overlayId;
}

export async function getDocumentOverlays(documentId: number) {
  if (!isPositiveInteger(documentId)) {
    return [];
  }

  const db = await getDb();

  return db.getAllAsync<DocumentOverlay>(
    `
      SELECT
        id,
        document_id,
        page_id,
        type,
        x,
        y,
        width,
        height,
        rotation,
        opacity,
        content,
        created_at
      FROM overlay_items
      WHERE document_id = ?
      ORDER BY page_id ASC, created_at ASC, id ASC
    `,
    documentId,
  );
}

export async function getPageOverlays(pageId: number) {
  if (!isPositiveInteger(pageId)) {
    return [];
  }

  const db = await getDb();

  return db.getAllAsync<DocumentOverlay>(
    `
      SELECT
        id,
        document_id,
        page_id,
        type,
        x,
        y,
        width,
        height,
        rotation,
        opacity,
        content,
        created_at
      FROM overlay_items
      WHERE page_id = ?
      ORDER BY created_at ASC, id ASC
    `,
    pageId,
  );
}

export async function deleteOverlay(overlayId: number) {
  if (!isPositiveInteger(overlayId)) {
    return;
  }

  const db = await getDb();

  const overlay = await db.getFirstAsync<{
    id: number;
    document_id: number;
  }>(
    `
      SELECT id, document_id
      FROM overlay_items
      WHERE id = ?
    `,
    overlayId,
  );

  if (!overlay) {
    return;
  }

  await db.runAsync(
    `
      DELETE FROM overlay_items
      WHERE id = ?
    `,
    overlayId,
  );

  await markDocumentDirty(overlay.document_id);
}

export async function deletePageOverlays(pageId: number) {
  if (!isPositiveInteger(pageId)) {
    return;
  }

  const db = await getDb();

  const rows = await db.getAllAsync<{ document_id: number }>(
    `
      SELECT DISTINCT document_id
      FROM overlay_items
      WHERE page_id = ?
    `,
    pageId,
  );

  await db.runAsync(
    `
      DELETE FROM overlay_items
      WHERE page_id = ?
    `,
    pageId,
  );

  for (const row of rows) {
    await markDocumentDirty(row.document_id);
  }
}
