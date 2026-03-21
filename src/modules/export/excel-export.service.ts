import ExcelJS from 'exceljs';

export type BuildExcelDocumentInput = {
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

function buildSummaryWorksheet(
  workbook: ExcelJS.Workbook,
  input: BuildExcelDocumentInput,
) {
  const sheet = workbook.addWorksheet('Belge Ozeti');
  const title = input.title.trim() || 'Belge';
  const generatedAt = input.generatedAt ?? new Date().toISOString();

  sheet.columns = [
    { header: 'Alan', key: 'label', width: 24 },
    { header: 'Değer', key: 'value', width: 52 },
  ];

  sheet.addRows([
    { label: 'Belge Adı', value: title },
    { label: 'Sayfa Sayısı', value: Math.max(0, Math.trunc(input.pageCount || 0)) },
    { label: 'OCR Güncellenme', value: formatDate(input.ocrUpdatedAt) },
    { label: 'Excel Oluşturulma', value: formatDate(generatedAt) },
  ]);

  sheet.getRow(1).font = {
    bold: true,
  };
}

function buildOcrWorksheet(
  workbook: ExcelJS.Workbook,
  input: BuildExcelDocumentInput,
) {
  const sheet = workbook.addWorksheet('OCR Metni');
  const normalizedText = normalizeText(input.text);
  const blocks = normalizedText
    ? normalizedText
        .split(/\n{2,}/)
        .map((block) => block.trim())
        .filter((block) => block.length > 0)
    : [];

  sheet.columns = [
    { header: 'Parça No', key: 'index', width: 12 },
    { header: 'OCR Metni', key: 'text', width: 120 },
  ];

  const rows = blocks.length
    ? blocks.map((block, index) => ({
        index: index + 1,
        text: block,
      }))
    : [
        {
          index: 1,
          text: 'Bu belgede OCR ile çıkarılabilir metin bulunamadı.',
        },
      ];

  sheet.addRows(rows);
  sheet.getRow(1).font = {
    bold: true,
  };

  sheet.getColumn('text').alignment = {
    vertical: 'top',
    wrapText: true,
  };
}

export async function buildExcelDocumentBytes(
  input: BuildExcelDocumentInput,
): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'PDF Kaşe';
  workbook.title = input.title.trim() || 'Belge';
  workbook.created = new Date();

  buildSummaryWorksheet(workbook, input);
  buildOcrWorksheet(workbook, input);

  const output = await workbook.xlsx.writeBuffer();
  return new Uint8Array(output);
}
