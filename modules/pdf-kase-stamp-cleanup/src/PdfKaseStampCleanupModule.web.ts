import { registerWebModule, NativeModule } from 'expo';

import { ChangeEventPayload } from './PdfKaseStampCleanup.types';

type PdfKaseStampCleanupModuleEvents = {
  onChange: (params: ChangeEventPayload) => void;
}

class PdfKaseStampCleanupModule extends NativeModule<PdfKaseStampCleanupModuleEvents> {
  PI = Math.PI;
  async setValueAsync(value: string): Promise<void> {
    this.emit('onChange', { value });
  }
  hello() {
    return 'Hello world! 👋';
  }
};

export default registerWebModule(PdfKaseStampCleanupModule, 'PdfKaseStampCleanupModule');
