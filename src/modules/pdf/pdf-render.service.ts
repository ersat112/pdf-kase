import { File, Paths } from 'expo-file-system';
import { PDFDocument } from 'pdf-lib';
import { NativeModules, Platform } from 'react-native';

import { removeFileIfExists } from '../storage/file.service';

const DEFAULT_RENDER_SCALE = 2;
const DEFAULT_RENDER_QUALITY = 0.95;

type PdfExportFormat = 'png' | 'jpeg' | 'jpg';

export type RenderedPdfPage = {
  pageNumber: number;
  imageUri: string;
  width: number | null;
  height: number | null;
};

type RenderPdfPageInput = {
  pdfUri: string;
  pageNumber: number;
  scale?: number;
  format?: PdfExportFormat;
  quality?: number;
};

type RasterizePdfInput = {
  pdfUri: string;
  startPage?: number;
  endPage?: number;
  scale?: number;
  format?: PdfExportFormat;
  quality?: number;
};

type PdfExporterModuleLike = {
  VERSION?: string;
  getPageCount?: (filePath: string) => Promise<number> | number;
  exportPageToImage?: (
    filePath: string,
    pageIndex: number,
    options?: {
      format?: 'png' | 'jpeg';
      quality?: number;
      scale?: number;
    },
  ) => Promise<string> | string;
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
  width?: number;
  height?: number;
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

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function normalizePositivePageNumber(value: number | undefined, fallback = 1) {
  const normalized = Math.trunc(value ?? fallback);
  return normalized > 0 ? normalized : fallback;
}

function normalizeRenderScale(value: number | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return DEFAULT_RENDER_SCALE;
  }

  return value;
}

function normalizeRenderQuality(value: number | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_RENDER_QUALITY;
  }

  return clamp(value, 0.1, 1);
}

function normalizeExportFormat(value: PdfExportFormat | undefined): 'png' | 'jpeg' {
  return value === 'png' ? 'png' : 'jpeg';
}

