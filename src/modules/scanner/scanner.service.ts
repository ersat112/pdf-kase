// src/modules/scanner/scanner.service.ts
import { Platform } from 'react-native';
import DocumentScanner from 'react-native-document-scanner-plugin';

export type ScannerLaunchStatus = 'success' | 'cancel';

export type ScannedPage = {
  originalPath: string;
  normalizedUri: string;
};

export type LaunchScannerResult = {
  status: ScannerLaunchStatus;
  pages: ScannedPage[];
};

type RawScannerResult = {
  status?: string;
  scannedImages?: unknown;
  scannedImage?: unknown;
  imagePath?: unknown;
  croppedImage?: unknown;
  croppedImages?: unknown;
};

function normalizeFileUri(path: string) {
  const trimmedPath = path.trim();

  if (!trimmedPath) {
    return trimmedPath;
  }

  if (
    trimmedPath.startsWith('file://') ||
    trimmedPath.startsWith('content://')
  ) {
    return trimmedPath;
  }

  if (trimmedPath.startsWith('/')) {
    return `file://${trimmedPath}`;
  }

  return trimmedPath;
}

function pushStringCandidate(target: string[], value: unknown) {
  if (typeof value === 'string' && value.trim().length > 0) {
    target.push(value.trim());
  }
}

function pushStringArrayCandidates(target: string[], value: unknown) {
  if (!Array.isArray(value)) {
    return;
  }

  value.forEach((item) => {
    if (typeof item === 'string' && item.trim().length > 0) {
      target.push(item.trim());
    }
  });
}

function extractScannedPaths(result: RawScannerResult | null | undefined) {
  const candidates: string[] = [];

  pushStringArrayCandidates(candidates, result?.scannedImages);
  pushStringArrayCandidates(candidates, result?.croppedImages);
  pushStringCandidate(candidates, result?.scannedImage);
  pushStringCandidate(candidates, result?.croppedImage);
  pushStringCandidate(candidates, result?.imagePath);

  return Array.from(new Set(candidates));
}

function normalizeScannerStatus(status: unknown, pageCount: number): ScannerLaunchStatus {
  if (typeof status === 'string') {
    const normalized = status.trim().toLowerCase();

    if (normalized === 'cancel' || normalized === 'cancelled') {
      return 'cancel';
    }

    if (normalized === 'success') {
      return 'success';
    }
  }

  return pageCount > 0 ? 'success' : 'cancel';
}

export async function launchNativeScanner(): Promise<LaunchScannerResult> {
  if (Platform.OS === 'web') {
    throw new Error('Belge tarama web platformunda desteklenmiyor.');
  }

  try {
    const result = (await DocumentScanner.scanDocument()) as RawScannerResult;
    const scannedPaths = extractScannedPaths(result);
    const status = normalizeScannerStatus(result?.status, scannedPaths.length);

    if (status === 'cancel' || scannedPaths.length === 0) {
      return {
        status: 'cancel',
        pages: [],
      };
    }

    return {
      status: 'success',
      pages: scannedPaths.map((path) => ({
        originalPath: path,
        normalizedUri: normalizeFileUri(path),
      })),
    };
  } catch (error) {
    const message =
      error instanceof Error && error.message.trim().length > 0
        ? error.message
        : 'Belge tarama başlatılamadı.';

    throw new Error(message);
  }
}