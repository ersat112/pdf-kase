import {
  resolveTranslationRuntimeProvider,
  translationRuntimeConfig,
  type TranslationRuntimeProvider,
} from './translation-runtime-config.service';

export type TranslateTextInput = {
  text: string;
  sourceLanguage?: string;
  targetLanguage?: 'tr';
  timeoutMs?: number;
};

export type TranslateTextProvider = Exclude<
  TranslationRuntimeProvider,
  'auto' | 'none'
>;

export type TranslateTextResult = {
  translatedText: string;
  sourceLanguage: string | null;
  targetLanguage: 'tr';
  translatedAt: string;
  provider: TranslateTextProvider;
};

type DeepLTranslateResponse = {
  translations?: Array<{
    detected_source_language?: string;
    text?: string;
  }>;
};

type AzureTranslateResponse = Array<{
  detectedLanguage?: {
    language?: string;
  };
  translations?: Array<{
    text?: string;
    to?: string;
  }>;
}>;

type LibreTranslateResponse = {
  translatedText?: string;
  detectedLanguage?: {
    language?: string;
  };
};

type GoogleLegacyTranslateResponse = unknown;

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

function normalizeLanguageCode(value: string | null | undefined) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.toLowerCase() : null;
}

function normalizeRequestedSourceLanguage(value: string | undefined) {
  const normalized = normalizeLanguageCode(value);
  return normalized && normalized !== 'auto' ? normalized : null;
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

function buildTextChunks(text: string, maxLength = 1600) {
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

function createTimedAbortSignal(timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  return {
    signal: controller.signal,
    clear: () => clearTimeout(timeout),
  };
}

async function parseJsonResponse<TPayload>(
  response: Response,
  fallbackMessage: string,
): Promise<TPayload> {
  if (!response.ok) {
    let detail = '';

    try {
      detail = (await response.text()).trim();
    } catch {
      detail = '';
    }

    throw new Error(detail || fallbackMessage);
  }

  return (await response.json()) as TPayload;
}

function parseGoogleLegacyResponse(payload: GoogleLegacyTranslateResponse) {
  if (!Array.isArray(payload)) {
    throw new Error('Legacy çeviri servisi geçersiz yanıt döndü.');
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
    throw new Error('Legacy çeviri metni üretilemedi.');
  }

  return {
    translatedText,
    sourceLanguage: normalizeLanguageCode(sourceLanguage),
  };
}

async function translateWithDeepL(params: {
  chunks: string[];
  sourceLanguage: string | null;
  timeoutMs: number;
}): Promise<TranslateTextResult> {
  if (!translationRuntimeConfig.deepLApiKey) {
    throw new Error('DeepL API Free için EXPO_PUBLIC_DEEPL_API_KEY gerekli.');
  }

  const { signal, clear } = createTimedAbortSignal(params.timeoutMs);

  try {
    const body: Record<string, unknown> = {
      text: params.chunks,
      target_lang: 'TR',
    };

    if (params.sourceLanguage) {
      body.source_lang = params.sourceLanguage.toUpperCase();
    }

    const response = await fetch(
      `${translationRuntimeConfig.deepLBaseUrl}/v2/translate`,
      {
        method: 'POST',
        headers: {
          Authorization: `DeepL-Auth-Key ${translationRuntimeConfig.deepLApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal,
      },
    );

    const payload = await parseJsonResponse<DeepLTranslateResponse>(
      response,
      'DeepL API Free yanıt vermedi.',
    );

    const translations = Array.isArray(payload.translations)
      ? payload.translations
      : [];

    const translatedChunks = translations
      .map((translation) =>
        typeof translation.text === 'string' ? translation.text.trim() : '',
      )
      .filter((chunk) => chunk.length > 0);

    if (!translatedChunks.length) {
      throw new Error('DeepL çeviri metni üretilemedi.');
    }

    const sourceLanguage = normalizeLanguageCode(
      translations[0]?.detected_source_language,
    );

    return {
      translatedText: translatedChunks.join('\n\n').trim(),
      sourceLanguage,
      targetLanguage: 'tr',
      translatedAt: new Date().toISOString(),
      provider: 'deepl_api_free',
    };
  } finally {
    clear();
  }
}

async function translateWithAzure(params: {
  chunks: string[];
  sourceLanguage: string | null;
  timeoutMs: number;
}): Promise<TranslateTextResult> {
  if (!translationRuntimeConfig.azureTranslatorKey) {
    throw new Error(
      'Azure Translator için EXPO_PUBLIC_AZURE_TRANSLATOR_KEY gerekli.',
    );
  }

  const { signal, clear } = createTimedAbortSignal(params.timeoutMs);

  try {
    const query = new URLSearchParams({
      'api-version': '3.0',
      to: 'tr',
    });

    if (params.sourceLanguage) {
      query.set('from', params.sourceLanguage);
    }

    const headers: Record<string, string> = {
      'Ocp-Apim-Subscription-Key': translationRuntimeConfig.azureTranslatorKey,
      'Content-Type': 'application/json',
    };

    if (translationRuntimeConfig.azureTranslatorRegion) {
      headers['Ocp-Apim-Subscription-Region'] =
        translationRuntimeConfig.azureTranslatorRegion;
    }

    const response = await fetch(
      `${translationRuntimeConfig.azureTranslatorEndpoint}/translate?${query.toString()}`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(params.chunks.map((text) => ({ text }))),
        signal,
      },
    );

    const payload = await parseJsonResponse<AzureTranslateResponse>(
      response,
      'Azure Translator yanıt vermedi.',
    );

    const translatedChunks = payload
      .map((entry) => {
        const first = Array.isArray(entry.translations)
          ? entry.translations[0]
          : null;

        return typeof first?.text === 'string' ? first.text.trim() : '';
      })
      .filter((chunk) => chunk.length > 0);

    if (!translatedChunks.length) {
      throw new Error('Azure Translator çeviri metni üretilemedi.');
    }

    const sourceLanguage = normalizeLanguageCode(
      payload[0]?.detectedLanguage?.language,
    );

    return {
      translatedText: translatedChunks.join('\n\n').trim(),
      sourceLanguage,
      targetLanguage: 'tr',
      translatedAt: new Date().toISOString(),
      provider: 'azure_translator',
    };
  } finally {
    clear();
  }
}

async function translateWithLibreTranslate(params: {
  chunks: string[];
  sourceLanguage: string | null;
  timeoutMs: number;
}): Promise<TranslateTextResult> {
  if (!translationRuntimeConfig.libreTranslateBaseUrl) {
    throw new Error(
      'LibreTranslate için EXPO_PUBLIC_LIBRETRANSLATE_BASE_URL gerekli.',
    );
  }

  const translatedChunks: string[] = [];
  let sourceLanguage: string | null = null;

  for (const chunk of params.chunks) {
    const { signal, clear } = createTimedAbortSignal(params.timeoutMs);

    try {
      const response = await fetch(
        `${translationRuntimeConfig.libreTranslateBaseUrl}/translate`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            q: chunk,
            source: params.sourceLanguage ?? 'auto',
            target: 'tr',
            format: 'text',
            api_key: translationRuntimeConfig.libreTranslateApiKey ?? undefined,
          }),
          signal,
        },
      );

      const payload = await parseJsonResponse<LibreTranslateResponse>(
        response,
        'LibreTranslate yanıt vermedi.',
      );

      const translatedText =
        typeof payload.translatedText === 'string'
          ? payload.translatedText.trim()
          : '';

      if (!translatedText) {
        throw new Error('LibreTranslate çeviri metni üretilemedi.');
      }

      translatedChunks.push(translatedText);

      if (!sourceLanguage) {
        sourceLanguage = normalizeLanguageCode(
          payload.detectedLanguage?.language,
        );
      }
    } finally {
      clear();
    }
  }

  return {
    translatedText: translatedChunks.join('\n\n').trim(),
    sourceLanguage,
    targetLanguage: 'tr',
    translatedAt: new Date().toISOString(),
    provider: 'libretranslate',
  };
}

async function translateWithGoogleLegacy(params: {
  chunks: string[];
  sourceLanguage: string | null;
  timeoutMs: number;
}): Promise<TranslateTextResult> {
  const translatedChunks: string[] = [];
  let sourceLanguage: string | null = null;

  for (const chunk of params.chunks) {
    const { signal, clear } = createTimedAbortSignal(params.timeoutMs);

    try {
      const url =
        'https://translate.googleapis.com/translate_a/single' +
        `?client=gtx&sl=${encodeURIComponent(params.sourceLanguage ?? 'auto')}` +
        '&tl=tr&dt=t' +
        `&q=${encodeURIComponent(chunk)}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
        signal,
      });

      const payload = await parseJsonResponse<GoogleLegacyTranslateResponse>(
        response,
        'Legacy çeviri servisi yanıt vermedi.',
      );

      const parsed = parseGoogleLegacyResponse(payload);

      translatedChunks.push(parsed.translatedText);

      if (!sourceLanguage && parsed.sourceLanguage) {
        sourceLanguage = parsed.sourceLanguage;
      }
    } finally {
      clear();
    }
  }

  return {
    translatedText: translatedChunks.join('\n\n').trim(),
    sourceLanguage,
    targetLanguage: 'tr',
    translatedAt: new Date().toISOString(),
    provider: 'google_web_legacy',
  };
}

export async function translateTextToTurkish(
  input: TranslateTextInput,
): Promise<TranslateTextResult> {
  const normalized = normalizeText(input.text);

  if (!normalized) {
    throw new Error('Çevrilecek metin bulunamadı.');
  }

  const chunks = buildTextChunks(normalized, 1600);

  if (!chunks.length) {
    throw new Error('Çevrilecek metin bulunamadı.');
  }

  const timeoutMs = Math.max(
    4000,
    Math.trunc(input.timeoutMs ?? translationRuntimeConfig.timeoutMs),
  );
  const targetLanguage: 'tr' = input.targetLanguage ?? 'tr';

  if (targetLanguage !== 'tr') {
    throw new Error('Bu sürüm şu anda yalnızca Türkçe hedef dili destekliyor.');
  }

  const sourceLanguage = normalizeRequestedSourceLanguage(input.sourceLanguage);
  const provider = resolveTranslationRuntimeProvider();

  switch (provider) {
    case 'deepl_api_free':
      return translateWithDeepL({
        chunks,
        sourceLanguage,
        timeoutMs,
      });
    case 'azure_translator':
      return translateWithAzure({
        chunks,
        sourceLanguage,
        timeoutMs,
      });
    case 'libretranslate':
      return translateWithLibreTranslate({
        chunks,
        sourceLanguage,
        timeoutMs,
      });
    case 'google_web_legacy':
      return translateWithGoogleLegacy({
        chunks,
        sourceLanguage,
        timeoutMs,
      });
    case 'none':
    default:
      throw new Error(
        'Çeviri sağlayıcısı yapılandırılmadı. DeepL API Free, Azure Translator veya LibreTranslate bilgilerini env üzerinden tanımla.',
      );
  }
}
