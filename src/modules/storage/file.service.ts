import { Directory, File, Paths } from 'expo-file-system';

const rootDirectory = new Directory(Paths.document, 'pdf-kase');
const scansDirectory = new Directory(rootDirectory, 'scans');
const pdfDirectory = new Directory(rootDirectory, 'pdfs');
const wordsDirectory = new Directory(rootDirectory, 'words');
const excelsDirectory = new Directory(rootDirectory, 'excels');
const thumbsDirectory = new Directory(rootDirectory, 'thumbs');
const assetsDirectory = new Directory(rootDirectory, 'assets');

let ensureDirectoriesPromise: Promise<void> | null = null;

function normalizeLocalUri(uri: string) {
  if (/^[a-zA-Z]+:\/\//.test(uri)) {
    return uri;
  }

  if (uri.startsWith('/')) {
    return `file://${uri}`;
  }

  return uri;
}

function createDirectoryIfMissing(directory: Directory) {
  if (!directory.exists) {
    directory.create({ idempotent: true, intermediates: true });
  }
}

function replaceTurkishChars(value: string) {
  return value.replace(/[çğıöşüÇĞİÖŞÜ]/g, (char) => {
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
  });
}

export function getExtensionFromUri(uri: string) {
  const normalized = normalizeLocalUri(uri);
  const clean = normalized.split('?')[0];
  const match = clean.match(/\.([a-zA-Z0-9]+)$/);
  return match?.[1]?.toLowerCase() ?? 'jpg';
}

function uniqueName(prefix: string, extension: string) {
  const safePrefix = sanitizeFileBaseName(prefix || 'file');
  const random = Math.random().toString(36).slice(2, 8);
  return `${safePrefix}-${Date.now()}-${random}.${extension}`;
}

function sanitizeFileBaseName(value: string) {
  const normalized = replaceTurkishChars(value);

  return (
    normalized
      .normalize('NFKD')
      .toLowerCase()
      .replace(/[^a-z0-9-_]+/g, '-')
      .replace(/-{2,}/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'document'
  );
}

function writeBytesIntoDirectory(
  targetDirectory: Directory,
  fileBaseName: string,
  extension: string,
  bytes: Uint8Array,
) {
  if (!(bytes instanceof Uint8Array) || bytes.length === 0) {
    throw new Error('Yazılacak geçerli byte verisi gerekli.');
  }

  const safeBase = sanitizeFileBaseName(fileBaseName);
  const fileName = `${safeBase}-${Date.now()}.${extension}`;
  const destinationFile = new File(targetDirectory, fileName);

  if (destinationFile.exists) {
    destinationFile.delete();
  }

  destinationFile.create();
  destinationFile.write(bytes);

  return {
    fileName,
    fileUri: destinationFile.uri,
    contentUri: destinationFile.contentUri ?? destinationFile.uri,
  };
}

export async function ensureAppDirectories() {
  if (ensureDirectoriesPromise) {
    return ensureDirectoriesPromise;
  }

  ensureDirectoriesPromise = Promise.resolve()
    .then(() => {
      createDirectoryIfMissing(rootDirectory);
      createDirectoryIfMissing(scansDirectory);
      createDirectoryIfMissing(pdfDirectory);
      createDirectoryIfMissing(wordsDirectory);
      createDirectoryIfMissing(excelsDirectory);
      createDirectoryIfMissing(thumbsDirectory);
      createDirectoryIfMissing(assetsDirectory);
    })
    .finally(() => {
      ensureDirectoriesPromise = null;
    });

  return ensureDirectoriesPromise;
}

export function getAppDirectories() {
  return {
    rootDirectory,
    scansDirectory,
    pdfDirectory,
    wordsDirectory,
    excelsDirectory,
    thumbsDirectory,
    assetsDirectory,
  };
}

export async function fileExists(uri: string | null | undefined) {
  if (!uri?.trim()) {
    return false;
  }

  try {
    const file = new File(normalizeLocalUri(uri));
    return file.exists;
  } catch {
    return false;
  }
}

async function persistIntoDirectory(
  sourceUri: string,
  targetDirectory: Directory,
  prefix: string,
) {
  if (!sourceUri?.trim()) {
    throw new Error('Kaydedilecek geçerli bir dosya yolu bulunamadı.');
  }

  await ensureAppDirectories();

  const normalizedSourceUri = normalizeLocalUri(sourceUri);
  const extension = getExtensionFromUri(normalizedSourceUri);
  const fileName = uniqueName(prefix, extension);
  const destinationFile = new File(targetDirectory, fileName);
  const sourceFile = new File(normalizedSourceUri);

  if (!sourceFile.exists) {
    throw new Error('Kaynak dosya bulunamadı.');
  }

  if (destinationFile.exists) {
    destinationFile.delete();
  }

  sourceFile.copy(destinationFile);

  return {
    name: fileName,
    uri: destinationFile.uri,
  };
}

export async function persistImportedImage(sourceUri: string, prefix = 'scan') {
  return persistIntoDirectory(sourceUri, scansDirectory, prefix);
}

export async function persistAssetImage(sourceUri: string, prefix = 'asset') {
  return persistIntoDirectory(sourceUri, assetsDirectory, prefix);
}

export async function persistThumbnailImage(sourceUri: string, prefix = 'thumb') {
  return persistIntoDirectory(sourceUri, thumbsDirectory, prefix);
}

export async function removeFileIfExists(uri: string | null | undefined) {
  if (!uri?.trim()) {
    return;
  }

  try {
    const file = new File(normalizeLocalUri(uri));

    if (file.exists) {
      file.delete();
    }
  } catch (error) {
    console.warn('[FileService] File delete failed:', error);
  }
}

export async function removeFilesIfExist(uris: Array<string | null | undefined>) {
  for (const uri of [...new Set(uris.filter(Boolean))]) {
    await removeFileIfExists(uri);
  }
}

export async function writePdfBytes(fileBaseName: string, bytes: Uint8Array) {
  await ensureAppDirectories();
  return writeBytesIntoDirectory(pdfDirectory, fileBaseName, 'pdf', bytes);
}

export async function writeWordBytes(fileBaseName: string, bytes: Uint8Array) {
  await ensureAppDirectories();
  return writeBytesIntoDirectory(wordsDirectory, fileBaseName, 'docx', bytes);
}

export async function writeExcelBytes(fileBaseName: string, bytes: Uint8Array) {
  await ensureAppDirectories();
  return writeBytesIntoDirectory(excelsDirectory, fileBaseName, 'xls', bytes);
}