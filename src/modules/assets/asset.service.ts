import { getDb } from '../../db/sqlite';
import {
  fileExists,
  persistAssetImage,
  removeFileIfExists,
  removeFilesIfExist,
} from '../storage/file.service';

export type AssetType = 'stamp' | 'signature';

export type AssetMetadata = Record<string, unknown>;

export type StoredAsset = {
  id: number;
  type: AssetType;
  name: string;
  file_path: string;
  original_file_path: string | null;
  preview_file_path: string | null;
  metadata: string | null;
  created_at: string;
};

export type UpdateAssetImageInput = {
  assetId: number;
  sourceUri: string;
  previewSourceUri?: string | null;
  metadataPatch?: AssetMetadata;
  preserveOriginal?: boolean;
};

type OverlayAssetRef = {
  assetId?: number;
};

function isPositiveInteger(value: number) {
  return Number.isInteger(value) && value > 0;
}

function buildDefaultAssetName(type: AssetType) {
  const prefix = type === 'stamp' ? 'Kaşe' : 'İmza';
  return `${prefix} ${new Date().toLocaleString('tr-TR')}`;
}

function safeParseOverlayAssetRef(content: string | null) {
  if (!content) {
    return null;
  }

  try {
    return JSON.parse(content) as OverlayAssetRef;
  } catch {
    return null;
  }
}

export function parseAssetMetadata(metadata: string | null): AssetMetadata {
  if (!metadata) {
    return {};
  }

  try {
    const parsed = JSON.parse(metadata) as unknown;

    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed as AssetMetadata;
    }

    return {};
  } catch {
    return {};
  }
}

function serializeAssetMetadata(metadata: AssetMetadata) {
  return JSON.stringify(metadata);
}

function buildAssetFilePrefix(type: AssetType) {
  return type === 'stamp' ? 'stamp' : 'signature';
}

function getUniqueFilePaths(paths: Array<string | null | undefined>) {
  return [...new Set(paths.filter((value): value is string => Boolean(value?.trim())))];
}

function withUpdatedMetadata(
  currentMetadata: string | null,
  patch?: AssetMetadata,
  extra?: AssetMetadata,
) {
  return serializeAssetMetadata({
    ...parseAssetMetadata(currentMetadata),
    ...patch,
    ...extra,
    updatedAt: new Date().toISOString(),
  });
}

async function getAssetOverlayUsageCount(assetId: number) {
  const db = await getDb();

  try {
    const row = await db.getFirstAsync<{ count: number }>(
      `
        SELECT COUNT(*) AS count
        FROM overlay_items
        WHERE json_extract(content, '$.assetId') = ?
      `,
      assetId,
    );

    return row?.count ?? 0;
  } catch {
    const rows = await db.getAllAsync<{ content: string | null }>(
      `
        SELECT content
        FROM overlay_items
        WHERE content LIKE '%assetId%'
      `,
    );

    let count = 0;

    for (const row of rows) {
      const parsed = safeParseOverlayAssetRef(row.content);

      if (parsed?.assetId === assetId) {
        count += 1;
      }
    }

    return count;
  }
}

export function getPreferredAssetPreviewUri(
  asset: Pick<StoredAsset, 'preview_file_path' | 'file_path'>,
) {
  return asset.preview_file_path?.trim() || asset.file_path;
}

export function hasAssetRestorableOriginal(
  asset: Pick<StoredAsset, 'original_file_path' | 'file_path'>,
) {
  return Boolean(
    asset.original_file_path?.trim() &&
      asset.original_file_path?.trim() !== asset.file_path,
  );
}

