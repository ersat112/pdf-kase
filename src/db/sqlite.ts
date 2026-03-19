import * as SQLite from 'expo-sqlite';

const DB_NAME = 'pdf_kase.db';
const DB_VERSION = 6;

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function applyBasePragmas(db: SQLite.SQLiteDatabase) {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;
    PRAGMA synchronous = NORMAL;
  `);
}

async function columnExists(
  db: SQLite.SQLiteDatabase,
  tableName: string,
  columnName: string,
) {
  const rows = await db.getAllAsync<{ name: string }>(
    `PRAGMA table_info(${tableName})`,
  );

  return rows.some((row) => row.name === columnName);
}

async function ensureColumn(
  db: SQLite.SQLiteDatabase,
  tableName: string,
  columnName: string,
  definition: string,
) {
  const exists = await columnExists(db, tableName, columnName);

  if (!exists) {
    await db.execAsync(
      `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition};`,
    );
  }
}

async function migrateToVersion1(db: SQLite.SQLiteDatabase) {
  await db.execAsync(`
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
  `);
}

async function migrateToVersion2(db: SQLite.SQLiteDatabase) {
  await db.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_documents_updated_at
      ON documents(updated_at DESC);

    CREATE INDEX IF NOT EXISTS idx_assets_type
      ON assets(type, created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_overlay_items_page_id
      ON overlay_items(page_id, created_at ASC);
  `);
}

async function migrateToVersion3(db: SQLite.SQLiteDatabase) {
  await db.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_overlay_items_document_page_created_at
      ON overlay_items(document_id, page_id, created_at ASC, id ASC);

    CREATE INDEX IF NOT EXISTS idx_documents_status_updated_at
      ON documents(status, updated_at DESC);
  `);
}

async function migrateToVersion4(db: SQLite.SQLiteDatabase) {
  await ensureColumn(db, 'assets', 'original_file_path', 'TEXT');
  await ensureColumn(db, 'assets', 'preview_file_path', 'TEXT');
  await ensureColumn(db, 'assets', 'metadata', 'TEXT');

  await db.execAsync(`
    UPDATE assets
    SET original_file_path = file_path
    WHERE original_file_path IS NULL OR TRIM(original_file_path) = '';

    UPDATE assets
    SET preview_file_path = file_path
    WHERE preview_file_path IS NULL OR TRIM(preview_file_path) = '';

    CREATE INDEX IF NOT EXISTS idx_assets_name
      ON assets(name COLLATE NOCASE);

    CREATE INDEX IF NOT EXISTS idx_overlay_items_document_page_type
      ON overlay_items(document_id, page_id, type, created_at ASC, id ASC);
  `);
}

async function migrateToVersion5(db: SQLite.SQLiteDatabase) {
  await ensureColumn(db, 'documents', 'ocr_text', 'TEXT');
  await ensureColumn(db, 'documents', 'ocr_status', "TEXT NOT NULL DEFAULT 'idle'");
  await ensureColumn(db, 'documents', 'ocr_updated_at', 'TEXT');
  await ensureColumn(db, 'documents', 'ocr_error', 'TEXT');
  await ensureColumn(db, 'documents', 'word_path', 'TEXT');
  await ensureColumn(db, 'documents', 'word_updated_at', 'TEXT');

  await db.execAsync(`
    UPDATE documents
    SET ocr_status = 'idle'
    WHERE ocr_status IS NULL OR TRIM(ocr_status) = '';

    CREATE INDEX IF NOT EXISTS idx_documents_ocr_status_updated_at
      ON documents(ocr_status, updated_at DESC);

    CREATE INDEX IF NOT EXISTS idx_documents_word_updated_at
      ON documents(word_updated_at DESC);
  `);
}

async function migrateToVersion6(db: SQLite.SQLiteDatabase) {
  await ensureColumn(db, 'documents', 'is_favorite', 'INTEGER NOT NULL DEFAULT 0');

  await db.execAsync(`
    UPDATE documents
    SET is_favorite = 0
    WHERE is_favorite IS NULL;

    CREATE INDEX IF NOT EXISTS idx_documents_favorite_updated_at
      ON documents(is_favorite DESC, updated_at DESC);

    CREATE INDEX IF NOT EXISTS idx_documents_title_nocase
      ON documents(title COLLATE NOCASE);
  `);
}

async function runMigrations(db: SQLite.SQLiteDatabase) {
  await applyBasePragmas(db);

  const versionRow = await db.getFirstAsync<{ user_version: number }>(
    'PRAGMA user_version',
  );
  const currentVersion = versionRow?.user_version ?? 0;

  if (currentVersion < 1) {
    await migrateToVersion1(db);
  }

  if (currentVersion < 2) {
    await migrateToVersion2(db);
  }

  if (currentVersion < 3) {
    await migrateToVersion3(db);
  }

  if (currentVersion < 4) {
    await migrateToVersion4(db);
  }

  if (currentVersion < 5) {
    await migrateToVersion5(db);
  }

  if (currentVersion < 6) {
    await migrateToVersion6(db);
  }

  if (currentVersion !== DB_VERSION) {
    await db.execAsync(`PRAGMA user_version = ${DB_VERSION};`);
  }
}

async function openDatabase() {
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  await runMigrations(db);
  return db;
}

export async function initializeDatabase() {
  if (!dbPromise) {
    dbPromise = openDatabase();
  }

  return dbPromise;
}

export async function getDb() {
  return initializeDatabase();
}