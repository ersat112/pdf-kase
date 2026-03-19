import { Platform } from 'react-native';

export type StampCleanupMode =
  | 'optimized'
  | 'preserved-transparent-png'
  | 'native-background-removed'
  | 'native-unavailable'
  | 'original';

export type StampCleanupResult = {
  cleanedUri: string;
  backgroundRemoved: boolean;
  cleanupMode: StampCleanupMode;
  cleanupProvider: string | null;
  warning: string | null;
};

type NativeStampCleanupResult = {
  cleanedUri?: string;
  uri?: string;
  backgroundRemoved?: boolean;
  provider?: string | null;
};

type NativeStampCleanupModule = {
  removeBackground: (
    sourceUri: string,
    options?: {
      outputFormat?: 'png';
    },
  ) => Promise<NativeStampCleanupResult>;
};

function isTransparentPng(uri: string) {
  return /\.png(\?.*)?$/i.test(uri);
}

function getNativeStampCleanupModule(): NativeStampCleanupModule | null {
  if (Platform.OS === 'web') {
    return null;
  }

  try {
    const loaded = require('../../../modules/pdf-kase-stamp-cleanup')
      .default as Partial<NativeStampCleanupModule> | undefined;

    if (loaded && typeof loaded.removeBackground === 'function') {
      return loaded as NativeStampCleanupModule;
    }
  } catch {
    return null;
  }

  return null;
}

export function canUseNativeStampCleanup() {
  return getNativeStampCleanupModule() !== null;
}

export async function cleanupStampBackground(
  sourceUri: string,
  options?: {
    failureMode?: 'fallback' | 'throw';
  },
): Promise<StampCleanupResult> {
  const trimmedSourceUri = sourceUri?.trim();

  if (!trimmedSourceUri) {
    throw new Error('Arka plan temizleme için geçerli görsel gerekli.');
  }

  if (isTransparentPng(trimmedSourceUri)) {
    return {
      cleanedUri: trimmedSourceUri,
      backgroundRemoved: true,
      cleanupMode: 'preserved-transparent-png',
      cleanupProvider: 'input-transparent-png',
      warning: null,
    };
  }

  const nativeModule = getNativeStampCleanupModule();

  if (!nativeModule) {
    return {
      cleanedUri: trimmedSourceUri,
      backgroundRemoved: false,
      cleanupMode: 'native-unavailable',
      cleanupProvider: null,
      warning:
        'Native kaşe arka plan temizleme modülü bulunamadı. Şeffaf PNG kullanılırsa en temiz sonuç alınır.',
    };
  }

  try {
    const result = await nativeModule.removeBackground(trimmedSourceUri, {
      outputFormat: 'png',
    });

    const cleanedUri = result.cleanedUri?.trim() || result.uri?.trim();

    if (!cleanedUri) {
      throw new Error('Native cleanup modülü çıktı üretmedi.');
    }

    return {
      cleanedUri,
      backgroundRemoved: result.backgroundRemoved !== false,
      cleanupMode:
        result.backgroundRemoved === false
          ? 'optimized'
          : 'native-background-removed',
      cleanupProvider: result.provider?.trim() || 'native',
      warning: null,
    };
  } catch (error) {
    if (options?.failureMode === 'throw') {
      throw error;
    }

    return {
      cleanedUri: trimmedSourceUri,
      backgroundRemoved: false,
      cleanupMode: 'native-unavailable',
      cleanupProvider: null,
      warning:
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : 'Native kaşe arka plan temizleme işlemi başarısız oldu.',
    };
  }
}