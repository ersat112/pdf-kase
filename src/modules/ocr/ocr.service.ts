import { recognizeText } from '@infinitered/react-native-mlkit-text-recognition';

export type OcrPageInput = {
  pageId: number;
  pageOrder: number;
  imageUri: string;
};

export type OcrPageResult = {
  pageId: number;
  pageOrder: number;
  text: string;
};

export type OcrExtractionResult = {
  text: string;
  pages: OcrPageResult[];
};

function normalizeOcrText(value: string | null | undefined) {
  if (typeof value !== 'string') {
    return '';
  }

  return value
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[\t\f\v]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function sortPages(pages: OcrPageInput[]) {
  return [...pages].sort((left, right) => left.pageOrder - right.pageOrder);
}

export async function extractTextFromDocumentPages(
  pages: OcrPageInput[],
): Promise<OcrExtractionResult> {
  const validPages = sortPages(
    pages.filter(
      (page) =>
        Number.isInteger(page.pageId) &&
        page.pageId > 0 &&
        Number.isInteger(page.pageOrder) &&
        typeof page.imageUri === 'string' &&
        page.imageUri.trim().length > 0,
    ),
  );

  if (!validPages.length) {
    throw new Error('OCR için en az bir geçerli sayfa gerekli.');
  }

  const recognizedPages: OcrPageResult[] = [];

  for (const page of validPages) {
    const result = await recognizeText(page.imageUri);
    recognizedPages.push({
      pageId: page.pageId,
      pageOrder: page.pageOrder,
      text: normalizeOcrText(result?.text ?? ''),
    });
  }

  return {
    pages: recognizedPages,
    text: recognizedPages
      .map((page) => page.text)
      .filter((text) => text.length > 0)
      .join('\n\n'),
  };
}