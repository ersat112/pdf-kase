import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import {
    persistThumbnailImage,
    removeFileIfExists,
} from '../storage/file.service';

type GenerateImportedPdfThumbnailInput = {
  pdfUri: string;
  pageNumber?: number;
  scale?: number;
  prefix?: string;
};

type PdfJsiRenderResult = {
  success?: boolean;
  uri?: string;
  imageUri?: string;
  filePath?: string;
  path?: string;
  outputPath?: string;
  base64?: string;
  base64Data?: string;
  imageData?: string;
  data?: string;
  mimeType?: string;
  format?: string;
};

type PdfJsiModuleLike = {
  initializeJSI?: () => Promise<boolean> | boolean;
  checkJSIAvailability?: () => Promise<boolean> | boolean;
  renderPageDirect?: (
    pdfId: string,
    pageNumber: number,
    scale: number,
    base64Data: string,
  ) => Promise<PdfJsiRenderResult> | PdfJsiRenderResult;
};

function normalizeLocalUri(uriOrPath: string) {
  if (/^[a-zA-Z]+:\/\//.test(uriOrPath)) {
    return uriOrPath;
  }

  if (uriOrPath.startsWith('/')) {
    return `file://${uriOrPath}`;
  }

  return uriOrPath;
}

function stripFileScheme(uriOrPath: string) {
  return normalizeLocalUri(uriOrPath).replace(/^file:\/\//, '');
}

function getBlobUtilFs() {
  const ReactNativeBlobUtilModule = require('react-native-blob-util');
  const ReactNativeBlobUtil =
    ReactNativeBlobUtilModule?.default ?? ReactNativeBlobUtilModule;

  if (!ReactNativeBlobUtil?.fs) {
    throw new Error('react-native-blob-util fs modülü bulunamadı.');
  }

  return ReactNativeBlobUtil.fs as {
    readFile(path: string, encoding: 'base64'): Promise<string>;
    writeFile(path: string, content: string, encoding: 'base64'): Promise<void>;
  };
}

async function readFileAsBase64(uri: string) {
  const fs = getBlobUtilFs();
  return fs.readFile(stripFileScheme(uri), 'base64');
}

function randomId() {
  return Math.random().toString(36).slice(2, 8);
}

function pickFirstString(
  source: Record<string, unknown>,
  keys: string[],
): string | null {
  for (const key of keys) {
    const value = source[key];

    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}

function normalizeBase64Payload(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return '';
  }

  const dataUriIndex = trimmed.indexOf('base64,');

  if (dataUriIndex >= 0) {
    return trimmed.slice(dataUriIndex + 'base64,'.length).trim();
  }

  return trimmed;
}

function inferImageExtension(result: PdfJsiRenderResult) {
  const mimeType =
    typeof result.mimeType === 'string' ? result.mimeType.toLowerCase() : '';

  if (mimeType.includes('png')) {
    return 'png';
  }

  if (mimeType.includes('jpeg') || mimeType.includes('jpg')) {
    return 'jpg';
  }

  const format =
    typeof result.format === 'string' ? result.format.toLowerCase() : '';

  if (format === 'png') {
    return 'png';
  }

  if (format === 'jpeg' || format === 'jpg') {
    return 'jpg';
  }

  const possibleUri = pickFirstString(result, [
    'uri',
    'imageUri',
    'filePath',
    'path',
    'outputPath',
  ]);

  if (possibleUri) {
    const clean = possibleUri.split('?')[0].toLowerCase();

    if (clean.endsWith('.png')) {
      return 'png';
    }

    if (clean.endsWith('.jpg') || clean.endsWith('.jpeg')) {
      return 'jpg';
    }
  }

  return 'jpg';
}

async function writeBase64ImageToTempFile(base64: string, extension: string) {
  const fs = getBlobUtilFs();
  const tempFile = new File(
    Paths.cache,
    `pdf-thumb-temp-${Date.now()}-${randomId()}.${extension}`,
  );

  if (tempFile.exists) {
    tempFile.delete();
  }

  await fs.writeFile(
    stripFileScheme(tempFile.uri),
    normalizeBase64Payload(base64),
    'base64',
  );

  return tempFile.uri;
}

function getPdfJsiModule(): PdfJsiModuleLike | null {
  try {
    const module = require('react-native-pdf-jsi/src/PDFJSI');
    return (module?.default ?? module) as PdfJsiModuleLike;
  } catch {
    return null;
  }
}

async function ensurePdfJsiAvailable(module: PdfJsiModuleLike) {
  if (typeof module.initializeJSI === 'function') {
    try {
      await module.initializeJSI();
    } catch {
      return false;
    }
  }

  if (typeof module.checkJSIAvailability === 'function') {
    try {
      return Boolean(await module.checkJSIAvailability());
    } catch {
      return false;
    }
  }

  return typeof module.renderPageDirect === 'function';
}

async function persistRenderedThumbnail(
  result: PdfJsiRenderResult,
  prefix: string,
) {
  const directUri = pickFirstString(result, [
    'uri',
    'imageUri',
    'filePath',
    'path',
    'outputPath',
  ]);

  if (directUri) {
    const normalizedDirectUri = normalizeLocalUri(directUri);
    const persisted = await persistThumbnailImage(normalizedDirectUri, prefix);

    if (persisted.uri !== normalizedDirectUri) {
      await removeFileIfExists(normalizedDirectUri);
    }

    return persisted.uri;
  }

  const base64Payload = pickFirstString(result, [
    'base64',
    'base64Data',
    'imageData',
    'data',
  ]);

  if (!base64Payload) {
    return null;
  }

  const tempUri = await writeBase64ImageToTempFile(
    base64Payload,
    inferImageExtension(result),
  );

  try {
    const persisted = await persistThumbnailImage(tempUri, prefix);
    return persisted.uri;
  } finally {
    await removeFileIfExists(tempUri);
  }
}

export async function generateImportedPdfThumbnail(
  input: GenerateImportedPdfThumbnailInput,
) {
  const pdfUri = input.pdfUri?.trim();

  if (!pdfUri || Platform.OS === 'web') {
    return null;
  }

  const pdfJsi = getPdfJsiModule();

  if (!pdfJsi || typeof pdfJsi.renderPageDirect !== 'function') {
    return null;
  }

  const isAvailable = await ensurePdfJsiAvailable(pdfJsi);

  if (!isAvailable) {
    return null;
  }

  const base64Data = await readFileAsBase64(pdfUri);

  if (!base64Data) {
    return null;
  }

  const pageNumber = Math.max(1, Math.trunc(input.pageNumber ?? 1));
  const scale = Math.max(1, input.scale ?? 1.4);
  const pdfId = `pdf-kase-thumb-${Date.now()}-${randomId()}`;

  const result = await pdfJsi.renderPageDirect(
    pdfId,
    pageNumber,
    scale,
    base64Data,
  );

  if (result?.success === false) {
    return null;
  }

  return persistRenderedThumbnail(result ?? {}, input.prefix ?? 'pdf-thumb');
}

export const pdfThumbnailService = {
  generateImportedPdfThumbnail,
};