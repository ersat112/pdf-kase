import type { AssetMetadata, AssetType } from './asset.service';

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
