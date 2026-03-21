// src/modules/documents/document-action-copy.ts

export type DocumentCopyTone =
  | 'default'
  | 'success'
  | 'accent'
  | 'muted'
  | 'danger'
  | 'warning';

type ExportPrimaryActionOptions = {
  billingHydrated: boolean;
  canExport: boolean;
  hasFile: boolean;
};

type ExportSurfaceCopy = {
  title: string;
  description: string;
  badgeLabel: string;
  badgeTone: DocumentCopyTone;
  actionLabel: string | null;
};

type ShareSummaryCopy = {
  title: string;
  text: string;
  tone: DocumentCopyTone;
  badgeLabel: string;
};

type NextStepCopy = {
  title: string;
  text: string;
  tone: DocumentCopyTone;
};

type PrimaryActionCopy = {
  label: string;
  caption: string;
};

export const documentActionLabels = {
  edit: 'Düzenle',
  ocr: 'OCR',
  pdf: 'PDF üret',
  word: 'Word',
  excel: 'Excel',
  translate: 'Çevir',
  share: 'Paylaş',
  print: 'Yazdır',
  documentCenter: 'Belge merkezi',
  stampsAndSignatures: 'Kaşe & İmzalar',
  smartErase: 'Akıllı sil',
  saveAndBack: 'Kaydet ve dön',
  previousPage: 'Önceki sayfa',
  nextPage: 'Sonraki sayfa',
  newSignature: 'Yeni imza',
  applyToAllPages: 'Tüm sayfalara uygula',
  retry: 'Tekrar dene',
  premium: 'Premium',
  openPremium: "Premium'u gör",
  viewPlan: 'Planı gör',
} as const;

export const documentStatusCopy = {
  processing: 'OCR İşleniyor',
  failed: 'OCR Hata',
  pdfReady: 'PDF Hazır',
  wordReady: 'Word Hazır',
  ocrReady: 'OCR Hazır',
  draft: 'Taslak',
  ready: 'Hazır',
  exported: 'PDF Oluşturuldu',
  generic: 'Belge',
} as const;

export const documentDetailCopy = {
  loading: 'Belge detayı yükleniyor...',
  errorTitle: 'Belge açılamadı',
  retry: documentActionLabels.retry,
  previewEmpty: 'Önizleme yok',
  localBadge: 'LOCAL',
  favoriteBadge: 'Favori',
  pdfSavedBadge: 'PDF kayıtlı',
  wordSavedBadge: 'Word kayıtlı',
  dockEditCaption: 'Kaşe, imza ve sayfalar',
  secondaryActionsTitle: 'İkincil işlemler',
  secondaryActionsHint: 'Detaylı çıktı ve OCR aksiyonları',
  secondaryActionsBusyHint: 'İşlem sürüyor',
  secondaryActionCaptions: {
    ocr: 'Sayfalardaki metni algıla',
    translate: 'Algılanan metni Türkçeye çevir',
  },
  outputTitle: 'Export ve paylaşım',
  outputSubtitle:
    'Çıktının hazır olup olmadığını gör ve doğru sonraki aksiyonu tek dokunuşla başlat.',
  outputPremiumBadge: 'Premium yüzeyi',
  outputOpenBadge: 'Export açık',
  ocrPreviewTitle: 'OCR önizleme',
  translationPreviewTitle: 'Türkçe çeviri önizleme',
  resultReadyBadge: 'Hazır',
  resultWaitingBadge: 'Bekliyor',
  recentActionsTitle: 'Son işlemler',
  recentActionsEmptyTitle: 'Henüz işlem geçmişi yok',
  recentActionsEmptyText:
    'OCR, export veya çeviri çalıştırdığında burada son işlemler görünecek.',
  planTitleFree: 'Free plan',
  planTitlePro: 'Premium aktif',
  planLoading: 'Premium durumu yükleniyor...',
  planHintFree:
    'Free kullanıcı tüm araçları deneyebilir. PDF / Word / Excel kaydetme ve paylaşma premium ile açılır.',
  planHintPro: 'Premium aktif. Export ve paylaşma yüzeyleri açık.',
  historyCount: (count: number) => `${count} kayıt`,
} as const;

