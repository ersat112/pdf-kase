import {
  ImageFormat,
  PaintStyle,
  Skia,
  StrokeCap,
  StrokeJoin,
} from '@shopify/react-native-skia';
import { File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Image } from 'react-native';

import { removeFileIfExists } from '../storage/file.service';
import {
  cleanupStampBackground,
  type StampCleanupMode,
} from './stamp-cleanup.service';

export type PdfImageQualityPreset = 'compact' | 'balanced' | 'high';

export type EraseStrokePoint = {
  x: number;
  y: number;
};

export type EraseStroke = EraseStrokePoint[];

export type SmartEraseOptions = {
  brushSizeRatio?: number;
  outputFormat?: 'png' | 'jpg';
  quality?: number;
  backgroundColor?: string;
};

export type StampAssetPreparationOptions = {
  rotation?: 0 | 90 | 180 | 270;
  maxLongEdge?: number;
  previewWidth?: number;
  requestBackgroundCleanup?: boolean;
  strictBackgroundCleanup?: boolean;
};

export type StampAssetPreparationResult = {
  processedUri: string;
  previewUri: string;
  metadata: {
    sourceWidth: number;
    sourceHeight: number;
    outputWidth: number;
    outputHeight: number;
    previewWidth: number;
    previewHeight: number;
    backgroundRemoved: boolean;
    cleanupMode: StampCleanupMode;
    cleanupProvider: string | null;
    cleanupWarning: string | null;
    format: 'png';
    preparedAt: string;
  };
};

function getResizeWidthForPreset(preset: PdfImageQualityPreset) {
  switch (preset) {
    case 'compact':
      return 1200;
    case 'high':
      return 2200;
    case 'balanced':
    default:
      return 1600;
  }
}

function getCompressForPreset(preset: PdfImageQualityPreset) {
  switch (preset) {
    case 'compact':
      return 0.68;
    case 'high':
      return 0.92;
    case 'balanced':
    default:
      return 0.82;
  }
}

function ensureValidSourceUri(sourceUri: string) {
  const trimmed = sourceUri?.trim();

  if (!trimmed) {
    throw new Error('Geçerli bir görsel bulunamadı.');
  }

  return trimmed;
}

function clamp01(value: number) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 0;
  }

  return Math.max(0, Math.min(1, value));
}

function shouldPreserveTransparency(sourceUri: string) {
  return /\.png(\?.*)?$/i.test(sourceUri);
}

export async function getImageSize(sourceUri: string) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    Image.getSize(
      sourceUri,
      (width, height) => resolve({ width, height }),
      () => reject(new Error('Görsel boyutu okunamadı.')),
    );
  });
}

