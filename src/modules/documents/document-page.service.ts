import { getDb } from '../../db/sqlite';
import { removeFileIfExists } from '../storage/file.service';
import { getDocumentDetail } from './document.service';

export type MoveDocumentPageDirection = 'up' | 'down';

export type MoveDocumentPageResult = {
  documentId: number;
  pageId: number;
  fromIndex: number;
  toIndex: number;
  moved: boolean;
};

export type DeleteDocumentPageResult = {
  documentId: number;
  deletedPageId: number;
  deletedIndex: number;
  remainingPageCount: number;
};

function isPositiveInteger(value: number) {
  return Number.isInteger(value) && value > 0;
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

async function invalidateDocumentOutputs(documentId: number) {
  const db = await getDb();

  const row = await db.getFirstAsync<{
    pdf_path: string | null;
    word_path: string | null;
  }>(
    `
      SELECT
        pdf_path,
        word_path
      FROM documents
      WHERE id = ?
    `,
    documentId,
  );

  await Promise.all(
    [row?.pdf_path ?? null, row?.word_path ?? null]
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      .map((uri) => removeFileIfExists(uri)),
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

async function getOrderedPageRows(documentId: number) {
  const db = await getDb();

  return db.getAllAsync<{
    id: number;
    image_path: string;
    page_order: number;
  }>(
    `
      SELECT
        id,
        image_path,
        page_order
      FROM document_pages
      WHERE document_id = ?
      ORDER BY page_order ASC, id ASC
    `,
    documentId,
  );
}

async function applyOrderedPageIds(documentId: number, orderedPageIds: number[]) {
  const db = await getDb();

  for (let index = 0; index < orderedPageIds.length; index += 1) {
    await db.runAsync(
      `
        UPDATE document_pages
        SET page_order = ?
        WHERE id = ?
      `,
      index,
      orderedPageIds[index],
    );
  }

  const orderedRows = await getOrderedPageRows(documentId);
  await updateDocumentThumbnail(documentId, orderedRows[0]?.image_path ?? null);
  await invalidateDocumentOutputs(documentId);
}

export async function moveDocumentPage(
  documentId: number,
  pageId: number,
  direction: MoveDocumentPageDirection,
): Promise<MoveDocumentPageResult> {
  if (!isPositiveInteger(documentId)) {
    throw new Error('Geçersiz belge kimliği.');
  }

  if (!isPositiveInteger(pageId)) {
    throw new Error('Geçersiz sayfa kimliği.');
  }

  const document = await getDocumentDetail(documentId);

  if (!document.pages.length) {
    throw new Error('Taşınacak sayfa bulunamadı.');
  }

  const orderedPages = [...document.pages].sort(
    (left, right) => left.page_order - right.page_order,
  );
  const currentIndex = orderedPages.findIndex((page) => page.id === pageId);

  if (currentIndex === -1) {
    throw new Error('Sayfa bu belgeye ait değil.');
  }

  const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

  if (targetIndex < 0 || targetIndex >= orderedPages.length) {
    return {
      documentId,
      pageId,
      fromIndex: currentIndex,
      toIndex: currentIndex,
      moved: false,
    };
  }

  const orderedPageIds = orderedPages.map((page) => page.id);
  const [movedPageId] = orderedPageIds.splice(currentIndex, 1);
  orderedPageIds.splice(targetIndex, 0, movedPageId);

  await applyOrderedPageIds(documentId, orderedPageIds);

  return {
    documentId,
    pageId,
    fromIndex: currentIndex,
    toIndex: targetIndex,
    moved: true,
  };
}

export async function deleteDocumentPage(
  documentId: number,
  pageId: number,
): Promise<DeleteDocumentPageResult> {
  if (!isPositiveInteger(documentId)) {
    throw new Error('Geçersiz belge kimliği.');
  }

  if (!isPositiveInteger(pageId)) {
    throw new Error('Geçersiz sayfa kimliği.');
  }

  const document = await getDocumentDetail(documentId);

  if (document.pages.length <= 1) {
    throw new Error('Belgede en az bir sayfa kalmalı. Son sayfa silinemez.');
  }

  const orderedPages = [...document.pages].sort(
    (left, right) => left.page_order - right.page_order,
  );
  const deletedIndex = orderedPages.findIndex((page) => page.id === pageId);

  if (deletedIndex === -1) {
    throw new Error('Sayfa bu belgeye ait değil.');
  }

  const targetPage = orderedPages[deletedIndex];
  const db = await getDb();

  await db.runAsync(
    `
      DELETE FROM document_pages
      WHERE id = ?
    `,
    pageId,
  );

  await removeFileIfExists(targetPage.image_path);

  const remainingRows = await getOrderedPageRows(documentId);

  for (let index = 0; index < remainingRows.length; index += 1) {
    await db.runAsync(
      `
        UPDATE document_pages
        SET page_order = ?
        WHERE id = ?
      `,
      index,
      remainingRows[index].id,
    );
  }

  const normalizedRows = await getOrderedPageRows(documentId);
  await updateDocumentThumbnail(documentId, normalizedRows[0]?.image_path ?? null);
  await invalidateDocumentOutputs(documentId);

  return {
    documentId,
    deletedPageId: pageId,
    deletedIndex,
    remainingPageCount: normalizedRows.length,
  };
}