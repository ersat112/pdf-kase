import { File } from 'expo-file-system';
import {
  PDFDocument,
  PDFImage,
  StandardFonts,
  degrees,
  rgb,
} from 'pdf-lib';

import { writePdfBytes } from '../storage/file.service';

export type PdfSourcePage = {
  pageId: number;
  imageUri: string;
};

export type SignatureStrokePoint = {
  x: number;
  y: number;
};

export type SignatureStroke = SignatureStrokePoint[];

export type PdfOverlay =
  | {
      type: 'stamp';
      pageId: number;
      imageUri: string;
      x: number;
      y: number;
      width: number;
      height: number;
      rotation?: number;
      opacity?: number;
    }
  | {
      type: 'signature';
      pageId: number;
      x: number;
      y: number;
      width: number;
      height: number;
      rotation?: number;
      opacity?: number;
      imageUri?: string;
      strokes?: SignatureStroke[];
      strokeColor?: string;
      color?: string;
    }
  | {
      type: 'text';
      pageId: number;
      text: string;
      x: number;
      y: number;
      width: number;
      height: number;
      rotation?: number;
      opacity?: number;
      fontSize?: number;
    };

export type BuildPdfInput = {
  title: string;
  pages: PdfSourcePage[];
  overlays?: PdfOverlay[];
  author?: string;
  subject?: string;
  creator?: string;
  addFreeWatermark?: boolean;
};

export type BuildPdfResult = Awaited<ReturnType<typeof writePdfBytes>>;

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const PAGE_MARGIN = 20;
const PAGE_FOOTER_HEIGHT = 18;
const DEFAULT_SIGNATURE_COLOR = '#111111';

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function fitInsideBox(
  sourceWidth: number,
  sourceHeight: number,
  maxWidth: number,
  maxHeight: number,
) {
  if (
    sourceWidth <= 0 ||
    sourceHeight <= 0 ||
    maxWidth <= 0 ||
    maxHeight <= 0
  ) {
    return {
      width: 0,
      height: 0,
    };
  }

  const scale = Math.min(maxWidth / sourceWidth, maxHeight / sourceHeight);

  return {
    width: sourceWidth * scale,
    height: sourceHeight * scale,
  };
}

function normalizeUnit(value: number | undefined, fallback = 0) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return fallback;
  }

  return clamp(value, 0, 1);
}

function normalizeWinAnsiText(value: string) {
  return value
    .replace(/[çÇ]/g, 'c')
    .replace(/[ğĞ]/g, 'g')
    .replace(/[ıİ]/g, 'i')
    .replace(/[öÖ]/g, 'o')
    .replace(/[şŞ]/g, 's')
    .replace(/[üÜ]/g, 'u')
    .replace(/[âÂ]/g, 'a')
    .replace(/[îÎ]/g, 'i')
    .replace(/[ûÛ]/g, 'u')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, '-')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, '?');
}

function normalizeSignatureColor(value?: string | null) {
  if (typeof value !== 'string') {
    return DEFAULT_SIGNATURE_COLOR;
  }

  const trimmed = value.trim();

  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) {
    return trimmed.toUpperCase();
  }

  return DEFAULT_SIGNATURE_COLOR;
}

function parseHexChannel(value: string) {
  return Number.parseInt(value, 16) / 255;
}

function resolvePdfRgbColor(hexColor?: string) {
  const normalized = normalizeSignatureColor(hexColor);

  return rgb(
    parseHexChannel(normalized.slice(1, 3)),
    parseHexChannel(normalized.slice(3, 5)),
    parseHexChannel(normalized.slice(5, 7)),
  );
}

function resolveOverlaySignatureColor(
  overlay: Extract<PdfOverlay, { type: 'signature' }>,
) {
  return normalizeSignatureColor(overlay.strokeColor ?? overlay.color);
}

function resolveImageFormat(bytes: Uint8Array): 'png' | 'jpg' {
  const isPng =
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47;

  if (isPng) {
    return 'png';
  }

  const isJpg =
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff;

  if (isJpg) {
    return 'jpg';
  }

  throw new Error('Desteklenmeyen görsel formatı. PNG veya JPG kullanılmalı.');
}