function getScaledSizeWithinLongEdge(
  width: number,
  height: number,
  maxLongEdge: number,
) {
  if (width <= 0 || height <= 0 || maxLongEdge <= 0) {
    return { width, height };
  }

  const currentLongEdge = Math.max(width, height);

  if (currentLongEdge <= maxLongEdge) {
    return { width, height };
  }

  const scale = maxLongEdge / currentLongEdge;

  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

async function saveAsPng(
  sourceUri: string,
  options?: {
    width?: number;
    rotate?: number;
  },
) {
  const context = ImageManipulator.manipulate(sourceUri);

  if (options?.rotate) {
    context.rotate(options.rotate);
  }

  if (options?.width && options.width > 0) {
    context.resize({ width: options.width });
  }

  const rendered = await context.renderAsync();

  return rendered.saveAsync({
    format: SaveFormat.PNG,
  });
}

function normalizeEraseStrokes(strokes: EraseStroke[]) {
  if (!Array.isArray(strokes)) {
    throw new Error('Geçerli silme verisi bulunamadı.');
  }

  const normalized = strokes
    .map((stroke) =>
      Array.isArray(stroke)
        ? stroke
            .map((point) => ({
              x: clamp01(point?.x),
              y: clamp01(point?.y),
            }))
            .filter(
              (point) =>
                Number.isFinite(point.x) && Number.isFinite(point.y),
            )
        : [],
    )
    .filter((stroke) => stroke.length >= 2);

  if (!normalized.length) {
    throw new Error('Silinecek alan işaretlenmedi.');
  }

  return normalized;
}

export async function applySmartEraseToImage(
  sourceUri: string,
  strokes: EraseStroke[],
  options: SmartEraseOptions = {},
) {
  const normalizedSourceUri = ensureValidSourceUri(sourceUri);
  const normalizedStrokes = normalizeEraseStrokes(strokes);

  const sourceFile = new File(normalizedSourceUri);
  const encoded = new Uint8Array(await sourceFile.arrayBuffer());
  const data = Skia.Data.fromBytes(encoded);
  const image = Skia.Image.MakeImageFromEncoded(data);

  if (!image) {
    throw new Error('Görsel işlenemedi.');
  }

  const width = image.width();
  const height = image.height();
  const surface = Skia.Surface.MakeOffscreen(width, height);

  if (!surface) {
    throw new Error('Silme yüzeyi oluşturulamadı.');
  }

  const canvas = surface.getCanvas();
  const backgroundColor = options.backgroundColor ?? '#FFFFFF';
  const brushSizeRatio = Math.max(
    0.004,
    Math.min(0.08, options.brushSizeRatio ?? 0.02),
  );

  const backgroundPaint = Skia.Paint();
  backgroundPaint.setColor(Skia.Color(backgroundColor));
  canvas.drawRect(Skia.XYWHRect(0, 0, width, height), backgroundPaint);
  canvas.drawImage(image, 0, 0);

  const erasePaint = Skia.Paint();
  erasePaint.setColor(Skia.Color(backgroundColor));
  erasePaint.setStyle(PaintStyle.Stroke);
  erasePaint.setStrokeCap(StrokeCap.Round);
  erasePaint.setStrokeJoin(StrokeJoin.Round);
  erasePaint.setAntiAlias(true);
  erasePaint.setStrokeWidth(
    Math.max(6, Math.round(Math.max(width, height) * brushSizeRatio)),
  );

  for (const stroke of normalizedStrokes) {
    const path = Skia.Path.Make();

    stroke.forEach((point, index) => {
      const x = point.x * width;
      const y = point.y * height;

      if (index === 0) {
        path.moveTo(x, y);
        return;
      }

      path.lineTo(x, y);
    });

    canvas.drawPath(path, erasePaint);
  }

  surface.flush();

  const snapshot = surface.makeImageSnapshot();
  const outputFormat = options.outputFormat ?? 'jpg';
  const quality = Math.max(1, Math.min(100, Math.round((options.quality ?? 0.96) * 100)));
  const bytes =
    outputFormat === 'png'
      ? snapshot.encodeToBytes(ImageFormat.PNG, 100)
      : snapshot.encodeToBytes(ImageFormat.JPEG, quality);

  if (!bytes || bytes.length === 0) {
    throw new Error('Silinmiş görsel oluşturulamadı.');
  }

  const extension = outputFormat === 'png' ? 'png' : 'jpg';
  const outputFile = new File(
    Paths.cache,
    `smart-erase-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`,
  );

  if (outputFile.exists) {
    outputFile.delete();
  }

  outputFile.create();
  outputFile.write(bytes);

  return outputFile.uri;
}

export async function rotateImageRight(sourceUri: string) {
  const normalizedSourceUri = ensureValidSourceUri(sourceUri);
  const context = ImageManipulator.manipulate(normalizedSourceUri);

  context.rotate(90);

  const rendered = await context.renderAsync();

  if (shouldPreserveTransparency(normalizedSourceUri)) {
    const result = await rendered.saveAsync({
      format: SaveFormat.PNG,
    });

    return result.uri;
  }

  const result = await rendered.saveAsync({
    format: SaveFormat.JPEG,
    compress: 0.95,
  });

  return result.uri;
}

export async function optimizeImageForPdf(
  sourceUri: string,
  preset: PdfImageQualityPreset = 'balanced',
) {
  const normalizedSourceUri = ensureValidSourceUri(sourceUri);
  const targetWidth = getResizeWidthForPreset(preset);
  const context = ImageManipulator.manipulate(normalizedSourceUri);

  try {
    const { width } = await getImageSize(normalizedSourceUri);

    if (width > targetWidth) {
      context.resize({
        width: targetWidth,
      });
    }
  } catch {
    context.resize({
      width: targetWidth,
    });
  }

  const rendered = await context.renderAsync();
  const result = await rendered.saveAsync({
    format: SaveFormat.JPEG,
    compress: getCompressForPreset(preset),
  });

  return result.uri;
}

export async function prepareStampAssetImage(
  sourceUri: string,
  options: StampAssetPreparationOptions = {},
): Promise<StampAssetPreparationResult> {
  const normalizedSourceUri = ensureValidSourceUri(sourceUri);
  const sourceSize = await getImageSize(normalizedSourceUri);
  const rotation = options.rotation ?? 0;
  const maxLongEdge = options.maxLongEdge ?? 1800;
  const previewWidth = options.previewWidth ?? 560;
  const requestBackgroundCleanup = options.requestBackgroundCleanup !== false;

  const cleanupResult = requestBackgroundCleanup
    ? await cleanupStampBackground(normalizedSourceUri, {
        failureMode: options.strictBackgroundCleanup ? 'throw' : 'fallback',
      })
    : {
        cleanedUri: normalizedSourceUri,
        backgroundRemoved: shouldPreserveTransparency(normalizedSourceUri),
        cleanupMode: shouldPreserveTransparency(normalizedSourceUri)
          ? ('preserved-transparent-png' as const)
          : ('optimized' as const),
        cleanupProvider: shouldPreserveTransparency(normalizedSourceUri)
          ? 'input-transparent-png'
          : null,
        warning: null,
      };

  const processingSourceUri = cleanupResult.cleanedUri || normalizedSourceUri;

  const cleanupSourceSize =
    processingSourceUri === normalizedSourceUri
      ? sourceSize
      : await getImageSize(processingSourceUri);

  const rotatedSize =
    rotation === 90 || rotation === 270
      ? { width: cleanupSourceSize.height, height: cleanupSourceSize.width }
      : cleanupSourceSize;

  const scaledMain = getScaledSizeWithinLongEdge(
    rotatedSize.width,
    rotatedSize.height,
    maxLongEdge,
  );

  let mainResultUri: string | null = null;
  let previewResultUri: string | null = null;

  try {
    const mainResult = await saveAsPng(processingSourceUri, {
      rotate: rotation,
      width: scaledMain.width < rotatedSize.width ? scaledMain.width : undefined,
    });
    mainResultUri = mainResult.uri;

    const mainSize = await getImageSize(mainResult.uri);
    const scaledPreview = getScaledSizeWithinLongEdge(
      mainSize.width,
      mainSize.height,
      previewWidth,
    );

    const previewResult = await saveAsPng(mainResult.uri, {
      width: scaledPreview.width < mainSize.width ? scaledPreview.width : undefined,
    });
    previewResultUri = previewResult.uri;

    const previewSizeInfo = await getImageSize(previewResult.uri);

    return {
      processedUri: mainResult.uri,
      previewUri: previewResult.uri,
      metadata: {
        sourceWidth: sourceSize.width,
        sourceHeight: sourceSize.height,
        outputWidth: mainSize.width,
        outputHeight: mainSize.height,
        previewWidth: previewSizeInfo.width,
        previewHeight: previewSizeInfo.height,
        backgroundRemoved: cleanupResult.backgroundRemoved,
        cleanupMode: cleanupResult.cleanupMode,
        cleanupProvider: cleanupResult.cleanupProvider,
        cleanupWarning: cleanupResult.warning,
        format: 'png',
        preparedAt: new Date().toISOString(),
      },
    };
  } finally {
    const temporaryCleanupUri =
      processingSourceUri !== normalizedSourceUri &&
      processingSourceUri !== mainResultUri &&
      processingSourceUri !== previewResultUri
        ? processingSourceUri
        : null;

    if (temporaryCleanupUri) {
      await removeFileIfExists(temporaryCleanupUri);
    }
  }
}