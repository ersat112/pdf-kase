import { getDb } from '../../db/sqlite';

export type DocumentCollectionSummary = {
  id: number;
  name: string;
  document_count: number;
};

export type DocumentTagSummary = {
  id: number;
  name: string;
  document_count: number;
};

function isPositiveInteger(value: number) {
  return Number.isInteger(value) && value > 0;
}

function normalizeName(value: string, fieldLabel: string) {
  const normalized = value.replace(/\s+/g, ' ').trim();

  if (!normalized) {
    throw new Error(`${fieldLabel} boş bırakılamaz.`);
  }

  return normalized.slice(0, 48);
}

function normalizeDocumentIds(documentIds: number[]) {
  return Array.from(
    new Set(documentIds.filter((value) => isPositiveInteger(value))),
  );
}

async function getOrCreateCollectionId(name: string) {
  const normalizedName = normalizeName(name, 'Klasör adı');
  const db = await getDb();

  const existing = await db.getFirstAsync<{ id: number }>(
    `
      SELECT id
      FROM document_collections
      WHERE LOWER(name) = LOWER(?)
      LIMIT 1
    `,
    normalizedName,
  );

  if (existing?.id) {
    await db.runAsync(
      `
        UPDATE document_collections
        SET updated_at = ?
        WHERE id = ?
      `,
      new Date().toISOString(),
      existing.id,
    );

    return existing.id;
  }

  const now = new Date().toISOString();

  await db.runAsync(
    `
      INSERT INTO document_collections (
        name,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?)
    `,
    normalizedName,
    now,
    now,
  );

  const row = await db.getFirstAsync<{ id: number }>(
    'SELECT last_insert_rowid() AS id',
  );

  if (!row?.id) {
    throw new Error('Klasör oluşturulamadı.');
  }

  return row.id;
}

async function getOrCreateTagId(name: string) {
  const normalizedName = normalizeName(name, 'Etiket adı');
  const db = await getDb();

  const existing = await db.getFirstAsync<{ id: number }>(
    `
      SELECT id
      FROM document_tags
      WHERE LOWER(name) = LOWER(?)
      LIMIT 1
    `,
    normalizedName,
  );

  if (existing?.id) {
    await db.runAsync(
      `
        UPDATE document_tags
        SET updated_at = ?
        WHERE id = ?
      `,
      new Date().toISOString(),
      existing.id,
    );

    return existing.id;
  }

  const now = new Date().toISOString();

  await db.runAsync(
    `
      INSERT INTO document_tags (
        name,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?)
    `,
    normalizedName,
    now,
    now,
  );

  const row = await db.getFirstAsync<{ id: number }>(
    'SELECT last_insert_rowid() AS id',
  );

  if (!row?.id) {
    throw new Error('Etiket oluşturulamadı.');
  }

  return row.id;
}

export async function listDocumentCollections(): Promise<DocumentCollectionSummary[]> {
  const db = await getDb();

  return db.getAllAsync<DocumentCollectionSummary>(
    `
      SELECT
        c.id,
        c.name,
        COALESCE(COUNT(d.id), 0) AS document_count
      FROM document_collections c
      LEFT JOIN documents d
        ON d.collection_id = c.id
      GROUP BY c.id, c.name
      ORDER BY c.name COLLATE NOCASE ASC
    `,
  );
}

export async function listDocumentTags(): Promise<DocumentTagSummary[]> {
  const db = await getDb();

  return db.getAllAsync<DocumentTagSummary>(
    `
      SELECT
        t.id,
        t.name,
        COALESCE(COUNT(l.document_id), 0) AS document_count
      FROM document_tags t
      LEFT JOIN document_tag_links l
        ON l.tag_id = t.id
      GROUP BY t.id, t.name
      ORDER BY t.name COLLATE NOCASE ASC
    `,
  );
}