export const documentEditorCopy = {
  screenTitle: 'PDF Editör',
  screenSubtitle:
    'Büyük önizleme üstte, araç sekmeleri altta. Taşı, hizala ve sonuçlandır.',
  loadingSubtitle: 'Editör yükleniyor...',
  loadingText: 'Editör yükleniyor...',
  emptySubtitle: 'Düzenlenebilir sayfa bulunamadı.',
  emptyTitle: 'Bu belgede düzenlenecek sayfa yok',
  emptyText: 'Belgeyi tekrar tara veya farklı bir belge seç.',
  backToDetail: 'Belge detayına dön',
  sessionEyebrow: 'Editör oturumu',
  resolveSessionSubtitle: (
    currentPageNumber: number,
    totalPages: number,
    overlayCount: number,
  ) =>
    `Sayfa ${currentPageNumber} / ${totalPages} • Bu sayfada ${overlayCount} öğe var`,
  previewHint:
    'Boş alana dokun: yerleştir • Öğeyi tut: taşı • Sağ alt tutamaç: büyüt/küçült',
  pageStripTitle: 'Sayfa şeridi',
  pageStripSubtitle: 'Dokunarak sayfa değiştir',
  currentStateLabel: 'Aktif durum',
  viewTitle: 'Sayfa görünümü',
  viewText:
    'Hızlı geçiş, imza oluşturma ve sayfa bazlı araçlara bu yüzeyden eriş.',
  pageItemsTitle: 'Bu sayfadaki öğeler',
  pageItemsEmpty: 'Henüz öğe yok. Kaşe yerleştir veya imza ekle.',
  tabLabels: {
    view: 'Görüntü',
    format: 'Biçimlendirme',
    insert: 'Ekle',
  },
} as const;

export const documentPresentationCopy = {
  homeSummary: {
    title: 'Belge işlem özeti',
    subtitle: 'OCR, export ve recovery görünürlüğü tek yerden takip ediliyor.',
    failedMessage: 'Başarısız OCR kayıtları için belge merkezinden retry akışına geç.',
    processingMessage:
      'Devam eden OCR işlemleri belge merkezinde canlı durum kartlarıyla görünür.',
    cleanMessage:
      'Belge pipeline temiz durumda. Yeni işleme başlayabilir veya son belgeye dönebilirsin.',
  },
  recoverySummary: {
    title: 'OCR recovery',
    subtitle: 'Başarısız belge işlemleri bu ekrandan toplu toparlanabilir.',
    message: (failedVisibleCount: number) =>
      `Bu filtrede ${failedVisibleCount} belge OCR hatası verdi. İstersen seçim moduna alıp toplu tekrar deneyebilirsin.`,
    selectFailed: 'Başarısızları seç',
  },
  detailSummary: {
    importedPdf: {
      title: 'İçe aktarılan PDF',
      subtitle: 'Bu kayıt sayfa tabanlı belge akışına henüz girmiyor.',
      message:
        'OCR, editör ve yeniden export v1 akışı için sayfa tabanlı belge gerekiyor.',
    },
    ocrFailed: {
      title: 'OCR recovery gerekli',
      subtitle: 'Belge iş akışı hata verdi, aynı kayıttan tekrar deneyebilirsin.',
      fallbackMessage:
        'OCR işlemi tamamlanamadı. Düzenleme sonrası yeniden deneyebilirsin.',
    },
    processing: {
      title: 'Belge işleniyor',
      subtitle: 'OCR pipeline çalışıyor.',
      message:
        'İşlem tamamlandığında OCR metni ve export yüzeyleri bu ekranda güncellenecek.',
    },
    ready: {
      title: 'Belge hazır',
      subtitle: 'Düzenleme, OCR, çeviri ve export yüzeyleri aktif.',
      pdfReadyMessage:
        'PDF çıktısı hazır. Gerekirse yeniden üretip Word / Excel veya paylaşma akışına devam edebilirsin.',
      ocrReadyMessage:
        'OCR metni hazır. Çeviri veya export adımına geçebilirsin.',
      defaultMessage: 'Belge düzenleme ve export için hazır durumda.',
    },
    draft: {
      title: 'Belge taslak durumda',
      subtitle: 'Akış henüz tamamlanmadı.',
      message: 'Düzenle, OCR ve export adımına sırayla geçebilirsin.',
    },
    stats: {
      nonPageBased: 'Sayfa tabanlı değil',
      pdfMissing: 'PDF yok',
      wordMissing: 'Word yok',
      pdfReady: 'PDF hazır',
      wordReady: 'Word hazır',
    },
  },
} as const;

