import { getDb } from '../../db/sqlite';

export type DocumentAuditStatus =
  | 'started'
  | 'completed'
  | 'failed'
  | 'requires_premium';

export type DocumentAuditEntry = {
  id: number;
  document_id: number;
  action_key: string;
  action_label: string;
  status: DocumentAuditStatus;
  reason: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type LogDocumentAuditInput = {
  documentId: number;
  actionKey: string;
  actionLabel: string;
  status: DocumentAuditStatus;
  reason?: string | null;
  metadata?: Record<string, unknown> | null;
};

function isPositiveInteger(value: number) {
  return Number.isInteger(value) && value > 0;
}

function normalizeKey(value: string, fieldLabel: string) {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error(`${fieldLabel} boş bırakılamaz.`);
  }

  return normalized.slice(0, 64);
}

function normalizeLabel(value: string) {
  const normalized = value.replace(/\s+/g, ' ').trim();

  if (!normalized) {
    throw new Error('Aksiyon etiketi boş bırakılamaz.');
  }

  return normalized.slice(0, 96);
}

function parseMetadata(value: string | null): Record<string, unknown> | null {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function logDocumentAuditEvent(
  input: LogDocumentAuditInput,
) {
  if (!isPositiveInteger(input.documentId)) {
    throw new Error('Geçersiz belge kimliği.');
  }

  const db = await getDb();
  const createdAt = new Date().toISOString();
  const actionKey = normalizeKey(input.actionKey, 'Aksiyon anahtarı');
  const actionLabel = normalizeLabel(input.actionLabel);
  const reason =
    typeof input.reason === 'string' && input.reason.trim().length > 0
      ? input.reason.trim().slice(0, 240)
      : null;
  const metadata =
    input.metadata && Object.keys(input.metadata).length > 0
      ? JSON.stringify(input.metadata)
      : null;

  await db.runAsync(
    `
      INSERT INTO document_action_audit_logs (
        document_id,
        action_key,
        action_label,
        status,
        reason,
        metadata,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    input.documentId,
    actionKey,
    actionLabel,
    input.status,
    reason,
    metadata,
    createdAt,
  );

  const row = await db.getFirstAsync<{ id: number }>(
    'SELECT last_insert_rowid() AS id',
  );

  if (!row?.id) {
    throw new Error('İşlem geçmişi kaydı oluşturulamadı.');
  }

  return {
    id: row.id,
    documentId: input.documentId,
    createdAt,
  };
}

export async function listDocumentAuditEvents(
  documentId: number,
  limit = 20,
): Promise<DocumentAuditEntry[]> {
  if (!isPositiveInteger(documentId)) {
    throw new Error('Geçersiz belge kimliği.');
  }

  const normalizedLimit = Math.max(1, Math.min(100, Math.trunc(limit || 20)));
  const db = await getDb();

  const rows = await db.getAllAsync<{
    id: number;
    document_id: number;
    action_key: string;
    action_label: string;
    status: DocumentAuditStatus;
    reason: string | null;
    metadata: string | null;
    created_at: string;
  }>(
    `
      SELECT
        id,
        document_id,
        action_key,
        action_label,
        status,
        reason,
        metadata,
        created_at
      FROM document_action_audit_logs
      WHERE document_id = ?
      ORDER BY created_at DESC, id DESC
      LIMIT ?
    `,
    documentId,
    normalizedLimit,
  );

  return rows.map((row) => ({
    id: row.id,
    document_id: row.document_id,
    action_key: row.action_key,
    action_label: row.action_label,
    status: row.status,
    reason: row.reason,
    metadata: parseMetadata(row.metadata),
    created_at: row.created_at,
  }));
}

export async function clearDocumentAuditEvents(documentId: number) {
  if (!isPositiveInteger(documentId)) {
    throw new Error('Geçersiz belge kimliği.');
  }

  const db = await getDb();

  await db.runAsync(
    `
      DELETE FROM document_action_audit_logs
      WHERE document_id = ?
    `,
    documentId,
  );

  return {
    documentId,
    clearedAt: new Date().toISOString(),
  };
}