export async function setDocumentsCollection(
  documentIds: number[],
  collectionName: string | null,
) {
  const normalizedIds = normalizeDocumentIds(documentIds);

  if (!normalizedIds.length) {
    throw new Error('İşlem yapılacak belge seçilmedi.');
  }

  const db = await getDb();
  const updatedAt = new Date().toISOString();
  const placeholders = normalizedIds.map(() => '?').join(', ');

  if (!collectionName || collectionName.trim().length === 0) {
    await db.runAsync(
      `
        UPDATE documents
        SET
          collection_id = NULL,
          updated_at = ?
        WHERE id IN (${placeholders})
      `,
      updatedAt,
      ...normalizedIds,
    );

    return {
      updatedCount: normalizedIds.length,
      collectionName: null,
      updatedAt,
    };
  }

  const collectionId = await getOrCreateCollectionId(collectionName);

  await db.runAsync(
    `
      UPDATE documents
      SET
        collection_id = ?,
        updated_at = ?
      WHERE id IN (${placeholders})
    `,
    collectionId,
    updatedAt,
    ...normalizedIds,
  );

  return {
    updatedCount: normalizedIds.length,
    collectionId,
    collectionName: normalizeName(collectionName, 'Klasör adı'),
    updatedAt,
  };
}

export async function addTagToDocuments(
  documentIds: number[],
  tagName: string,
) {
  const normalizedIds = normalizeDocumentIds(documentIds);

  if (!normalizedIds.length) {
    throw new Error('İşlem yapılacak belge seçilmedi.');
  }

  const normalizedTagName = normalizeName(tagName, 'Etiket adı');
  const tagId = await getOrCreateTagId(normalizedTagName);
  const db = await getDb();
  const now = new Date().toISOString();

  for (const documentId of normalizedIds) {
    await db.runAsync(
      `
        INSERT OR IGNORE INTO document_tag_links (
          document_id,
          tag_id,
          created_at
        )
        VALUES (?, ?, ?)
      `,
      documentId,
      tagId,
      now,
    );
  }

  const placeholders = normalizedIds.map(() => '?').join(', ');

  await db.runAsync(
    `
      UPDATE documents
      SET updated_at = ?
      WHERE id IN (${placeholders})
    `,
    now,
    ...normalizedIds,
  );

  return {
    updatedCount: normalizedIds.length,
    tagId,
    tagName: normalizedTagName,
    updatedAt: now,
  };
}

export async function syncDocumentTaxonomy(
  documentId: number,
  input: {
    collectionName?: string | null;
    tagNames?: string[];
    updatedAt?: string | null;
  },
) {
  if (!isPositiveInteger(documentId)) {
    throw new Error('Geçersiz belge kimliği.');
  }

  const db = await getDb();
  const updatedAt =
    typeof input.updatedAt === 'string' && input.updatedAt.trim().length > 0
      ? input.updatedAt.trim()
      : new Date().toISOString();
  const collectionName =
    typeof input.collectionName === 'string' && input.collectionName.trim().length > 0
      ? normalizeName(input.collectionName, 'Klasör adı')
      : null;
  const tagNames = Array.from(
    new Set(
      (input.tagNames ?? [])
        .filter((tagName): tagName is string => typeof tagName === 'string')
        .map((tagName) => normalizeName(tagName, 'Etiket adı')),
    ),
  );
  const collectionId = collectionName ? await getOrCreateCollectionId(collectionName) : null;

  await db.runAsync(
    `
      UPDATE documents
      SET
        collection_id = ?,
        updated_at = ?
      WHERE id = ?
    `,
    collectionId,
    updatedAt,
    documentId,
  );

  await db.runAsync(
    `
      DELETE FROM document_tag_links
      WHERE document_id = ?
    `,
    documentId,
  );

  for (const tagName of tagNames) {
    const tagId = await getOrCreateTagId(tagName);

    await db.runAsync(
      `
        INSERT OR IGNORE INTO document_tag_links (
          document_id,
          tag_id,
          created_at
        )
        VALUES (?, ?, ?)
      `,
      documentId,
      tagId,
      updatedAt,
    );
  }

  return {
    documentId,
    collectionId,
    collectionName,
    tagNames,
    updatedAt,
  };
}
