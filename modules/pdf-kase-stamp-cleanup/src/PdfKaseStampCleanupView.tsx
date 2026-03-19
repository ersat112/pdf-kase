import { requireNativeView } from 'expo';
import * as React from 'react';

import { PdfKaseStampCleanupViewProps } from './PdfKaseStampCleanup.types';

const NativeView: React.ComponentType<PdfKaseStampCleanupViewProps> =
  requireNativeView('PdfKaseStampCleanup');

export default function PdfKaseStampCleanupView(props: PdfKaseStampCleanupViewProps) {
  return <NativeView {...props} />;
}