export function resolveDocumentPlanTitle(isPro: boolean) {
  return isPro
    ? documentDetailCopy.planTitlePro
    : documentDetailCopy.planTitleFree;
}

export function resolveDocumentPlanActionLabel(isPro: boolean) {
  return isPro
    ? documentActionLabels.viewPlan
    : documentActionLabels.openPremium;
}

export function resolveDocumentPlanHint(isPro: boolean) {
  return isPro
    ? documentDetailCopy.planHintPro
    : documentDetailCopy.planHintFree;
}

export function resolveDocumentShareDockCaption(hasPdf: boolean) {
  return hasPdf ? 'PDF hazır' : 'Önce PDF';
}

export function resolveDocumentWordDockCaption(hasWord: boolean) {
  return hasWord ? 'Hazır' : 'OCR sonrası';
}

export function resolveDocumentPrintDockCaption(hasPdf: boolean) {
  return hasPdf ? 'Sistem paneli' : 'Önce PDF';
}

export function resolvePdfPrimaryActionCopy(
  options: ExportPrimaryActionOptions,
): PrimaryActionCopy {
  if (!options.billingHydrated) {
    return {
      label: documentActionLabels.pdf,
      caption: 'Premium durumu yükleniyor',
    };
  }

  if (!options.canExport) {
    return {
      label: documentActionLabels.pdf,
      caption: 'Premium ile PDF kaydetmeyi aç',
    };
  }

  return {
    label: documentActionLabels.pdf,
    caption: options.hasFile
      ? 'Mevcut PDF çıktısını güncelle'
      : 'Güncel sayfalardan PDF oluştur',
  };
}

export function resolveWordPrimaryActionCopy(
  options: ExportPrimaryActionOptions,
): PrimaryActionCopy {
  if (!options.billingHydrated) {
    return {
      label: documentActionLabels.word,
      caption: 'Premium durumu yükleniyor',
    };
  }

  if (!options.canExport) {
    return {
      label: documentActionLabels.word,
      caption: 'Premium ile Word kaydetmeyi aç',
    };
  }

  return {
    label: documentActionLabels.word,
    caption: options.hasFile
      ? 'Mevcut Word çıktısını güncelle'
      : 'OCR metnini Word olarak hazırla',
  };
}

export function resolveExcelPrimaryActionCopy(options: {
  billingHydrated: boolean;
  canExport: boolean;
}): PrimaryActionCopy {
  if (!options.billingHydrated) {
    return {
      label: documentActionLabels.excel,
      caption: 'Premium durumu yükleniyor',
    };
  }

  if (!options.canExport) {
    return {
      label: documentActionLabels.excel,
      caption: 'Premium ile Excel kaydetmeyi aç',
    };
  }

  return {
    label: documentActionLabels.excel,
    caption: 'OCR metnini Excel olarak hazırla',
  };
}

export function resolvePdfOutputCopy(options: {
  billingHydrated: boolean;
  canExport: boolean;
  canShare: boolean;
  hasFile: boolean;
}): ExportSurfaceCopy {
  if (options.hasFile) {
    return {
      title: 'PDF',
      description: options.canShare
        ? 'PDF hazır. Şimdi doğrudan paylaşabilir veya yeniden üretebilirsin.'
        : 'PDF hazır. Paylaşmak için premium plan gerekir.',
      badgeLabel: 'Hazır',
      badgeTone: 'success',
      actionLabel: documentActionLabels.share,
    };
  }

  if (options.canExport) {
    return {
      title: 'PDF',
      description:
        'Henüz PDF oluşturulmadı. Belgeyi sonuçlandırmak için ilk doğru adım budur.',
      badgeLabel: 'Hazır değil',
      badgeTone: 'muted',
      actionLabel: options.billingHydrated ? documentActionLabels.pdf : null,
    };
  }

  return {
    title: 'PDF',
    description: 'PDF kaydetme ve paylaşma premium planda açılır.',
    badgeLabel: 'Premium gerekli',
    badgeTone: 'warning',
    actionLabel: options.billingHydrated ? documentActionLabels.premium : null,
  };
}

