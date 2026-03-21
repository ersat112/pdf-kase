export type TranslationRuntimeProvider =
  | 'auto'
  | 'deepl_api_free'
  | 'azure_translator'
  | 'libretranslate'
  | 'google_web_legacy'
  | 'none';

type TranslationRuntimeConfig = {
  provider: TranslationRuntimeProvider;
  timeoutMs: number;
  deepLApiKey: string | null;
  deepLBaseUrl: string;
  azureTranslatorKey: string | null;
  azureTranslatorRegion: string | null;
  azureTranslatorEndpoint: string;
  libreTranslateBaseUrl: string | null;
  libreTranslateApiKey: string | null;
};

function normalizeEnumValue<TValue extends string>(
  value: string | undefined,
  allowed: readonly TValue[],
  fallback: TValue,
): TValue {
  if (!value) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase() as TValue;
  return allowed.includes(normalized) ? normalized : fallback;
}

function normalizePositiveInteger(value: string | undefined, fallback: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeOptionalString(value: string | undefined) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeBaseUrl(value: string | undefined, fallback: string | null = null) {
  const normalized = normalizeOptionalString(value);

  if (!normalized) {
    return fallback;
  }

  return normalized.replace(/\/+$/, '');
}

export const translationRuntimeConfig = Object.freeze<TranslationRuntimeConfig>({
  provider: normalizeEnumValue<TranslationRuntimeProvider>(
    process.env.EXPO_PUBLIC_TRANSLATION_PROVIDER,
    [
      'auto',
      'deepl_api_free',
      'azure_translator',
      'libretranslate',
      'google_web_legacy',
      'none',
    ] as const,
    'auto',
  ),
  timeoutMs: normalizePositiveInteger(
    process.env.EXPO_PUBLIC_TRANSLATION_TIMEOUT_MS,
    15000,
  ),
  deepLApiKey: normalizeOptionalString(process.env.EXPO_PUBLIC_DEEPL_API_KEY),
  deepLBaseUrl:
    normalizeBaseUrl(
      process.env.EXPO_PUBLIC_DEEPL_API_BASE_URL,
      'https://api-free.deepl.com',
    ) ?? 'https://api-free.deepl.com',
  azureTranslatorKey: normalizeOptionalString(
    process.env.EXPO_PUBLIC_AZURE_TRANSLATOR_KEY,
  ),
  azureTranslatorRegion: normalizeOptionalString(
    process.env.EXPO_PUBLIC_AZURE_TRANSLATOR_REGION,
  ),
  azureTranslatorEndpoint:
    normalizeBaseUrl(
      process.env.EXPO_PUBLIC_AZURE_TRANSLATOR_ENDPOINT,
      'https://api.cognitive.microsofttranslator.com',
    ) ?? 'https://api.cognitive.microsofttranslator.com',
  libreTranslateBaseUrl: normalizeBaseUrl(
    process.env.EXPO_PUBLIC_LIBRETRANSLATE_BASE_URL,
  ),
  libreTranslateApiKey: normalizeOptionalString(
    process.env.EXPO_PUBLIC_LIBRETRANSLATE_API_KEY,
  ),
});

export function hasDeepLTranslationConfig() {
  return Boolean(translationRuntimeConfig.deepLApiKey);
}

export function hasAzureTranslationConfig() {
  return Boolean(translationRuntimeConfig.azureTranslatorKey);
}

export function hasLibreTranslateConfig() {
  return Boolean(translationRuntimeConfig.libreTranslateBaseUrl);
}

export function resolveTranslationRuntimeProvider(): Exclude<
  TranslationRuntimeProvider,
  'auto'
> {
  switch (translationRuntimeConfig.provider) {
    case 'deepl_api_free':
    case 'azure_translator':
    case 'libretranslate':
    case 'google_web_legacy':
    case 'none':
      return translationRuntimeConfig.provider;
    case 'auto':
    default:
      if (hasDeepLTranslationConfig()) {
        return 'deepl_api_free';
      }

      if (hasAzureTranslationConfig()) {
        return 'azure_translator';
      }

      if (hasLibreTranslateConfig()) {
        return 'libretranslate';
      }

      return 'none';
  }
}

export function getTranslationRuntimeDisplayLabel(
  provider = resolveTranslationRuntimeProvider(),
) {
  switch (provider) {
    case 'deepl_api_free':
      return 'DeepL API Free';
    case 'azure_translator':
      return 'Azure Translator';
    case 'libretranslate':
      return 'LibreTranslate';
    case 'google_web_legacy':
      return 'Google web legacy';
    case 'none':
    default:
      return 'Çeviri yapılandırılmadı';
  }
}

export function getTranslationRuntimeStatusLabel() {
  const provider = resolveTranslationRuntimeProvider();

  switch (provider) {
    case 'deepl_api_free':
      return hasDeepLTranslationConfig()
        ? 'DeepL API Free hazır'
        : 'DeepL API Free için API anahtarı gerekli';
    case 'azure_translator':
      return hasAzureTranslationConfig()
        ? 'Azure Translator hazır'
        : 'Azure Translator için anahtar gerekli';
    case 'libretranslate':
      return hasLibreTranslateConfig()
        ? 'LibreTranslate hazır'
        : 'LibreTranslate için base URL gerekli';
    case 'google_web_legacy':
      return 'Legacy çeviri modu açık';
    case 'none':
    default:
      return 'Resmi çeviri sağlayıcısı yapılandırılmadı';
  }
}
