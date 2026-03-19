import * as ImagePicker from 'expo-image-picker';

export type PickedImageAsset = {
  assetId: string | null;
  fileName: string | null;
  fileSize: number | null;
  height: number | null;
  mimeType: string | null;
  uri: string;
  width: number | null;
};

export type PickImagesResult = {
  status: 'success' | 'cancel';
  assets: PickedImageAsset[];
};

export type PickImagesOptions = {
  allowsMultipleSelection?: boolean;
  selectionLimit?: number;
};

function normalizeUri(uri: string) {
  const trimmed = uri.trim();

  if (!trimmed) {
    return trimmed;
  }

  if (
    trimmed.startsWith('file://') ||
    trimmed.startsWith('content://') ||
    trimmed.startsWith('data:')
  ) {
    return trimmed;
  }

  if (trimmed.startsWith('/')) {
    return `file://${trimmed}`;
  }

  return trimmed;
}

function isImageAsset(asset: ImagePicker.ImagePickerAsset) {
  if (asset.type === 'image') {
    return true;
  }

  if (typeof asset.mimeType === 'string' && asset.mimeType.startsWith('image/')) {
    return true;
  }

  return /\.(png|jpe?g|webp|heic|heif)$/i.test(asset.uri);
}

async function ensureMediaLibraryPermission() {
  const current = await ImagePicker.getMediaLibraryPermissionsAsync();

  if (current.granted) {
    return;
  }

  const requested = await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!requested.granted) {
    throw new Error('Galeri erişim izni verilmedi.');
  }
}

function mapPickedAssets(
  assets: ImagePicker.ImagePickerAsset[] | undefined,
): PickedImageAsset[] {
  if (!Array.isArray(assets)) {
    return [];
  }

  return assets
    .filter(isImageAsset)
    .map((asset) => ({
      assetId: asset.assetId ?? null,
      fileName: asset.fileName ?? null,
      fileSize: typeof asset.fileSize === 'number' ? asset.fileSize : null,
      height: typeof asset.height === 'number' ? asset.height : null,
      mimeType: asset.mimeType ?? null,
      uri: normalizeUri(asset.uri),
      width: typeof asset.width === 'number' ? asset.width : null,
    }))
    .filter((asset) => asset.uri.length > 0);
}

export async function pickImagesFromLibrary(
  options: PickImagesOptions = {},
): Promise<PickImagesResult> {
  await ensureMediaLibraryPermission();

  const allowsMultipleSelection = options.allowsMultipleSelection ?? true;
  const selectionLimit = Math.max(
    1,
    Math.min(20, Math.trunc(options.selectionLimit ?? 10)),
  );

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: false,
    allowsMultipleSelection,
    orderedSelection: allowsMultipleSelection,
    quality: 1,
    selectionLimit,
  });

  if (result.canceled) {
    return {
      status: 'cancel',
      assets: [],
    };
  }

  const assets = mapPickedAssets(result.assets);

  if (!assets.length) {
    return {
      status: 'cancel',
      assets: [],
    };
  }

  return {
    status: 'success',
    assets,
  };
}