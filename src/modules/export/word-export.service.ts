import {
    Document,
    HeadingLevel,
    Packer,
    Paragraph,
    TextRun,
} from 'docx';

export type BuildWordDocumentInput = {
  title: string;
  text: string;
  pageCount: number;
  generatedAt?: string;
  ocrUpdatedAt?: string | null;
};

function normalizeText(value: string | null | undefined) {
  if (typeof value !== 'string') {
    return '';
  }

  return value
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function formatDate(value?: string | null) {
  if (!value) {
    return 'Bilinmiyor';
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return 'Bilinmiyor';
  }

  return parsed.toLocaleString('tr-TR');
}

function buildParagraphFromBlock(block: string) {
  const lines = block
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (!lines.length) {
    return new Paragraph({});
  }

  return new Paragraph({
    children: lines.map((line, index) =>
      index === 0
        ? new TextRun({ text: line })
        : new TextRun({ text: line, break: 1 }),
    ),
  });
}

function buildBodyParagraphs(text: string) {
  const normalized = normalizeText(text);

  if (!normalized) {
    return [
      new Paragraph({
        children: [
          new TextRun({ text: 'Bu belgede OCR ile çıkarılabilir metin bulunamadı.' }),
        ],
      }),
    ];
  }

  return normalized
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0)
    .map(buildParagraphFromBlock);
}

export async function buildWordDocumentBytes(
  input: BuildWordDocumentInput,
): Promise<Uint8Array> {
  const title = input.title.trim() || 'Belge';
  const generatedAt = input.generatedAt ?? new Date().toISOString();

  const document = new Document({
    creator: 'PDF Kaşe',
    title,
    description: 'OCR metninden oluşturulan DOCX çıktısı',
    sections: [
      {
        children: [
          new Paragraph({
            text: title,
            heading: HeadingLevel.HEADING_1,
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: 'Sayfa sayısı: ',
                bold: true,
              }),
              new TextRun({ text: String(Math.max(0, Math.trunc(input.pageCount || 0))) }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: 'OCR güncellenme: ',
                bold: true,
              }),
              new TextRun({ text: formatDate(input.ocrUpdatedAt) }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: 'DOCX oluşturulma: ',
                bold: true,
              }),
              new TextRun({ text: formatDate(generatedAt) }),
            ],
          }),
          new Paragraph({}),
          ...buildBodyParagraphs(input.text),
        ],
      },
    ],
  });

  const output = await Packer.toArrayBuffer(document);
  return new Uint8Array(output);
}