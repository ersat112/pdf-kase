export type TranslateTextInput = {
  text: string;
  sourceLanguage?: string;
  targetLanguage?: 'tr';
  timeoutMs?: number;
};

export type TranslateTextResult = {
  translatedText: string;
  sourceLanguage: string | null;
  targetLanguage: 'tr';
  translatedAt: string;
  provider: 'google-translate-web';
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

function splitLongBlock(block: string, maxLength: number) {
  const words = block.split(/\s+/).filter(Boolean);
  const chunks: string[] = [];
  let current = '';

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;

    if (next.length <= maxLength) {
      current = next;
      continue;
    }

    if (current) {
      chunks.push(current);
    }

    if (word.length <= maxLength) {
      current = word;
      continue;
    }

    let start = 0;

    while (start < word.length) {
      chunks.push(word.slice(start, start + maxLength));
      start += maxLength;
    }

    current = '';
  }

  if (current) {
    chunks.push(current);
  }

  return chunks;
}

function buildTextChunks(text: string, maxLength = 1200) {
  const normalized = normalizeText(text);

  if (!normalized) {
    return [];
  }

  const blocks = normalized
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0);

  const chunks: string[] = [];

  for (const block of blocks) {
    if (block.length <= maxLength) {
      chunks.push(block);
      continue;
    }

    chunks.push(...splitLongBlock(block, maxLength));
  }

  return chunks;
}

function parseTranslateResponse(payload: unknown) {
  if (!Array.isArray(payload)) {
    throw new Error('Çeviri servisi geçersiz yanıt döndü.');
  }

  const translations = Array.isArray(payload[0]) ? payload[0] : [];
  const sourceLanguage =
    typeof payload[2] === 'string' && payload[2].trim().length > 0
      ? payload[2].trim()
      : null;

  const translatedText = translations
    .map((item) => {
      if (!Array.isArray(item)) {
        return '';
      }

      return typeof item[0] === 'string' ? item[0] : '';
    })
    .join('')
    .trim();

  if (!translatedText) {
    throw new Error('Çeviri metni üretilemedi.');
  }

  return {
    translatedText,
    sourceLanguage,
  };
}

async function translateChunkToTurkish(
  text: string,
  timeoutMs: number,
  sourceLanguage = 'auto',
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const url =
      'https://translate.googleapis.com/translate_a/single' +
      `?client=gtx&sl=${encodeURIComponent(sourceLanguage)}` +
      '&tl=tr&dt=t' +
      `&q=${encodeURIComponent(text)}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error('Çeviri servisi yanıt vermedi.');
    }

    const payload = (await response.json()) as unknown;
    return parseTranslateResponse(payload);
  } finally {
    clearTimeout(timeout);
  }
}

export async function translateTextToTurkish(
  input: TranslateTextInput,
): Promise<TranslateTextResult> {
  const normalized = normalizeText(input.text);

  if (!normalized) {
    throw new Error('Çevrilecek metin bulunamadı.');
  }

  const chunks = buildTextChunks(normalized, 1200);

  if (!chunks.length) {
    throw new Error('Çevrilecek metin bulunamadı.');
  }

  const timeoutMs = Math.max(4000, Math.trunc(input.timeoutMs ?? 12000));
  const targetLanguage: 'tr' = input.targetLanguage ?? 'tr';

  const translatedChunks: string[] = [];
  let sourceLanguage: string | null = null;

  for (const chunk of chunks) {
    const result = await translateChunkToTurkish(
      chunk,
      timeoutMs,
      input.sourceLanguage?.trim() || 'auto',
    );

    translatedChunks.push(result.translatedText);

    if (!sourceLanguage && result.sourceLanguage) {
      sourceLanguage = result.sourceLanguage;
    }
  }

  return {
    translatedText: translatedChunks.join('\n\n').trim(),
    sourceLanguage,
    targetLanguage,
    translatedAt: new Date().toISOString(),
    provider: 'google-translate-web',
  };
}