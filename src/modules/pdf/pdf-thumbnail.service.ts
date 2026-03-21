import { Platform } from 'react-native';

import {
  persistThumbnailImage,
  removeFileIfExists,
} from '../storage/file.service';
import { renderPdfPageToTempImage } from './pdf-render.service';

type GenerateImportedPdfThumbnailInput = {
  pdfUri: string;
  pageNumber?: number;
  scale?: number;
  prefix?: string;
};

export async function generateImportedPdfThumbnail(
  input: GenerateImportedPdfThumbnailInput,
) {
  const pdfUri = input.pdfUri?.trim();

  if (!pdfUri || Platform.OS === 'web') {
    return null;
  }

  const renderedPage = await renderPdfPageToTempImage({
    pdfUri,
    pageNumber: Math.max(1, Math.trunc(input.pageNumber ?? 1)),
    scale: Math.max(1, input.scale ?? 1.4),
    format: 'jpeg',
    quality: 0.88,
  });

  if (!renderedPage?.imageUri) {
    return null;
  }

  try {
    const persisted = await persistThumbnailImage(
      renderedPage.imageUri,
      input.prefix ?? 'pdf-thumb',
    );
    return persisted.uri;
  } finally {
    await removeFileIfExists(renderedPage.imageUri);
  }
}

export const pdfThumbnailService = {
  generateImportedPdfThumbnail,
};
