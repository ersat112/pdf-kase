import type { ToolDefinition, ToolSectionDefinition } from './tools.types';

const tools: ToolDefinition[] = [
  {
    key: 'scan-camera',
    section: 'scan',
    title: 'Tara',
    shortDescription: 'Kamera ile belge tara ve aynı belgede birleştir.',
    longDescription:
      'Belge tarama akışı native scanner ile başlar.\n' +
      'Taranan sayfalar önce taslak belgeye kaydedilir, sonra düzenleme, kaşe, PDF üretimi ve paylaşım adımlarına aktarılır.',
    availability: 'ready',
    badges: ['Hazır', 'Kamera', 'Belge'],
    primaryActionLabel: 'Taramayı başlat',
    routeTarget: 'ScanEntry',
    scanEntryMode: 'camera',
    homeVisible: true,
    scanLauncherVisible: true,
  },
  {
    key: 'import-images',
    section: 'import',
    title: 'Galeriden Al',
    shortDescription: 'Galeriden çoklu görsel seçip belgeye dönüştür.',
    longDescription:
      'Galeriden seçilen tekli veya çoklu görseller sayfa sırasıyla yerel belge taslağına dönüştürülür.',
    availability: 'ready',
    badges: ['Hazır', 'Galeri', 'Çoklu Seçim'],
    primaryActionLabel: 'Görsel seç',
    routeTarget: 'ScanEntry',
    scanEntryMode: 'import-images',
    homeVisible: true,
    scanLauncherVisible: true,
  },
  {
    key: 'import-files',
    section: 'import',
    title: 'PDF İçe Aktar',
    shortDescription: 'PDF veya görsel dosyalarını belge havuzuna al.',
    longDescription:
      'Document picker ile seçilen PDF ve görseller yerel belge havuzuna alınır.\n' +
      'Görseller yeni sayfa taslağına, PDF dosyaları ise hazır belge kaydına dönüştürülür.',
    availability: 'ready',
    badges: ['Hazır', 'PDF', 'Dosya', 'İçe Aktar'],
    primaryActionLabel: 'Dosya seç',
    routeTarget: 'ScanEntry',
    scanEntryMode: 'import-files',
    homeVisible: true,
    scanLauncherVisible: true,
  },
  {
    key: 'convert-word',
    section: 'convert',
    title: 'Word’e',
    shortDescription: 'Belge detayından DOCX çıktısı üretme akışı.',
    longDescription:
      'Word çıktısı belge detay ekranında oluşturulur.\n' +
      'Sayfa görsellerinden OCR metni çıkarılır, ardından yerel DOCX dosyası hazırlanır ve paylaşılabilir.',
    availability: 'ready',
    badges: ['Hazır', 'Word', 'OCR'],
    primaryActionLabel: 'Belgelerimi aç',
    routeTarget: 'Documents',
    homeVisible: true,
    scanLauncherVisible: true,
  },
  {
    key: 'scan-question-set',
    section: 'scan',
    title: 'Soru Kümesi',
    shortDescription: 'Soru kağıdı ve test seti odaklı tarama modu.',
    longDescription:
      'Soru kümesi modu; çoklu soru alanları, seri sayfa akışı ve ileride OCR/cevap ayrıştırma hattı için ayrıldı.',
    availability: 'planned',
    badges: ['Akademik', 'Test', 'Tarama'],
    primaryActionLabel: 'İçeriği görüntüle',
  },
  {
    key: 'scan-translate',
    section: 'scan',
    title: 'Çevir',
    shortDescription: 'OCR metnini Türkçeye çevirme akışı.',
    longDescription:
      'Çeviri akışı belge detay ekranında OCR sonrası çalışır.\n' +
      'Public release yerine sonraki iterasyonda resmi bir servis hattı ile tekrar açılacaktır.',
    availability: 'shell',
    badges: ['Beta', 'Çeviri', 'OCR'],
    primaryActionLabel: 'İçeriği görüntüle',
    routeTarget: 'Documents',
  },
  {
    key: 'scan-book',
    section: 'scan',
    title: 'Kitap',
    shortDescription: 'Çift sayfa ve eğrilik odaklı kitap tarama modu.',
    longDescription:
      'Kitap modu, orta kat izi azaltma ve sayfa eğriliği düzeltme gibi kitap odaklı pipeline için ayrıldı.',
    availability: 'planned',
    badges: ['Kitap', 'Sayfa', 'Seri Tarama'],
    primaryActionLabel: 'İçeriği görüntüle',
  },
  {
    key: 'edit-enhance-photo',
    section: 'edit',
    title: 'Fotoğrafı İyileştir',
    shortDescription: 'Tarama/görsel iyileştirme akışını başlatır.',
    longDescription:
      'Bu mod, belge ya da fotoğraf girişini başlatır.\n' +
      'Amaç; gelecekte auto-crop, perspective correction ve deskew hattına aynı girişten ulaşmaktır.',
    availability: 'ready',
    badges: ['Hazır', 'İyileştirme', 'Tarama'],
    primaryActionLabel: 'Akışı aç',
    routeTarget: 'ScanEntry',
    scanEntryMode: 'enhance-photo',
    scanLauncherVisible: true,
  },
  {
    key: 'edit-smart-erase',
    section: 'edit',
    title: 'Akıllı Silme',
    shortDescription: 'Kalem izi, not ve istenmeyen işaretleri temizleme akışı.',
    longDescription:
      'Akıllı silme sayfa bazında ayrı ekranda çalışır.\n' +
      'Kullanıcı silmek istediği alanı işaretler, sonuç lokal olarak yeni sayfa görseline uygulanır ve belge çıktıları geçersizlenir.',
    availability: 'ready',
    badges: ['Hazır', 'Silme', 'Sayfa'],
    primaryActionLabel: 'Belgelerimi aç',
    routeTarget: 'Documents',
    homeVisible: true,
    scanLauncherVisible: true,
  },
  {
    key: 'scan-count-cam',
    section: 'scan',
    title: 'CountCam',
    shortDescription: 'Sayım ve görsel sayısallaştırma odaklı kamera modu.',
    longDescription:
      'CountCam, nesne veya evrak sayımı gibi kamera odaklı sayısal akışlar için ayrıldı.\n' +
      'Şu an sadece ürün konumu tanımlı.',
    availability: 'planned',
    badges: ['Kamera', 'Sayım', 'Araç'],
    primaryActionLabel: 'İçeriği görüntüle',
  },
  {
    key: 'utility-qr',
    section: 'utilities',
    title: 'QR Kodu',
    shortDescription: 'Canlı kameradan QR kod okut.',
    longDescription:
      'QR modu canlı kamera preview üzerinden sadece QR barkodlarını dinler.\n' +
      'Okutulan içerik uygulama içinde gösterilir ve URL ise doğrudan açılabilir.',
    availability: 'ready',
    badges: ['Hazır', 'QR', 'Kamera'],
    primaryActionLabel: 'QR tarayıcıyı aç',
    routeTarget: 'ScanEntry',
    scanEntryMode: 'qr',
    homeVisible: true,
    scanLauncherVisible: true,
  },
  {
    key: 'edit-sign',
    section: 'edit',
    title: 'İmzala',
    shortDescription: 'Ayrı imza ekranı ile imza oluşturup belgeye ekleme.',
    longDescription:
      'İmza akışı ayrı signature pad ekranında çalışır.\n' +
      'Kaydedilen imza cihazda lokal olarak tutulur ve PDF editörde kaşe mantığıyla belge üstüne yerleştirilip taşınabilir.',
    availability: 'ready',
    badges: ['Hazır', 'İmza', 'Overlay'],
    primaryActionLabel: 'Belgelerimi aç',
    routeTarget: 'Documents',
    homeVisible: true,
    scanLauncherVisible: true,
  },
  {
    key: 'scan-id-card',
    section: 'scan',
    title: 'Kimlik Kartları',
    shortDescription: 'Kimlik ön/arka yüz tarama akışı.',
    longDescription:
      'Kimlik kartı modu scanner girişini kullanır.\n' +
      'Sonraki iterasyonda ön/arka yüz ayrımı, otomatik kenar sabitleme ve tek dosyada birleştirme zenginleştirilecek.',
    availability: 'ready',
    badges: ['Hazır', 'Kimlik', 'Belge'],
    primaryActionLabel: 'Kimlik taramayı başlat',
    routeTarget: 'ScanEntry',
    scanEntryMode: 'id-card',
    scanLauncherVisible: true,
  },
  {
    key: 'scan-ocr-text',
    section: 'scan',
    title: 'Metni Çıkar',
    shortDescription: 'Belge detayından gerçek OCR metni çıkarma akışı.',
    longDescription:
      'OCR işlemi belge detay ekranında çalıştırılır.\n' +
      'Sayfa görselleri cihaz üstünde işlenir, metin belgeye kaydedilir ve Word çıktısında tekrar kullanılır.',
    availability: 'ready',
    badges: ['Hazır', 'OCR', 'Metin'],
    primaryActionLabel: 'Belgelerimi aç',
    routeTarget: 'Documents',
    homeVisible: true,
    scanLauncherVisible: true,
  },
  {
    key: 'convert-excel',
    section: 'convert',
    title: 'Excel’e',
    shortDescription: 'Belge detayından Excel uyumlu çıktı üretme.',
    longDescription:
      'Excel çıktısı belge detay ekranında OCR metni üzerinden hazırlanır.\n' +
      'Belge özeti ve OCR içeriği Excel uyumlu dosya olarak dışa aktarılır.',
    availability: 'ready',
    badges: ['Hazır', 'Excel', 'OCR'],
    primaryActionLabel: 'Belgelerimi aç',
    routeTarget: 'Documents',
    homeVisible: true,
    scanLauncherVisible: true,
  },
  {
    key: 'scan-timestamp',
    section: 'scan',
    title: 'Zaman Damgası',
    shortDescription: 'Belgeye tarih/saat damgası ekleme akışı.',
    longDescription:
      'Zaman damgası modu overlay altyapısı üzerine kurulacak.\n' +
      'Belge üstüne tarih-saat ve opsiyonel ek bilgiler basılacak.',
    availability: 'shell',
    badges: ['Damga', 'Overlay', 'Belge'],
    primaryActionLabel: 'İçeriği görüntüle',
  },
  {
    key: 'scan-id-photo',
    section: 'scan',
    title: 'Kimlik Fotoğraf Yapıcı',
    shortDescription: 'Biyometrik/vesikalık fotoğraf hizalama akışı.',
    longDescription:
      'Kimlik fotoğraf yapıcı; oran, boşluk, hizalama ve arka plan doğrulaması için ayrıldı.',
    availability: 'planned',
    badges: ['Fotoğraf', 'Kimlik', 'Düzenleme'],
    primaryActionLabel: 'İçeriği görüntüle',
  },
  {
    key: 'scan-slides',
    section: 'scan',
    title: 'Slaytlar',
    shortDescription: 'Sunum ve projeksiyon odaklı tarama modu.',
    longDescription:
      'Slaytlar modu projeksiyon veya ekran fotoğraflarını belge formuna getirmek için ayrıldı.',
    availability: 'planned',
    badges: ['Sunum', 'Slayt', 'Tarama'],
    primaryActionLabel: 'İçeriği görüntüle',
  },
  {
    key: 'edit-stamp',
    section: 'edit',
    title: 'Kaşe / İmza',
    shortDescription: 'Kaşe kütüphanesi ve yerleştirme akışını açar.',
    longDescription:
      'Mevcut kaşe yönetimi ekranına gider.\n' +
      'Kaşe asset ekleme, optimize etme ve editörde kullanma akışıyla bağlıdır.',
    availability: 'ready',
    badges: ['Hazır', 'Kaşe', 'Overlay'],
    primaryActionLabel: 'Kaşe yönetimini aç',
    routeTarget: 'StampManager',
    homeVisible: true,
  },
  {
    key: 'utility-tools-hub',
    section: 'utilities',
    title: 'Tüm Araçlar',
    shortDescription: 'Tüm aktif araçları tek merkezden aç.',
    longDescription:
      'Araç merkezi, ürün içinde gerçekten aktif olan araçları tek registry üzerinden sunar.',
    availability: 'ready',
    badges: ['Araçlar', 'Merkez', 'Katalog'],
    primaryActionLabel: 'Araç merkezini aç',
    routeTarget: 'ToolsTab',
    homeVisible: true,
  },
];

