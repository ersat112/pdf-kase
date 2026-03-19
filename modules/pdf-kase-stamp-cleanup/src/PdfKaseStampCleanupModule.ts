import { NativeModule, requireNativeModule } from 'expo';

import { PdfKaseStampCleanupModuleEvents } from './PdfKaseStampCleanup.types';

declare class PdfKaseStampCleanupModule extends NativeModule<PdfKaseStampCleanupModuleEvents> {
  PI: number;
  hello(): string;
  setValueAsync(value: string): Promise<void>;
}

// This call loads the native module object from the JSI.
export default requireNativeModule<PdfKaseStampCleanupModule>('PdfKaseStampCleanup');