async function embedImage(
  pdfDoc: PDFDocument,
  imageUri: string,
  cache: Map<string, PDFImage>,
) {
  const cached = cache.get(imageUri);

  if (cached) {
    return cached;
  }

  const file = new File(imageUri);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const format = resolveImageFormat(bytes);

  const embedded =
    format === 'png'
      ? await pdfDoc.embedPng(bytes)
      : await pdfDoc.embedJpg(bytes);

  cache.set(imageUri, embedded);

  return embedded;
}

function normalizeSignatureStrokes(
  strokes: SignatureStroke[] | undefined,
): SignatureStroke[] {
  if (!Array.isArray(strokes)) {
    return [];
  }

  return strokes
    .map((stroke) =>
      Array.isArray(stroke)
        ? stroke
            .map((point) => ({
              x: normalizeUnit(point?.x),
              y: normalizeUnit(point?.y),
            }))
            .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
        : [],
    )
    .filter((stroke) => stroke.length >= 2);
}

function drawSignatureStrokes(params: {
  page: ReturnType<PDFDocument['addPage']>;
  overlayX: number;
  overlayY: number;
  overlayWidth: number;
  overlayHeight: number;
  opacity: number;
  strokes: SignatureStroke[];
  strokeColor?: string;
}) {
  const {
    page,
    overlayX,
    overlayY,
    overlayWidth,
    overlayHeight,
    opacity,
    strokes,
    strokeColor,
  } = params;

  if (overlayWidth <= 0 || overlayHeight <= 0) {
    return;
  }

  const lineThickness = clamp(overlayHeight * 0.045, 1.1, 3.2);
  const resolvedColor = resolvePdfRgbColor(strokeColor);

  for (const stroke of strokes) {
    for (let index = 1; index < stroke.length; index += 1) {
      const previous = stroke[index - 1];
      const current = stroke[index];

      const startX = overlayX + previous.x * overlayWidth;
      const startY = overlayY + (1 - previous.y) * overlayHeight;
      const endX = overlayX + current.x * overlayWidth;
      const endY = overlayY + (1 - current.y) * overlayHeight;

      page.drawLine({
        start: { x: startX, y: startY },
        end: { x: endX, y: endY },
        thickness: lineThickness,
        color: resolvedColor,
        opacity,
      });
    }
  }
}

function drawFreeWatermark(params: {
  page: ReturnType<PDFDocument['addPage']>;
  font: Awaited<ReturnType<PDFDocument['embedFont']>>;
}) {
  const { page, font } = params;
  const centerX = A4_WIDTH / 2;
  const centerY = A4_HEIGHT / 2;

  page.drawText(normalizeWinAnsiText('PDF Kase Free'), {
    x: centerX - 150,
    y: centerY,
    size: 34,
    font,
    color: rgb(0.55, 0.55, 0.55),
    opacity: 0.14,
    rotate: degrees(-35),
  });

  page.drawText(normalizeWinAnsiText('Free surum PDF ciktisi'), {
    x: PAGE_MARGIN,
    y: A4_HEIGHT - 18,
    size: 10,
    font,
    color: rgb(0.5, 0.5, 0.5),
    opacity: 0.8,
  });
}