function normalizeDimension(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  return value;
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

function getBlobUtilFs() {
  const ReactNativeBlobUtilModule = require('react-native-blob-util');
  const ReactNativeBlobUtil =
    ReactNativeBlobUtilModule?.default ?? ReactNativeBlobUtilModule;

  if (!ReactNativeBlobUtil?.fs) {
    throw new Error('react-native-blob-util fs modulu bulunamadi.');
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

async function writeBase64ImageToTempFile(base64: string, extension: string) {
  const fs = getBlobUtilFs();
  const tempFile = new File(
    Paths.cache,
    `pdf-render-temp-${Date.now()}-${randomId()}.${extension}`,
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

function getPdfExporterModule(): PdfExporterModuleLike | null {
  const module = NativeModules?.PDFExporter as PdfExporterModuleLike | undefined;
  return module ?? null;
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

async function getPageCountFromExporter(pdfUri: string) {
  const exporter = getPdfExporterModule();

  if (!exporter?.getPageCount) {
    return null;
  }

  try {
    const pageCount = await exporter.getPageCount(stripFileScheme(pdfUri));

    if (typeof pageCount === 'number' && Number.isInteger(pageCount) && pageCount > 0) {
      return pageCount;
    }
  } catch (error) {
    console.warn('[PdfRenderService] Native page count failed:', error);
  }

  return null;
}

async function getPageCountFromPdfLib(pdfUri: string) {
  const file = new File(normalizeLocalUri(pdfUri));

  if (!file.exists) {
    throw new Error('PDF dosyasi bulunamadi.');
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const pdf = await PDFDocument.load(bytes, {
    ignoreEncryption: true,
    updateMetadata: false,
  });
  const pageCount = pdf.getPageCount();

  if (!pageCount) {
    throw new Error('PDF sayfa sayisi okunamadi.');
  }

  return pageCount;
}

async function renderPageWithExporter(
  input: RenderPdfPageInput,
): Promise<RenderedPdfPage | null> {
  const exporter = getPdfExporterModule();

  if (!exporter?.exportPageToImage) {
    return null;
  }

  try {
    const outputPath = await exporter.exportPageToImage(
      stripFileScheme(input.pdfUri),
      input.pageNumber - 1,
      {
        format: normalizeExportFormat(input.format),
        quality: normalizeRenderQuality(input.quality),
        scale: normalizeRenderScale(input.scale),
      },
    );

    if (typeof outputPath !== 'string' || !outputPath.trim()) {
      return null;
    }

    return {
      pageNumber: input.pageNumber,
      imageUri: normalizeLocalUri(outputPath),
      width: null,
      height: null,
    };
  } catch (error) {
    console.warn('[PdfRenderService] Native page render failed:', error);
    return null;
  }
}

async function renderPageWithJsi(
  input: RenderPdfPageInput,
): Promise<RenderedPdfPage | null> {
  const pdfJsi = getPdfJsiModule();

  if (!pdfJsi || typeof pdfJsi.renderPageDirect !== 'function') {
    return null;
  }

  const isAvailable = await ensurePdfJsiAvailable(pdfJsi);

  if (!isAvailable) {
    return null;
  }

  const base64Data = await readFileAsBase64(input.pdfUri);

  if (!base64Data) {
    return null;
  }

  const result = await pdfJsi.renderPageDirect(
    `pdf-kase-render-${Date.now()}-${randomId()}`,
    input.pageNumber,
    normalizeRenderScale(input.scale),
    base64Data,
  );

  if (result?.success === false) {
    return null;
  }

  const directUri = pickFirstString(result ?? {}, [
    'uri',
    'imageUri',
    'filePath',
    'path',
    'outputPath',
  ]);

  if (directUri) {
    return {
      pageNumber: input.pageNumber,
      imageUri: normalizeLocalUri(directUri),
      width: normalizeDimension(result?.width),
      height: normalizeDimension(result?.height),
    };
  }

  const base64Payload = pickFirstString(result ?? {}, [
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
    inferImageExtension(result ?? {}),
  );

  return {
    pageNumber: input.pageNumber,
    imageUri: tempUri,
    width: normalizeDimension(result?.width),
    height: normalizeDimension(result?.height),
  };
}

export async function getPdfPageCount(pdfUri: string) {
  const normalizedPdfUri = pdfUri?.trim();

  if (!normalizedPdfUri) {
    throw new Error('Gecerli PDF dosyasi bulunamadi.');
  }

  if (Platform.OS === 'web') {
    throw new Error('PDF sayfa okuma web platformunda desteklenmiyor.');
  }

  const exporterCount = await getPageCountFromExporter(normalizedPdfUri);

  if (exporterCount) {
    return exporterCount;
  }

  return getPageCountFromPdfLib(normalizedPdfUri);
}

export async function renderPdfPageToTempImage(
  input: RenderPdfPageInput,
): Promise<RenderedPdfPage | null> {
  const pdfUri = input.pdfUri?.trim();

  if (!pdfUri || Platform.OS === 'web') {
    return null;
  }

  const normalizedInput = {
    ...input,
    pdfUri,
    pageNumber: normalizePositivePageNumber(input.pageNumber, 1),
  };

  const exporterResult = await renderPageWithExporter(normalizedInput);

  if (exporterResult) {
    return exporterResult;
  }

  return renderPageWithJsi(normalizedInput);
}

export async function rasterizePdfToImages(input: RasterizePdfInput) {
  const pdfUri = input.pdfUri?.trim();

  if (!pdfUri) {
    throw new Error('Gecerli PDF dosyasi bulunamadi.');
  }

  if (Platform.OS === 'web') {
    throw new Error('PDF gorsellestirme web platformunda desteklenmiyor.');
  }

  const totalPageCount = await getPdfPageCount(pdfUri);
  const startPage = Math.min(
    totalPageCount,
    normalizePositivePageNumber(input.startPage, 1),
  );
  const endPage = Math.min(
    totalPageCount,
    Math.max(startPage, normalizePositivePageNumber(input.endPage, totalPageCount)),
  );
  const renderedPages: RenderedPdfPage[] = [];

  try {
    for (let pageNumber = startPage; pageNumber <= endPage; pageNumber += 1) {
      const page = await renderPdfPageToTempImage({
        pdfUri,
        pageNumber,
        scale: input.scale,
        format: input.format,
        quality: input.quality,
      });

      if (!page?.imageUri) {
        throw new Error(`${pageNumber}. sayfa gorsellestirilemedi.`);
      }

      renderedPages.push(page);
    }

    return {
      pageCount: totalPageCount,
      pages: renderedPages,
    };
  } catch (error) {
    await Promise.all(
      renderedPages.map((page) => removeFileIfExists(page.imageUri)),
    );
    throw error;
  }
}

export const pdfRenderService = {
  getPdfPageCount,
  renderPdfPageToTempImage,
  rasterizePdfToImages,
};
