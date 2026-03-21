import type { AssetMetadata, AssetType, StoredAsset } from './asset.service';

export function formatAssetLibraryDate(value: string) {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return 'Tarih yok';
  }

  return parsed.toLocaleString('tr-TR');
}

export function getAssetLibraryHeroCopy(
  type: AssetType,
  nativeCleanupAvailable: boolean,
) {
  if (type === 'stamp') {
    return {
      title: 'Kaşe kitaplığı',
      description:
        'Şeffaf PNG en iyi sonucu verir. Taranmış kaşelerde native cleanup varsa arka plan temizleme de uygulanır.',
      pills: [
        nativeCleanupAvailable
          ? 'Native cleanup hazır'
          : 'Native cleanup beklemede',
        'Yerel-first kaşe kütüphanesi',
      ],
      emptyTitle: 'Henüz kaşe yok',
      emptyText:
        'Taranmış kaşe veya şeffaf PNG içe aktar. Aynı kaşeyi daha sonra tüm belgelerde tekrar kullanabilirsin.',
      primaryActionLabel: 'Yeni kaşe ekle',
      summaryTitle: 'Toplam kaşe',
      selectionTitle: 'Seçili kaşe',
      namePlaceholder: 'Kaşe adı',
      note:
        'Bu kaşe editörde sürükle-bırak ile istenen koordinata yerleştirilir ve sonraki belgelerde tekrar kullanılabilir.',
      deleteLabel: 'Sil',
    };
  }

  return {
    title: 'İmza kitaplığı',
    description:
      'İmza ekranında kaydettiğin imzalar burada küçük resim olarak görünür. Belge editöründe doğrudan kullanılabilir.',
    pills: ['Yerel imza thumbnail kütüphanesi', 'PDF editörde sürükle-bırak'],
    emptyTitle: 'Henüz imza yok',
    emptyText:
      'Bir belge editöründen Yeni imza ekle akışını aç ve kaydet. Kaydedilen imza burada küçük resim olarak görünecek.',
    primaryActionLabel: null,
    summaryTitle: 'Toplam imza',
    selectionTitle: 'Seçili imza',
    namePlaceholder: 'İmza adı',
    note:
      'Bu imza, imza ekranında çizilip küçük resim olarak kaydedildi. Belge editöründe seçili imzayı tutup istediğin yere sürükleyebilir ve boyutlandırabilirsin.',
    deleteLabel: 'İmzayı sil',
  };
}

export type AssetLibrarySelectionPillsInput = {
  type: AssetType;
  metadata: AssetMetadata;
  usageCount: number;
  restorable: boolean;
  backgroundRemoved: boolean;
  cleanupModeLabel: string;
  cleanupProviderLabel: string;
};

export function getAssetLibrarySelectionPills(
  input: AssetLibrarySelectionPillsInput,
) {
  if (input.type === 'stamp') {
    return [
      input.usageCount > 0
        ? `${input.usageCount} yerleşimde kullanılıyor`
        : 'Henüz yerleşimde kullanılmadı',
      input.restorable ? 'Orijinale geri dönebilir' : 'Orijinal aktif',
      input.backgroundRemoved
        ? 'Arka plan temizlenmiş'
        : 'Arka plan temizlenmedi',
      input.cleanupModeLabel,
      `Kaynak: ${input.cleanupProviderLabel}`,
    ];
  }

  const pills = ['İmza thumbnail kayıtlı'];

  if (typeof input.metadata.strokeColor === 'string') {
    pills.push(`Renk: ${input.metadata.strokeColor}`);
  }

  if (typeof input.metadata.strokeCount === 'number') {
    pills.push(`${input.metadata.strokeCount} stroke`);
  }

  if (typeof input.metadata.strokeWidth === 'number') {
    pills.push(`Kalınlık: ${input.metadata.strokeWidth}`);
  }

  return pills;
}

export type AssetLibraryComparisonPreview = {
  beforeUri: string;
  afterUri: string;
  beforeLabel: string;
  afterLabel: string;
  helperText: string;
};

export function getAssetLibraryComparisonPreview(input: {
  type: AssetType;
  asset: Pick<StoredAsset, 'file_path' | 'original_file_path'> | null;
  metadata: AssetMetadata;
}) {
  if (input.type !== 'stamp' || !input.asset) {
    return null;
  }

  const beforeUri = input.asset.original_file_path?.trim();
  const afterUri = input.asset.file_path?.trim();

  if (!beforeUri || !afterUri || beforeUri === afterUri) {
    return null;
  }

  const backgroundRemoved = input.metadata.backgroundRemoved === true;
  const cleanupMode =
    typeof input.metadata.cleanupMode === 'string'
      ? input.metadata.cleanupMode
      : null;

  let helperText = 'Orijinal kaynak ile güncel aktif kaşe çıktısı yan yana gösterilir.';

  if (backgroundRemoved || cleanupMode === 'native-background-removed') {
    helperText =
      'Arka plan temizleme sonucu aktif kaşeye uygulandı. Solda orijinal kaynak, sağda belgeye girecek güncel sürüm var.';
  } else if (cleanupMode === 'optimized') {
    helperText =
      'Kaşe optimize edildi. Solda orijinal kaynak, sağda sıkılaştırılmış ve çıktı için hazırlanan aktif sürüm var.';
  }

  return {
    beforeUri,
    afterUri,
    beforeLabel: 'Önce',
    afterLabel: 'Sonra',
    helperText,
  } satisfies AssetLibraryComparisonPreview;
}

