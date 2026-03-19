// db/migrations/001_init.ts
import type { SQLiteDatabase } from 'expo-sqlite';

const DATABASE_VERSION = 1;

export async function runInitialMigrations(db: SQLiteDatabase) {
  const result = await db.getFirstAsync<{ user_version: number }>(
    'PRAGMA user_version',
  );
  const currentVersion = result?.user_version ?? 0;

  if (currentVersion >= DATABASE_VERSION) {
    return;
  }

  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      pdf_path TEXT,
      thumbnail_path TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS document_pages (
      id INTEGER PRIMARY KEY NOT NULL,
      document_id INTEGER NOT NULL,
      image_path TEXT NOT NULL,
      page_order INTEGER NOT NULL,
      width INTEGER,
      height INTEGER,
      created_at TEXT NOT NULL,
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS assets (
      id INTEGER PRIMARY KEY NOT NULL,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS overlay_items (
      id INTEGER PRIMARY KEY NOT NULL,
      document_id INTEGER NOT NULL,
      page_id INTEGER,
      type TEXT NOT NULL,
      x REAL NOT NULL,
      y REAL NOT NULL,
      width REAL NOT NULL,
      height REAL NOT NULL,
      rotation REAL NOT NULL DEFAULT 0,
      opacity REAL NOT NULL DEFAULT 1,
      content TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
      FOREIGN KEY (page_id) REFERENCES document_pages(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_document_pages_document_id
      ON document_pages(document_id);

    CREATE INDEX IF NOT EXISTS idx_document_pages_order
      ON document_pages(document_id, page_order);

    CREATE INDEX IF NOT EXISTS idx_overlay_items_document_id
      ON overlay_items(document_id);

    PRAGMA user_version = ${DATABASE_VERSION};
  `);
}