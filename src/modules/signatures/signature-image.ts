import * as ImageManipulator from 'expo-image-manipulator';

import type { SignatureStroke } from '../overlays/overlay.service';

type SignatureBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

export type TrimmedSignatureImage = {
  sourceUri: string;
  previewSourceUri: string;
  crop: {
    originX: number;
    originY: number;
    width: number;
    height: number;
  };
  metadata: {
    source: 'signature-pad-v2';
    cropOriginX: number;
    cropOriginY: number;
    cropWidth: number;
    cropHeight: number;
    previewWidth: number;
    previewHeight: number;
  };
};

type CreateTrimmedSignatureImageInput = {
  snapshotUri: string;
  strokes: SignatureStroke[];
  padWidth: number;
  padHeight: number;
  strokeWidth: number;
  padding?: number;
  previewMaxWidth?: number;
};

function clampUnit(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(1, value));
}

function getSignatureBounds(strokes: SignatureStroke[]): SignatureBounds | null {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const stroke of strokes) {
    for (const point of stroke) {
      const x = clampUnit(point.x);
      const y = clampUnit(point.y);

      if (x < minX) {
        minX = x;
      }

      if (y < minY) {
        minY = y;
      }

      if (x > maxX) {
        maxX = x;
      }

      if (y > maxY) {
        maxY = y;
      }
    }
  }

  if (
    !Number.isFinite(minX) ||
    !Number.isFinite(minY) ||
    !Number.isFinite(maxX) ||
    !Number.isFinite(maxY)
  ) {
    return null;
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
  };
}

export async function createTrimmedSignatureImage(
  input: CreateTrimmedSignatureImageInput,
): Promise<TrimmedSignatureImage> {
  const snapshotUri = input.snapshotUri?.trim();

  if (!snapshotUri) {
    throw new Error('İmza önizleme görseli bulunamadı.');
  }

  if (input.padWidth <= 0 || input.padHeight <= 0) {
    throw new Error('İmza alanı henüz hazır değil.');
  }

  const bounds = getSignatureBounds(input.strokes);

  if (!bounds) {
    throw new Error('Kırpılacak geçerli imza çizgisi bulunamadı.');
  }

  const edgePadding = Math.max(
    16,
    Math.round((input.padding ?? 20) + input.strokeWidth * 3),
  );

  const rawOriginX = Math.floor(bounds.minX * input.padWidth) - edgePadding;
  const rawOriginY = Math.floor(bounds.minY * input.padHeight) - edgePadding;
  const rawMaxX = Math.ceil(bounds.maxX * input.padWidth) + edgePadding;
  const rawMaxY = Math.ceil(bounds.maxY * input.padHeight) + edgePadding;

  const originX = Math.max(0, rawOriginX);
  const originY = Math.max(0, rawOriginY);
  const maxX = Math.min(input.padWidth, rawMaxX);
  const maxY = Math.min(input.padHeight, rawMaxY);

  const width = Math.max(1, Math.round(maxX - originX));
  const height = Math.max(1, Math.round(maxY - originY));

  const cropped = await ImageManipulator.manipulateAsync(
    snapshotUri,
    [
      {
        crop: {
          originX,
          originY,
          width,
          height,
        },
      },
    ],
    {
      compress: 1,
      format: ImageManipulator.SaveFormat.PNG,
    },
  );

  let previewSourceUri = cropped.uri;
  let previewWidth = width;
  let previewHeight = height;

  const previewMaxWidth = Math.max(280, Math.round(input.previewMaxWidth ?? 560));

  if (width > previewMaxWidth) {
    previewWidth = previewMaxWidth;
    previewHeight = Math.max(1, Math.round((height / width) * previewWidth));

    const preview = await ImageManipulator.manipulateAsync(
      cropped.uri,
      [
        {
          resize: {
            width: previewWidth,
            height: previewHeight,
          },
        },
      ],
      {
        compress: 1,
        format: ImageManipulator.SaveFormat.PNG,
      },
    );

    previewSourceUri = preview.uri;
  }

  return {
    sourceUri: cropped.uri,
    previewSourceUri,
    crop: {
      originX,
      originY,
      width,
      height,
    },
    metadata: {
      source: 'signature-pad-v2',
      cropOriginX: originX,
      cropOriginY: originY,
      cropWidth: width,
      cropHeight: height,
      previewWidth,
      previewHeight,
    },
  };
}