export async function buildPdfFromImages(
  input: BuildPdfInput,
): Promise<BuildPdfResult> {
  if (!input.pages.length) {
    throw new Error('PDF oluşturmak için en az bir sayfa gerekli.');
  }

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const imageCache = new Map<string, PDFImage>();

  pdfDoc.setTitle(input.title);
  pdfDoc.setAuthor(input.author ?? 'PDF Kaşe');
  pdfDoc.setSubject(input.subject ?? 'Taranmış belge');
  pdfDoc.setCreator(input.creator ?? 'PDF Kaşe');

  for (let index = 0; index < input.pages.length; index += 1) {
    const sourcePage = input.pages[index];
    const page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);

    page.drawRectangle({
      x: 0,
      y: 0,
      width: A4_WIDTH,
      height: A4_HEIGHT,
      color: rgb(1, 1, 1),
    });

    const embeddedImage = await embedImage(pdfDoc, sourcePage.imageUri, imageCache);
    const originalDims = embeddedImage.scale(1);

    const contentWidth = A4_WIDTH - PAGE_MARGIN * 2;
    const contentHeight = A4_HEIGHT - PAGE_MARGIN * 2 - PAGE_FOOTER_HEIGHT;

    const drawDims = fitInsideBox(
      originalDims.width,
      originalDims.height,
      contentWidth,
      contentHeight,
    );

    const baseX = PAGE_MARGIN + (contentWidth - drawDims.width) / 2;
    const baseY = PAGE_MARGIN + (contentHeight - drawDims.height) / 2 + 10;

    page.drawImage(embeddedImage, {
      x: baseX,
      y: baseY,
      width: drawDims.width,
      height: drawDims.height,
    });

    const pageOverlays = (input.overlays ?? []).filter(
      (overlay) => overlay.pageId === sourcePage.pageId,
    );

    for (const overlay of pageOverlays) {
      const normalizedX = normalizeUnit(overlay.x);
      const normalizedY = normalizeUnit(overlay.y);
      const normalizedWidth = normalizeUnit(overlay.width);
      const normalizedHeight = normalizeUnit(overlay.height);
      const normalizedOpacity = clamp(overlay.opacity ?? 1, 0, 1);
      const normalizedRotation = Number.isFinite(overlay.rotation ?? 0)
        ? overlay.rotation ?? 0
        : 0;

      const overlayWidth = normalizedWidth * drawDims.width;
      const overlayHeight = normalizedHeight * drawDims.height;

      if (overlayWidth <= 0 || overlayHeight <= 0) {
        continue;
      }

      const overlayX = baseX + normalizedX * drawDims.width;
      const overlayY =
        baseY + (1 - normalizedY - normalizedHeight) * drawDims.height;

      if (overlay.type === 'stamp') {
        const overlayImage = await embedImage(pdfDoc, overlay.imageUri, imageCache);

        page.drawImage(overlayImage, {
          x: overlayX,
          y: overlayY,
          width: overlayWidth,
          height: overlayHeight,
          rotate: degrees(normalizedRotation),
          opacity: normalizedOpacity,
        });
      }

      if (overlay.type === 'signature') {
        if (overlay.imageUri) {
          const overlayImage = await embedImage(pdfDoc, overlay.imageUri, imageCache);

          page.drawImage(overlayImage, {
            x: overlayX,
            y: overlayY,
            width: overlayWidth,
            height: overlayHeight,
            rotate: degrees(normalizedRotation),
            opacity: normalizedOpacity,
          });
          continue;
        }

        const normalizedStrokes = normalizeSignatureStrokes(overlay.strokes);

        if (!normalizedStrokes.length) {
          continue;
        }

        drawSignatureStrokes({
          page,
          overlayX,
          overlayY,
          overlayWidth,
          overlayHeight,
          opacity: normalizedOpacity,
          strokes: normalizedStrokes,
          strokeColor: resolveOverlaySignatureColor(overlay),
        });
      }

      if (overlay.type === 'text') {
        const fontSize = overlay.fontSize ?? 14;
        const textY = overlayY + Math.max(0, overlayHeight - fontSize);
        const safeText = normalizeWinAnsiText(overlay.text);

        if (!safeText.trim()) {
          continue;
        }

        page.drawText(safeText, {
          x: overlayX,
          y: textY,
          size: fontSize,
          font,
          color: rgb(0.1, 0.1, 0.1),
          rotate: degrees(normalizedRotation),
          opacity: normalizedOpacity,
          maxWidth: overlayWidth,
        });
      }
    }

    if (input.addFreeWatermark) {
      drawFreeWatermark({ page, font });
    }

    page.drawText(`${index + 1} / ${input.pages.length}`, {
      x: A4_WIDTH - 60,
      y: 8,
      size: 9,
      font,
      color: rgb(0.45, 0.45, 0.45),
    });
  }

  const pdfBytes = await pdfDoc.save();
  return writePdfBytes(input.title, pdfBytes);
}