export type AssetLibraryOperationFeedbackTone =
  | 'success'
  | 'warning'
  | 'neutral';

export type AssetLibraryOperationFeedback = {
  title: string;
  message: string;
  tone: AssetLibraryOperationFeedbackTone;
};

export function getAssetLibraryOperationFeedback(input: {
  type: AssetType;
  operation:
    | 'import'
    | 'rename'
    | 'optimize'
    | 'cleanup'
    | 'replace'
    | 'restore'
    | 'delete';
  metadata?: AssetMetadata;
  nativeCleanupAvailable?: boolean;
}) {
  if (input.type === 'signature') {
    switch (input.operation) {
      case 'rename':
        return {
          title: 'İmza güncellendi',
          message: 'İmza adı kaydedildi.',
          tone: 'success',
        } satisfies AssetLibraryOperationFeedback;
      case 'delete':
        return {
          title: 'İmza silindi',
          message: 'Seçili imza kütüphaneden kaldırıldı.',
          tone: 'neutral',
        } satisfies AssetLibraryOperationFeedback;
      default:
        return null;
    }
  }

  const metadata = input.metadata ?? {};

  switch (input.operation) {
    case 'import':
      return {
        title: 'Kaşe eklendi',
        message:
          typeof metadata.cleanupWarning === 'string' &&
          metadata.cleanupWarning.trim().length > 0
            ? metadata.cleanupWarning
            : 'Yeni kaşe işlendi ve kütüphaneye eklendi.',
        tone:
          typeof metadata.cleanupWarning === 'string' &&
          metadata.cleanupWarning.trim().length > 0
            ? 'warning'
            : 'success',
      } satisfies AssetLibraryOperationFeedback;
    case 'rename':
      return {
        title: 'Ad güncellendi',
        message: 'Seçili kaşenin adı kaydedildi.',
        tone: 'success',
      } satisfies AssetLibraryOperationFeedback;
    case 'optimize':
      return {
        title: 'Kaşe optimize edildi',
        message:
          'Aktif kaşe çıktısı yeniden hazırlandı. Sağdaki güncel sürüm editörde kullanılacak.',
        tone: 'success',
      } satisfies AssetLibraryOperationFeedback;
    case 'cleanup':
      if (metadata.backgroundRemoved === true) {
        return {
          title: 'Arka plan temizlendi',
          message:
            'Temizlenmiş sürüm aktif hale geldi. Önce/sonra önizlemesinden farkı kontrol edebilirsin.',
          tone: 'success',
        } satisfies AssetLibraryOperationFeedback;
      }

      if (
        typeof metadata.cleanupWarning === 'string' &&
        metadata.cleanupWarning.trim().length > 0
      ) {
        return {
          title: 'Temizleme sınırlı kaldı',
          message: metadata.cleanupWarning,
          tone: 'warning',
        } satisfies AssetLibraryOperationFeedback;
      }

      if (!input.nativeCleanupAvailable) {
        return {
          title: 'Native cleanup hazır değil',
          message:
            'Bu build içinde native cleanup modülü görünmüyor. Kaşe optimize edilmiş sürümle korunur.',
          tone: 'warning',
        } satisfies AssetLibraryOperationFeedback;
      }

      return {
        title: 'Temizleme uygulanmadı',
        message:
          'Bu kaşede anlamlı bir arka plan ayrıştırması üretilmedi. Önizlemeden güncel sürümü kontrol et.',
        tone: 'warning',
      } satisfies AssetLibraryOperationFeedback;
    case 'replace':
      return {
        title: 'Kaşe değiştirildi',
        message:
          typeof metadata.cleanupWarning === 'string' &&
          metadata.cleanupWarning.trim().length > 0
            ? metadata.cleanupWarning
            : 'Seçili kaşenin kaynağı yenilendi ve aktif sürüm yeniden üretildi.',
        tone:
          typeof metadata.cleanupWarning === 'string' &&
          metadata.cleanupWarning.trim().length > 0
            ? 'warning'
            : 'success',
      } satisfies AssetLibraryOperationFeedback;
    case 'restore':
      return {
        title: 'Orijinal geri yüklendi',
        message:
          'Kaşe tekrar kaynak görsele döndü. Sağdaki aktif sürüm artık orijinal içerikle aynı.',
        tone: 'neutral',
      } satisfies AssetLibraryOperationFeedback;
    case 'delete':
      return {
        title: 'Kaşe silindi',
        message: 'Seçili kaşe kütüphaneden kaldırıldı.',
        tone: 'neutral',
      } satisfies AssetLibraryOperationFeedback;
    default:
      return null;
  }
}