function isPublicTool(item: ToolDefinition) {
  return item.availability === 'ready' && item.key !== 'utility-tools-hub';
}

const publicTools = tools.filter(isPublicTool);

export const homeQuickActionKeys = [
  'scan-camera',
  'import-files',
  'import-images',
  'edit-stamp',
] as const;

export const homePrimaryActionKeys = [
  'scan-camera',
  'import-files',
  'import-images',
  'edit-stamp',
] as const;

export const homeSecondaryToolKeys = [
  'scan-ocr-text',
  'convert-word',
  'convert-excel',
  'edit-smart-erase',
  'utility-qr',
  'utility-tools-hub',
] as const;

export const scanLauncherKeys = [
  'scan-camera',
  'import-images',
  'import-files',
  'edit-enhance-photo',
  'edit-smart-erase',
  'utility-qr',
  'edit-sign',
  'scan-id-card',
  'scan-ocr-text',
  'convert-word',
  'convert-excel',
] as const;

export function findToolByKey(key: string) {
  return tools.find((item) => item.key === key);
}

export const toolSections: ToolSectionDefinition[] = [
  {
    key: 'scan',
    title: 'Tara',
    description: 'Belge ve kimlik için aktif tarama akışları.',
    items: publicTools.filter((item) => item.section === 'scan'),
  },
  {
    key: 'import',
    title: 'Getir',
    description: 'Galeriden veya dosya sisteminden içerik alma.',
    items: publicTools.filter((item) => item.section === 'import'),
  },
  {
    key: 'convert',
    title: 'Dönüştür',
    description: 'Belgeyi farklı çıktı formatlarına çevir.',
    items: publicTools.filter((item) => item.section === 'convert'),
  },
  {
    key: 'edit',
    title: 'Düzenle',
    description: 'Belge ve görsel üstünde değişiklik yap.',
    items: publicTools.filter((item) => item.section === 'edit'),
  },
  {
    key: 'utilities',
    title: 'Yardımcı programlar',
    description: 'Ek üretkenlik ve tarama yardımcıları.',
    items: publicTools.filter((item) => item.section === 'utilities'),
  },
];