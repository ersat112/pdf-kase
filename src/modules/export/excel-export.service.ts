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

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildHtmlWorkbook(input: BuildExcelDocumentInput) {
  const title = input.title.trim() || 'Belge';
  const normalizedText = normalizeText(input.text);
  const generatedAt = input.generatedAt ?? new Date().toISOString();

  const ocrTextHtml = normalizedText
    ? escapeHtml(normalizedText).replace(/\n/g, '<br/>')
    : 'Bu belgede OCR ile çıkarılabilir metin bulunamadı.';

  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:x="urn:schemas-microsoft-com:office:excel"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8" />
  <meta http-equiv="Content-Type" content="application/vnd.ms-excel; charset=utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: Arial, Helvetica, sans-serif; }
    table { border-collapse: collapse; width: 100%; }
    th, td {
      border: 1px solid #C9D2DD;
      padding: 8px;
      vertical-align: top;
      text-align: left;
    }
    th {
      background: #EEF3F8;
      font-weight: 700;
    }
    .section-title {
      font-size: 16px;
      font-weight: 700;
      margin: 16px 0 8px;
    }
    .text-cell {
      white-space: normal;
    }
  </style>
</head>
<body>
  <div class="section-title">Belge Özeti</div>
  <table>
    <tr>
      <th>Belge Adı</th>
      <th>Sayfa Sayısı</th>
      <th>OCR Güncellenme</th>
      <th>Excel Oluşturulma</th>
    </tr>
    <tr>
      <td>${escapeHtml(title)}</td>
      <td>${Math.max(0, Math.trunc(input.pageCount || 0))}</td>
      <td>${escapeHtml(formatDate(input.ocrUpdatedAt))}</td>
      <td>${escapeHtml(formatDate(generatedAt))}</td>
    </tr>
  </table>

  <div class="section-title">OCR Metni</div>
  <table>
    <tr>
      <th>Metin</th>
    </tr>
    <tr>
      <td class="text-cell">${ocrTextHtml}</td>
    </tr>
  </table>
</body>
</html>`;
}

export async function buildExcelDocumentBytes(
  input: BuildExcelDocumentInput,
): Promise<Uint8Array> {
  const workbookHtml = buildHtmlWorkbook(input);
  return new TextEncoder().encode(workbookHtml);
}