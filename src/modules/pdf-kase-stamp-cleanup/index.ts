import { requireNativeModule } from 'expo-modules-core';

export type NativeStampCleanupResult = {
  cleanedUri: string;
  backgroundRemoved: boolean;
  provider: string | null;
};

type PdfKaseStampCleanupModule = {
  removeBackground(
    sourceUri: string,
    options?: {
      outputFormat?: 'png';
    },
  ): Promise<NativeStampCleanupResult>;
};

export default requireNativeModule<PdfKaseStampCleanupModule>(
  'PdfKaseStampCleanup',
);