export function resolveWordOutputCopy(options: {
  billingHydrated: boolean;
  canExport: boolean;
  canShare: boolean;
  hasFile: boolean;
}): ExportSurfaceCopy {
  if (options.hasFile) {
    return {
      title: 'Word',
      description: options.canShare
        ? 'Word çıktısı hazır. Şimdi paylaşabilir veya yeniden üretebilirsin.'
        : 'Word hazır. Paylaşmak için premium plan gerekir.',
      badgeLabel: 'Hazır',
      badgeTone: 'accent',
      actionLabel: documentActionLabels.share,
    };
  }

  if (options.canExport) {
    return {
      title: 'Word',
      description:
        'Word çıktısı OCR metni üzerinden oluşturulur. Gerekiyorsa OCR otomatik hazırlanır.',
      badgeLabel: 'Hazır değil',
      badgeTone: 'muted',
      actionLabel: options.billingHydrated ? documentActionLabels.word : null,
    };
  }

  return {
    title: 'Word',
    description: 'Word çıktısı premium planda açılır.',
    badgeLabel: 'Premium gerekli',
    badgeTone: 'warning',
    actionLabel: options.billingHydrated ? documentActionLabels.premium : null,
  };
}

export function resolveExcelOutputCopy(options: {
  billingHydrated: boolean;
  canExport: boolean;
}): ExportSurfaceCopy {
  return {
    title: 'Excel',
    description: options.canExport
      ? 'Excel çıktısı OCR metni üzerinden oluşturulur. Bu yüzey export üretir; kalıcı paylaşım için önce dosya hazırlığı gerekir.'
      : 'Excel çıktısı premium planda açılır.',
    badgeLabel: options.canExport ? 'İsteğe bağlı' : 'Premium gerekli',
    badgeTone: options.canExport ? 'accent' : 'warning',
    actionLabel: options.billingHydrated
      ? options.canExport
        ? documentActionLabels.excel
        : documentActionLabels.premium
      : null,
  };
}

export function resolveShareSummaryCopy(options: {
  billingHydrated: boolean;
  canShare: boolean;
  hasPdf: boolean;
  hasWord: boolean;
}): ShareSummaryCopy {
  if (!options.billingHydrated) {
    return {
      title: 'Paylaşım hazırlanıyor',
      text: 'Premium ve paylaşım durumu doğrulanıyor.',
      tone: 'muted',
      badgeLabel: 'Bekliyor',
    };
  }

  if (!options.canShare) {
    return {
      title: 'Paylaşım premium ile açılır',
      text: 'PDF ve Word çıktıları hazır olsa bile paylaşma yüzeyi premium planda aktif olur.',
      tone: 'warning',
      badgeLabel: 'Kilitli',
    };
  }

  if (options.hasPdf || options.hasWord) {
    return {
      title: 'Paylaşmaya hazırsın',
      text: 'Hazır dosyaları doğrudan sistem paylaşım paneli ile dışarı aktarabilirsin.',
      tone: 'success',
      badgeLabel: 'Paylaşılabilir',
    };
  }

  return {
    title: 'Önce çıktı üret',
    text: 'Paylaşım için önce PDF veya Word çıktısı hazırlanmalı.',
    tone: 'muted',
    badgeLabel: 'Bekliyor',
  };
}

export function resolveNextStepCopy(options: {
  hasPageBasedDocument: boolean;
  hasPdf: boolean;
  canExportPdf: boolean;
  canShare: boolean;
}): NextStepCopy {
  if (!options.hasPageBasedDocument) {
    return {
      title: 'Bu belge düzenleme akışında değil',
      text: 'Bu kayıt sayfa tabanlı olmadığı için önce görsel tabanlı bir belge ile export akışı kullanılmalı.',
      tone: 'warning',
    };
  }

  if (!options.hasPdf) {
    return {
      title: 'Sonraki doğru adım: PDF üret',
      text: 'Belgeyi paylaşmadan veya dışarı aktarmadan önce güncel sayfalardan PDF oluştur.',
      tone: options.canExportPdf ? 'accent' : 'warning',
    };
  }

  if (!options.canShare) {
    return {
      title: 'PDF hazır, paylaşım kilitli',
      text: 'Dosya hazır. Paylaşmak için premium plan gerekir.',
      tone: 'warning',
    };
  }

  return {
    title: 'Belge sonuçlandırıldı',
    text: 'PDF hazır. Şimdi paylaşabilir, Word / Excel çıktısına geçebilir veya düzenlemeyi son kez kontrol edebilirsin.',
    tone: 'success',
  };
}
