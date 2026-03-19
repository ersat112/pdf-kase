import * as React from 'react';

import { PdfKaseStampCleanupViewProps } from './PdfKaseStampCleanup.types';

export default function PdfKaseStampCleanupView(props: PdfKaseStampCleanupViewProps) {
  return (
    <div>
      <iframe
        style={{ flex: 1 }}
        src={props.url}
        onLoad={() => props.onLoad({ nativeEvent: { url: props.url } })}
      />
    </div>
  );
}