export async function createAssetFromImage(input: {
  sourceUri: string;
  type: AssetType;
  name?: string;
  metadata?: AssetMetadata;
  originalSourceUri?: string;
  previewSourceUri?: string | null;
}) {
  const sourceUri = input.sourceUri?.trim();

  if (!sourceUri) {
    throw new Error('Asset oluşturmak için geçerli görsel gerekli.');
  }

  const db = await getDb();
  const now = new Date().toISOString();
  const assetName = input.name?.trim() || buildDefaultAssetName(input.type);

  const persistedMain = await persistAssetImage(
    sourceUri,
    buildAssetFilePrefix(input.type),
  );

  const persistedOriginal = input.originalSourceUri?.trim()
    ? await persistAssetImage(
        input.originalSourceUri.trim(),
        `${buildAssetFilePrefix(input.type)}-original`,
      )
    : persistedMain;

  const persistedPreview = input.previewSourceUri?.trim()
    ? await persistAssetImage(
        input.previewSourceUri.trim(),
        `${buildAssetFilePrefix(input.type)}-preview`,
      )
    : persistedMain;

  const metadata = serializeAssetMetadata({
    ...input.metadata,
    createdAt: now,
    updatedAt: now,
  });

  try {
    await db.runAsync(
      `
        INSERT INTO assets (
          type,
          name,
          file_path,
          original_file_path,
          preview_file_path,
          metadata,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      input.type,
      assetName,
      persistedMain.uri,
      persistedOriginal.uri,
      persistedPreview.uri,
      metadata,
      now,
    );

    const row = await db.getFirstAsync<{ id: number }>(
      'SELECT last_insert_rowid() AS id',
    );

    if (!row?.id) {
      throw new Error('Varlık kaydı oluşturulamadı.');
    }

    return {
      id: row.id,
      type: input.type,
      name: assetName,
      file_path: persistedMain.uri,
      original_file_path: persistedOriginal.uri,
      preview_file_path: persistedPreview.uri,
      metadata,
      created_at: now,
    } satisfies StoredAsset;
  } catch (error) {
    await removeFilesIfExist(
      getUniqueFilePaths([
        persistedMain.uri,
        persistedOriginal.uri,
        persistedPreview.uri,
      ]),
    );
    throw error;
  }
}

export async function getAssetsByType(type: AssetType) {
  const db = await getDb();

  return db.getAllAsync<StoredAsset>(
    `
      SELECT
        id,
        type,
        name,
        file_path,
        original_file_path,
        preview_file_path,
        metadata,
        created_at
      FROM assets
      WHERE type = ?
      ORDER BY created_at DESC, id DESC
    `,
    type,
  );
}

export async function getAssetById(assetId: number) {
  if (!isPositiveInteger(assetId)) {
    return null;
  }

  const db = await getDb();

  return db.getFirstAsync<StoredAsset>(
    `
      SELECT
        id,
        type,
        name,
        file_path,
        original_file_path,
        preview_file_path,
        metadata,
        created_at
      FROM assets
      WHERE id = ?
    `,
    assetId,
  );
}

export async function getAssetUsageCount(assetId: number) {
  if (!isPositiveInteger(assetId)) {
    return 0;
  }

  return getAssetOverlayUsageCount(assetId);
}

export async function renameAsset(assetId: number, nextName: string) {
  if (!isPositiveInteger(assetId)) {
    throw new Error('Geçerli asset bilgisi gerekli.');
  }

  const name = nextName.trim();

  if (!name) {
    throw new Error('Asset adı boş bırakılamaz.');
  }

  const asset = await getAssetById(assetId);

  if (!asset) {
    throw new Error('Asset bulunamadı.');
  }

  const db = await getDb();

  await db.runAsync(
    `
      UPDATE assets
      SET
        name = ?,
        metadata = ?
      WHERE id = ?
    `,
    name,
    withUpdatedMetadata(asset.metadata),
    assetId,
  );

  return {
    ...asset,
    name,
  } satisfies StoredAsset;
}

export async function updateAssetImage(input: UpdateAssetImageInput) {
  if (!isPositiveInteger(input.assetId)) {
    throw new Error('Geçerli asset bilgisi gerekli.');
  }

  const sourceUri = input.sourceUri?.trim();

  if (!sourceUri) {
    throw new Error('Güncellenecek geçerli görsel gerekli.');
  }

  const asset = await getAssetById(input.assetId);

  if (!asset) {
    throw new Error('Asset bulunamadı.');
  }

  const preserveOriginal = input.preserveOriginal !== false;
  const activeImage = await persistAssetImage(
    sourceUri,
    buildAssetFilePrefix(asset.type),
  );
  const previewImage =
    input.previewSourceUri && input.previewSourceUri.trim().length > 0
      ? await persistAssetImage(
          input.previewSourceUri.trim(),
          `${buildAssetFilePrefix(asset.type)}-preview`,
        )
      : null;

  const nextMetadata = withUpdatedMetadata(asset.metadata, input.metadataPatch);
  const nextOriginalPath = preserveOriginal
    ? asset.original_file_path || asset.file_path
    : activeImage.uri;

  const nextPreviewPath = previewImage?.uri ?? activeImage.uri;

  try {
    const db = await getDb();

    await db.runAsync(
      `
        UPDATE assets
        SET
          file_path = ?,
          original_file_path = ?,
          preview_file_path = ?,
          metadata = ?
        WHERE id = ?
      `,
      activeImage.uri,
      nextOriginalPath,
      nextPreviewPath,
      nextMetadata,
      input.assetId,
    );

    const removablePaths = getUniqueFilePaths([
      asset.file_path !== nextOriginalPath ? asset.file_path : null,
      asset.preview_file_path &&
      asset.preview_file_path !== asset.file_path &&
      asset.preview_file_path !== nextOriginalPath
        ? asset.preview_file_path
        : null,
    ]).filter((path) => path !== activeImage.uri && path !== nextPreviewPath);

    await removeFilesIfExist(removablePaths);

    const updated = await getAssetById(input.assetId);

    if (!updated) {
      throw new Error('Asset güncellendikten sonra okunamadı.');
    }

    return updated;
  } catch (error) {
    await removeFileIfExists(activeImage.uri);
    if (previewImage?.uri) {
      await removeFileIfExists(previewImage.uri);
    }
    throw error;
  }
}

export async function restoreAssetOriginal(assetId: number) {
  if (!isPositiveInteger(assetId)) {
    throw new Error('Geçerli asset bilgisi gerekli.');
  }

  const asset = await getAssetById(assetId);

  if (!asset) {
    throw new Error('Asset bulunamadı.');
  }

  const originalPath = asset.original_file_path?.trim();

  if (!originalPath) {
    throw new Error('Geri yüklenecek orijinal asset bulunamadı.');
  }

  const originalExists = await fileExists(originalPath);

  if (!originalExists) {
    throw new Error('Orijinal asset dosyası bulunamadı.');
  }

  const db = await getDb();

  await db.runAsync(
    `
      UPDATE assets
      SET
        file_path = ?,
        preview_file_path = ?,
        metadata = ?
      WHERE id = ?
    `,
    originalPath,
    originalPath,
    withUpdatedMetadata(asset.metadata, {
      backgroundRemoved: false,
      cleanupMode: 'original',
    }),
    assetId,
  );

  const removablePaths = getUniqueFilePaths([
    asset.file_path !== originalPath ? asset.file_path : null,
    asset.preview_file_path &&
    asset.preview_file_path !== originalPath &&
    asset.preview_file_path !== asset.file_path
      ? asset.preview_file_path
      : null,
  ]);

  await removeFilesIfExist(removablePaths);

  const updated = await getAssetById(assetId);

  if (!updated) {
    throw new Error('Asset geri yüklendikten sonra okunamadı.');
  }

  return updated;
}

export async function deleteAsset(assetId: number) {
  if (!isPositiveInteger(assetId)) {
    return;
  }

  const db = await getDb();
  const asset = await getAssetById(assetId);

  if (!asset) {
    return;
  }

  const usageCount = await getAssetOverlayUsageCount(assetId);

  if (usageCount > 0) {
    throw new Error('Bu asset aktif kaşe yerleşimlerinde kullanılıyor. Önce ilgili kaşeleri sil.');
  }

  await db.runAsync(
    `
      DELETE FROM assets
      WHERE id = ?
    `,
    assetId,
  );

  await removeFilesIfExist(
    getUniqueFilePaths([
      asset.file_path,
      asset.original_file_path,
      asset.preview_file_path,
    ]),
  );
}