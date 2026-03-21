import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Screen } from '../../components/common/Screen';
import { appRuntime, isPreviewRuntime } from '../../config/runtime';
import {
  authRemoteRuntimeConfig,
  getAuthRemoteRuntimeStatusLabel,
  isCustomAuthRuntimeConfigured,
} from '../../modules/auth/auth-remote-config.service';
import {
  getAuthActiveWorkspace,
  getAuthSessionRuntimeLabel,
  getAuthWorkspaceRoleLabel,
  getAuthWorkspaceSummaryLabel,
  isCredentialAuthRuntimeReady,
  isMockAuthSession,
} from '../../modules/auth/auth.service';
import {
  getBillingRuntimeLabel,
  isMockBillingState,
} from '../../modules/billing/billing.service';
import { type PdfImageQualityPreset } from '../../modules/imaging/imaging.service';
import { useAuthStore } from '../../store/useAuthStore';
import { useBillingStore } from '../../store/useBillingStore';
import { useWorkspaceSyncStore } from '../../store/useWorkspaceSyncStore';
import {
  type WorkspaceSyncPullConflictKind,
  type WorkspaceSyncPullConflictResolution,
} from '../../modules/workspace/workspace-sync-pull.service';
import {
  getWorkspaceSyncMembershipLabel,
  getWorkspaceSyncModeLabel,
  getWorkspaceSyncPendingLabel,
  getWorkspaceSyncStatusLabel,
} from '../../modules/workspace/workspace-sync.service';
import {
  getWorkspaceSyncRemoteRuntimeStatusLabel,
  isCustomWorkspaceSyncConfigured,
  workspaceSyncRemoteRuntimeConfig,
} from '../../modules/workspace/workspace-sync-remote-config.service';
import {
  getTranslationRuntimeDisplayLabel,
  getTranslationRuntimeStatusLabel,
  translationRuntimeConfig,
} from '../../modules/translation/translation-runtime-config.service';
import {
  Radius,
  Shadows,
  Spacing,
  Typography,
  colors,
} from '../../theme';
import {
  clearObservabilityEvents,
  getObservabilitySnapshot,
  type ObservabilitySnapshot,
} from '../../modules/observability/observability.service';

function SettingRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.settingRow}>
      <Text style={styles.settingLabel}>{label}</Text>
      <Text style={styles.settingValue}>{value}</Text>
    </View>
  );
}

function ToggleRow({
  title,
  subtitle,
  value,
  onPress,
}: {
  title: string;
  subtitle?: string;
  value: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.toggleRow,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.toggleTextBlock}>
        <Text style={styles.toggleTitle}>{title}</Text>
        {subtitle ? <Text style={styles.toggleSubtitle}>{subtitle}</Text> : null}
      </View>

      <View style={[styles.switchBase, value && styles.switchBaseActive]}>
        <View style={[styles.switchKnob, value && styles.switchKnobActive]} />
      </View>
    </Pressable>
  );
}

function ChoiceChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

function InfoPill({
  label,
  tone = 'default',
}: {
  label: string;
  tone?: 'default' | 'accent' | 'success' | 'warning';
}) {
  return (
    <View
      style={[
        styles.infoPill,
        tone === 'accent' && styles.infoPillAccent,
        tone === 'success' && styles.infoPillSuccess,
        tone === 'warning' && styles.infoPillWarning,
      ]}
    >
      <Text
        style={[
          styles.infoPillText,
          tone === 'accent' && styles.infoPillTextAccent,
          tone === 'success' && styles.infoPillTextSuccess,
          tone === 'warning' && styles.infoPillTextWarning,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message.trim().length > 0
    ? error.message
    : fallback;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return 'Yok';
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return 'Geçersiz';
  }

  return parsed.toLocaleString('tr-TR');
}

function getPullConflictKindLabel(kind: WorkspaceSyncPullConflictKind) {
  switch (kind) {
    case 'remote_delete_vs_local_change':
      return 'Uzak silme ile yerel değişiklik çakışıyor';
    case 'local_newer_than_remote':
      return 'Yerel kayıt daha yeni';
    case 'remote_newer_than_local':
    default:
      return 'Uzak kayıt daha yeni';
  }
}

function getPullResolutionLabel(resolution: WorkspaceSyncPullConflictResolution | null) {
  switch (resolution) {
    case 'accept_remote':
      return 'Uzak kayıt uygulanacak';
    case 'keep_local':
      return 'Yerel kayıt korunacak';
    default:
      return 'Çözüm bekliyor';
  }
}

function getTransferTaskStatusLabel(status: 'pending' | 'running' | 'completed' | 'failed') {
  switch (status) {
    case 'running':
      return 'İndiriliyor';
    case 'completed':
      return 'Tamamlandı';
    case 'failed':
      return 'Başarısız';
    case 'pending':
    default:
      return 'Bekliyor';
  }
}

function getTransferEntityLabel(entityType: string) {
  switch (entityType) {
    case 'asset':
      return 'Asset';
    case 'document_page':
      return 'Sayfa';
    case 'document_thumbnail':
      return 'Küçük görsel';
    case 'document_pdf':
      return 'PDF';
    default:
      return entityType;
  }
}

function getObservabilityLevelLabel(level: 'info' | 'warning' | 'error') {
  switch (level) {
    case 'warning':
      return 'Uyarı';
    case 'error':
      return 'Hata';
    case 'info':
    default:
      return 'Bilgi';
  }
}

export function SettingsScreen() {
  const session = useAuthStore((state) => state.session);
  const logout = useAuthStore((state) => state.logout);
  const switchWorkspace = useAuthStore((state) => state.switchWorkspace);

  const isPro = useBillingStore((state) => state.isPro);
  const plan = useBillingStore((state) => state.plan);
  const expiresAt = useBillingStore((state) => state.expiresAt);
  const billingMetadata = useBillingStore((state) => state.metadata);
  const syncSnapshot = useWorkspaceSyncStore((state) => state.snapshot);
  const pullPreview = useWorkspaceSyncStore((state) => state.pullPreview);
  const transferQueueSummary = useWorkspaceSyncStore((state) => state.transferQueueSummary);
  const syncHydrated = useWorkspaceSyncStore((state) => state.hydrated);
  const syncBusy = useWorkspaceSyncStore((state) => state.busy);
  const syncError = useWorkspaceSyncStore((state) => state.error);
  const pullConflictResolutions = useWorkspaceSyncStore(
    (state) => state.pullConflictResolutions,
  );
  const hydrateSync = useWorkspaceSyncStore((state) => state.hydrate);
  const refreshSync = useWorkspaceSyncStore((state) => state.refresh);
  const checkSyncReadiness = useWorkspaceSyncStore((state) => state.checkReadiness);
  const pushSyncToRemote = useWorkspaceSyncStore((state) => state.pushToRemote);
  const previewRemotePull = useWorkspaceSyncStore((state) => state.previewPull);
  const applyRemotePull = useWorkspaceSyncStore((state) => state.applyPull);
  const refreshTransferQueue = useWorkspaceSyncStore((state) => state.refreshTransferQueue);
  const processTransferQueue = useWorkspaceSyncStore((state) => state.processTransferQueue);
  const retryFailedTransfers = useWorkspaceSyncStore((state) => state.retryFailedTransfers);
  const clearCompletedTransfers = useWorkspaceSyncStore((state) => state.clearCompletedTransfers);
  const setPullConflictResolution = useWorkspaceSyncStore(
    (state) => state.setPullConflictResolution,
  );
  const setAllPullConflictResolutions = useWorkspaceSyncStore(
    (state) => state.setAllPullConflictResolutions,
  );

  const [busy, setBusy] = useState(false);
  const [switchingWorkspaceId, setSwitchingWorkspaceId] = useState<string | null>(null);
  const [observabilityBusy, setObservabilityBusy] = useState(false);
  const [observabilitySnapshot, setObservabilitySnapshot] =
    useState<ObservabilitySnapshot | null>(null);

  const [scanQuality, setScanQuality] = useState<PdfImageQualityPreset>('balanced');
  const [recognitionLanguage, setRecognitionLanguage] = useState<
    'tr' | 'en' | 'multi'
  >('tr');
  const [saveOriginalsToPhotos, setSaveOriginalsToPhotos] = useState(false);
  const [saveScansToPhotos, setSaveScansToPhotos] = useState(false);
  const [startWithCamera, setStartWithCamera] = useState(true);
  const [lensTipsEnabled, setLensTipsEnabled] = useState(true);

  const formattedExpiry = useMemo(() => {
    if (!expiresAt) {
      return 'Yok';
    }

    const date = new Date(expiresAt);

    if (Number.isNaN(date.getTime())) {
      return 'Geçersiz';
    }

    return date.toLocaleString('tr-TR');
  }, [expiresAt]);

  const qualityDescription = useMemo(() => {
    switch (scanQuality) {
      case 'compact':
        return 'Daha küçük çıktı boyutu üretir.';
      case 'high':
        return 'Daha büyük ama daha net çıktı üretir.';
      case 'balanced':
      default:
        return 'Kalite ve dosya boyutu arasında dengeli çalışır.';
    }
  }, [scanQuality]);

  const authRuntimeLabel = useMemo(
    () => getAuthSessionRuntimeLabel(session),
    [session],
  );

  const billingRuntimeLabel = useMemo(
    () =>
      getBillingRuntimeLabel({
        isPro,
        plan,
        expiresAt,
        metadata: billingMetadata,
      }),
    [billingMetadata, expiresAt, isPro, plan],
  );

  const isMockSession = useMemo(() => isMockAuthSession(session), [session]);

  const isMockPremium = useMemo(
    () =>
      isMockBillingState({
        isPro,
        plan,
        expiresAt,
        metadata: billingMetadata,
      }),
    [billingMetadata, expiresAt, isPro, plan],
  );

  const sessionCreatedAt = session?.metadata?.createdAt ?? null;
  const activeWorkspace = getAuthActiveWorkspace(session);
  const workspaceCount = session?.workspaces.length ?? 0;
  const unresolvedPullConflictCount = useMemo(() => {
    if (!pullPreview) {
      return 0;
    }

    return pullPreview.conflicts.filter((conflict) => !pullConflictResolutions[conflict.id])
      .length;
  }, [pullConflictResolutions, pullPreview]);
  const workspaces = session?.workspaces ?? [];
  const billingUpdatedAt = billingMetadata?.updatedAt ?? null;
  const buildModeLabel = isPreviewRuntime() ? 'ONIZLEME CALISIYOR' : 'URUN MODU';

  const refreshObservability = useCallback(async () => {
    try {
      setObservabilityBusy(true);
      const snapshot = await getObservabilitySnapshot();
      setObservabilitySnapshot(snapshot);
    } finally {
      setObservabilityBusy(false);
    }
  }, []);

  useEffect(() => {
    void hydrateSync(session);
  }, [hydrateSync, session]);

  useEffect(() => {
    if (!syncHydrated) {
      return;
    }

    void refreshSync(session).catch((error) => {
      console.warn('[SettingsScreen] Failed to refresh sync snapshot:', error);
    });
  }, [
    refreshSync,
    session,
    session?.activeWorkspaceId,
    session?.metadata?.updatedAt,
    syncHydrated,
  ]);

  useEffect(() => {
    void refreshObservability();
  }, [refreshObservability, session?.activeWorkspaceId, session?.metadata?.updatedAt]);

  const syncModeLabel = useMemo(
    () =>
      syncSnapshot ? getWorkspaceSyncModeLabel(syncSnapshot.mode) : 'Sync özeti hazırlanıyor',
    [syncSnapshot],
  );

  const syncStatusLabel = useMemo(
    () =>
      syncSnapshot
        ? getWorkspaceSyncStatusLabel(syncSnapshot.lastStatus)
        : 'Henüz kontrol edilmedi',
    [syncSnapshot],
  );

  const syncPendingLabel = useMemo(
    () =>
      syncSnapshot
        ? getWorkspaceSyncPendingLabel(syncSnapshot)
        : 'Yerel durum okunuyor',
    [syncSnapshot],
  );

  const syncMembershipLabel = useMemo(
    () =>
      syncSnapshot
        ? getWorkspaceSyncMembershipLabel(syncSnapshot.membershipStatus)
        : 'Üyelik kontrol bekliyor',
    [syncSnapshot],
  );

  const handleLogout = async () => {
    try {
      setBusy(true);
      await logout();
    } catch (error) {
      Alert.alert(
        'Hata',
        getErrorMessage(error, 'Çıkış sırasında hata oluştu.'),
      );
    } finally {
      setBusy(false);
    }
  };

  const handleSwitchWorkspace = async (workspaceId: string) => {
    if (!session || workspaceId === session.activeWorkspaceId) {
      return;
    }

    try {
      setSwitchingWorkspaceId(workspaceId);
      await switchWorkspace(workspaceId);
    } catch (error) {
      Alert.alert(
        'Hata',
        getErrorMessage(error, 'Çalışma alanı değiştirilemedi.'),
      );
    } finally {
      setSwitchingWorkspaceId(null);
    }
  };

  const handleRefreshSyncSummary = async () => {
    try {
      await refreshSync(session);
    } catch (error) {
      Alert.alert(
        'Hata',
        getErrorMessage(error, 'Sync özeti yenilenemedi.'),
      );
    }
  };

  const handleCheckSync = async () => {
    try {
      await checkSyncReadiness(session);
    } catch (error) {
      Alert.alert(
        'Hata',
        getErrorMessage(error, 'Bulut hazırlığı kontrol edilemedi.'),
      );
    }
  };

  const handlePushSync = async () => {
    try {
      const result = await pushSyncToRemote(session);
      Alert.alert(
        result.pushed ? 'Sync gönderildi' : 'Sync hazır',
        `${result.summary}\n\nBelge: ${result.payloadCounts.documents}\nAsset: ${result.payloadCounts.assets}\nSilme kaydı: ${result.payloadCounts.tombstones}`,
      );
    } catch (error) {
      Alert.alert(
        'Hata',
        getErrorMessage(error, 'Delta push başlatılamadı.'),
      );
    }
  };

  const handlePreviewPull = async () => {
    try {
      const preview = await previewRemotePull(session);
      Alert.alert(
        preview.decisionCounts.conflict > 0 ? 'Çatışma önizlemesi hazır' : 'Pull önizleme hazır',
        `${preview.summary}\n\nOluştur: ${preview.decisionCounts.create}\nGüncelle: ${preview.decisionCounts.update}\nSil: ${preview.decisionCounts.delete}\nÇatışma: ${preview.decisionCounts.conflict}\nİndirme: ${preview.pendingTransferCount}`,
      );
    } catch (error) {
      Alert.alert(
        'Hata',
        getErrorMessage(error, 'Pull önizleme başlatılamadı.'),
      );
    }
  };

  const handleApplyPull = async () => {
    try {
      const result = await applyRemotePull(session);
      Alert.alert(
        result.applied ? 'Pull uygulandı' : 'Pull tamamlandı',
        `${result.summary}\n\nOluştur: ${result.appliedCounts.created}\nGüncelle: ${result.appliedCounts.updated}\nSil: ${result.appliedCounts.deleted}\nYerelde tutulan: ${result.appliedCounts.retainedLocal}\nAtlanan: ${result.appliedCounts.skipped}\nİndirilen: ${result.appliedCounts.downloaded}\nÇatışma: ${result.conflictCount}`,
      );
    } catch (error) {
      Alert.alert(
        'Hata',
        getErrorMessage(error, 'Pull uygulanamadı.'),
      );
    }
  };

  const handleRefreshTransferQueue = async () => {
    try {
      await refreshTransferQueue(session);
    } catch (error) {
      Alert.alert(
        'Hata',
        getErrorMessage(error, 'Transfer kuyruğu yenilenemedi.'),
      );
    }
  };

  const handleProcessTransferQueue = async () => {
    try {
      const result = await processTransferQueue(session);
      Alert.alert(
        result.downloadedCount > 0 ? 'İndirmeler tamamlandı' : 'Transfer kuyruğu işlendi',
        `İşlenen: ${result.processedCount}\nİndirilen: ${result.downloadedCount}\nBaşarısız: ${result.failedCount}\nAtlanan: ${result.skippedCount}`,
      );
    } catch (error) {
      Alert.alert(
        'Hata',
        getErrorMessage(error, 'Transfer kuyruğu işlenemedi.'),
      );
    }
  };

  const handleRetryFailedTransfers = async () => {
    try {
      const result = await retryFailedTransfers(session);
      Alert.alert(
        result.downloadedCount > 0 ? 'Başarısız indirmeler yeniden denendi' : 'Yeniden deneme tamamlandı',
        `İşlenen: ${result.processedCount}\nİndirilen: ${result.downloadedCount}\nBaşarısız: ${result.failedCount}\nAtlanan: ${result.skippedCount}`,
      );
    } catch (error) {
      Alert.alert(
        'Hata',
        getErrorMessage(error, 'Başarısız indirmeler yeniden denenemedi.'),
      );
    }
  };

  const handleClearCompletedTransfers = async () => {
    try {
      const summary = await clearCompletedTransfers(session);
      Alert.alert(
        'Kuyruk temizlendi',
        `Kalan toplam kayıt: ${summary?.totalCount ?? 0}`,
      );
    } catch (error) {
      Alert.alert(
        'Hata',
        getErrorMessage(error, 'Tamamlanan indirmeler temizlenemedi.'),
      );
    }
  };

  const handleRefreshObservability = async () => {
    try {
      await refreshObservability();
    } catch (error) {
      Alert.alert(
        'Hata',
        getErrorMessage(error, 'Observability özeti yenilenemedi.'),
      );
    }
  };

  const handleClearObservability = async () => {
    try {
      setObservabilityBusy(true);
      await clearObservabilityEvents();
      const snapshot = await getObservabilitySnapshot();
      setObservabilitySnapshot(snapshot);
      Alert.alert('Observability temizlendi', 'Yerel event geçmişi sıfırlandı.');
    } catch (error) {
      Alert.alert(
        'Hata',
        getErrorMessage(error, 'Observability geçmişi temizlenemedi.'),
      );
    } finally {
      setObservabilityBusy(false);
    }
  };

  return (
    <Screen
      title="Ayarlar"
      subtitle="Tarama, tanıma ve cihaz içi oturum tercihlerini buradan yönet."
    >
      <View style={styles.heroCard}>
        <Text style={styles.heroEyebrow}>{buildModeLabel}</Text>
        <Text style={styles.heroTitle}>Runtime görünürlüğü</Text>
        <Text style={styles.heroText}>
          Bu build local-first çalışır. Oturum, premium ve uygulama kabuğunun
          hangi runtime ile ilerlediğini buradan açıkça görürsün.
        </Text>

        <View style={styles.heroPillRow}>
          <InfoPill label={authRuntimeLabel} tone={isMockSession ? 'warning' : 'default'} />
          <InfoPill
            label={billingRuntimeLabel}
            tone={isMockPremium ? 'warning' : isPro ? 'success' : 'default'}
          />
          <InfoPill label={isPro ? 'Premium aktif' : 'Free plan'} tone={isPro ? 'success' : 'accent'} />
        </View>
      </View>

      <View style={styles.runtimeNoticeCard}>
        <View style={styles.runtimeNoticeTextWrap}>
          <Text style={styles.runtimeNoticeTitle}>Runtime açıklaması</Text>
          <Text style={styles.runtimeNoticeText}>
            {!isCredentialAuthRuntimeReady()
              ? `${getAuthSessionRuntimeLabel(session)} için runtime köprüsü açık. Çalışma alanı bağlamı korunuyor ama gerçek giriş sağlayıcısı henüz bu build'e bağlanmadı.`
              : isMockSession || isMockPremium
                ? 'Bu cihazdaki oturum veya premium durumu onizleme runtime ile calisiyor. Amac urun akislarini gercek navigasyon ve veri mantigi ile dogrulamak.'
                : appRuntime.requireAuthentication
                  ? 'Bu cihazda zorunlu oturum akisi acik. Auth ve premium katmanlari urun moduna gore raporlaniyor.'
                  : 'Misafir erisimi acik. Yerel veri ve runtime servisleri serbest kullanim modunda hazirlaniyor.'}
          </Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Hesap</Text>
        <SettingRow label="Ad" value={session?.user.name ?? 'Yerel kullanıcı'} />
        <SettingRow label="E-posta" value={session?.user.email ?? 'Tanımsız'} />
        <SettingRow label="Oturum türü" value={authRuntimeLabel} />
        <SettingRow
          label="Aktif çalışma alanı"
          value={getAuthWorkspaceSummaryLabel(session)}
        />
        <SettingRow
          label="Rol"
          value={getAuthWorkspaceRoleLabel(activeWorkspace?.role)}
        />
        <SettingRow label="Çalışma alanı sayısı" value={String(workspaceCount)} />
        <SettingRow label="Oturum oluşturulma" value={formatDateTime(sessionCreatedAt)} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Premium</Text>
        <SettingRow label="Durum" value={isPro ? 'Aktif' : 'Free'} />
        <SettingRow label="Plan" value={plan} />
        <SettingRow label="Runtime" value={billingRuntimeLabel} />
        <SettingRow label="Güncellenme" value={formatDateTime(billingUpdatedAt)} />
        <SettingRow label="Bitiş" value={formattedExpiry} />
      </View>

      {appRuntime.authProvider === 'custom' ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Custom Auth API</Text>
          <SettingRow label="Durum" value={getAuthRemoteRuntimeStatusLabel()} />
          <SettingRow
            label="Base URL"
            value={authRemoteRuntimeConfig.baseUrl ?? 'Tanımlı değil'}
          />
          <SettingRow label="Login yolu" value={authRemoteRuntimeConfig.loginPath} />
          <SettingRow
            label="Session yolu"
            value={authRemoteRuntimeConfig.sessionPath}
          />
          <Text style={styles.cardHint}>
            {isCustomAuthRuntimeConfigured()
              ? 'Custom API runtime hazır. Giriş, kayıt ve workspace değişimi uzak sağlayıcıya yönlenebilir.'
              : 'Custom runtime seçili ama EXPO_PUBLIC_AUTH_API_BASE_URL eksik olduğu için bridge modunda çalışıyor.'}
          </Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Çeviri ve Export</Text>
        <SettingRow
          label="Çeviri sağlayıcısı"
          value={getTranslationRuntimeDisplayLabel()}
        />
        <SettingRow
          label="Çeviri durumu"
          value={getTranslationRuntimeStatusLabel()}
        />
        <SettingRow
          label="LibreTranslate URL"
          value={translationRuntimeConfig.libreTranslateBaseUrl ?? 'Tanımlı değil'}
        />
        <SettingRow label="Word formatı" value="DOCX (docx)" />
        <SettingRow label="Excel formatı" value="XLSX (ExcelJS)" />
        <Text style={styles.cardHint}>
          Çeviri tarafı env yapılandırmasına göre DeepL API Free, Azure Translator
          veya self-host LibreTranslate ile çalışır. Excel çıktısı artık gerçek
          XLSX olarak ExcelJS ile üretilir.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Bulut eşitleme</Text>
        <Text style={styles.cardText}>
          Aktif çalışma alanının buluta çıkmaya ne kadar hazır olduğunu, son
          kontrol zamanını ve sıradaki payload büyüklüğünü burada izleyebilirsin.
        </Text>

        <View style={styles.heroPillRow}>
          <InfoPill
            label={syncModeLabel}
            tone={syncSnapshot?.canUseRemoteSync ? 'success' : 'warning'}
          />
          <InfoPill
            label={syncStatusLabel}
            tone={
              syncSnapshot?.lastStatus === 'ready'
                ? 'success'
                : syncSnapshot?.lastStatus === 'error'
                  ? 'warning'
                  : 'default'
            }
          />
          <InfoPill
            label={syncPendingLabel}
            tone={syncSnapshot?.hasPendingLocalChanges ? 'accent' : 'default'}
          />
          <InfoPill
            label={syncMembershipLabel}
            tone={syncSnapshot?.membershipStatus === 'verified' ? 'success' : 'warning'}
          />
        </View>

        <SettingRow
          label="Sync çalışma alanı"
          value={syncSnapshot?.workspaceName ?? 'Çalışma alanı yok'}
        />
        <SettingRow
          label="Hazır kayıt"
          value={String(syncSnapshot?.syncCandidateCount ?? 0)}
        />
        <SettingRow
          label="Belgeler"
          value={String(syncSnapshot?.documentCount ?? 0)}
        />
        <SettingRow
          label="Sayfalar"
          value={String(syncSnapshot?.pageCount ?? 0)}
        />
        <SettingRow
          label="Kurumsal kaşeler"
          value={String(syncSnapshot?.workspaceStampCount ?? 0)}
        />
        <SettingRow
          label="Kişisel kaşeler"
          value={String(syncSnapshot?.personalStampCount ?? 0)}
        />
        <SettingRow
          label="İmzalar"
          value={String(syncSnapshot?.signatureCount ?? 0)}
        />
        <SettingRow
          label="Son yerel değişiklik"
          value={formatDateTime(syncSnapshot?.lastLocalChangeAt)}
        />
        <SettingRow
          label="Son hazırlık kontrolü"
          value={formatDateTime(syncSnapshot?.lastCheckedAt)}
        />
        <SettingRow
          label="Son başarılı sync"
          value={formatDateTime(syncSnapshot?.lastSuccessfulSyncAt)}
        />
        <SettingRow label="Üyelik" value={syncMembershipLabel} />
        {syncSnapshot?.remoteBaseUrl ? (
          <SettingRow label="Uzak endpoint" value={syncSnapshot.remoteBaseUrl} />
        ) : null}
        {syncSnapshot?.remoteSummary ? (
          <Text style={styles.cardHint}>{syncSnapshot.remoteSummary}</Text>
        ) : null}

        <Text style={styles.cardHint}>
          {syncError ??
            syncSnapshot?.blockingReason ??
            'Remote workspace sync endpointleri bağlandığında bu kart gerçek push/pull telemetrisine dönecek.'}
        </Text>

        <View style={styles.inlineActionRow}>
          <Pressable
            onPress={() => {
              void handleRefreshSyncSummary();
            }}
            disabled={syncBusy}
            style={({ pressed }) => [
              styles.secondaryButton,
              syncBusy && styles.buttonDisabled,
              pressed && !syncBusy && styles.pressed,
            ]}
          >
            <Text style={styles.secondaryButtonText}>Özeti yenile</Text>
          </Pressable>

          <Pressable
            onPress={() => {
              void handleCheckSync();
            }}
            disabled={syncBusy}
            style={({ pressed }) => [
              styles.primaryButton,
              syncBusy && styles.buttonDisabled,
              pressed && !syncBusy && styles.pressed,
            ]}
          >
            <Text style={styles.primaryButtonText}>
              {syncBusy ? 'Kontrol ediliyor...' : 'Hazırlığı kontrol et'}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => {
              void handlePushSync();
            }}
            disabled={syncBusy || !syncSnapshot?.canUseRemoteSync}
            style={({ pressed }) => [
              styles.primaryButton,
              (syncBusy || !syncSnapshot?.canUseRemoteSync) && styles.buttonDisabled,
              pressed && !syncBusy && syncSnapshot?.canUseRemoteSync && styles.pressed,
            ]}
          >
            <Text style={styles.primaryButtonText}>
              {syncBusy ? 'İşleniyor...' : 'Delta push dene'}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => {
              void handlePreviewPull();
            }}
            disabled={syncBusy || !syncSnapshot?.canUseRemoteSync}
            style={({ pressed }) => [
              styles.secondaryButton,
              (syncBusy || !syncSnapshot?.canUseRemoteSync) && styles.buttonDisabled,
              pressed && !syncBusy && syncSnapshot?.canUseRemoteSync && styles.pressed,
            ]}
          >
            <Text style={styles.secondaryButtonText}>
              {syncBusy ? 'İşleniyor...' : 'Pull önizleme dene'}
            </Text>
          </Pressable>
        </View>
      </View>

      {pullPreview ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Pull önizleme</Text>
          <Text style={styles.cardText}>
            Uzak manifest ile yerel kayıtların nasıl birleşeceğini dosya indirme
            başlamadan önce burada görebilirsin.
          </Text>

          <View style={styles.heroPillRow}>
            <InfoPill
              label={`${pullPreview.decisionCounts.create} oluştur`}
              tone={pullPreview.decisionCounts.create > 0 ? 'accent' : 'default'}
            />
            <InfoPill
              label={`${pullPreview.decisionCounts.update} güncelle`}
              tone={pullPreview.decisionCounts.update > 0 ? 'success' : 'default'}
            />
            <InfoPill
              label={`${pullPreview.decisionCounts.delete} sil`}
              tone={pullPreview.decisionCounts.delete > 0 ? 'warning' : 'default'}
            />
            <InfoPill
              label={`${pullPreview.decisionCounts.conflict} çatışma`}
              tone={pullPreview.decisionCounts.conflict > 0 ? 'warning' : 'default'}
            />
          </View>

          <SettingRow
            label="Remote belgeler"
            value={String(pullPreview.remoteCounts.documents)}
          />
          <SettingRow
            label="Remote assetler"
            value={String(pullPreview.remoteCounts.assets)}
          />
          <SettingRow
            label="Remote silme kaydı"
            value={String(pullPreview.remoteCounts.tombstones)}
          />
          <SettingRow
            label="İndirme kuyruğu"
            value={String(pullPreview.pendingTransferCount)}
          />

	          <Text style={styles.cardHint}>{pullPreview.summary}</Text>

	          {pullPreview.conflicts.length > 0 ? (
	            <View style={styles.conflictList}>
                <Text style={styles.conflictHelperText}>
                  {unresolvedPullConflictCount > 0
                    ? `${unresolvedPullConflictCount} çatışma çözüm bekliyor. Tüm satırlar için karar verildiğinde pull uygulanır.`
                    : 'Tüm çatışmalar için karar verildi. Pull artık uygulanabilir.'}
                </Text>
                <View style={styles.inlineActionRow}>
                  <Pressable
                    onPress={() => {
                      setAllPullConflictResolutions(
                        pullPreview.conflicts,
                        'accept_remote',
                      );
                    }}
                    disabled={syncBusy}
                    style={({ pressed }) => [
                      styles.secondaryButton,
                      syncBusy && styles.buttonDisabled,
                      pressed && !syncBusy && styles.pressed,
                    ]}
                  >
                    <Text style={styles.secondaryButtonText}>Tümünü uzakla çöz</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setAllPullConflictResolutions(
                        pullPreview.conflicts,
                        'keep_local',
                      );
                    }}
                    disabled={syncBusy}
                    style={({ pressed }) => [
                      styles.secondaryButton,
                      syncBusy && styles.buttonDisabled,
                      pressed && !syncBusy && styles.pressed,
                    ]}
                  >
                    <Text style={styles.secondaryButtonText}>Tümünü yerelde tut</Text>
                  </Pressable>
                </View>
	              {pullPreview.conflicts.map((conflict) => (
	                <View key={`${conflict.entityType}:${conflict.entityId}`} style={styles.conflictRow}>
	                  <Text style={styles.conflictTitle}>{conflict.label}</Text>
	                  <Text style={styles.conflictMeta}>
	                    {conflict.entityType} • {getPullConflictKindLabel(conflict.kind)} • Yerel:{' '}
	                    {formatDateTime(conflict.localChangedAt)} • Uzak:{' '}
	                    {formatDateTime(conflict.remoteChangedAt)}
	                  </Text>
                    <Text style={styles.conflictResolutionText}>
                      {getPullResolutionLabel(
                        pullConflictResolutions[conflict.id] ?? null,
                      )}
                    </Text>
                    <View style={styles.chipRow}>
                      <ChoiceChip
                        label="Uzağı al"
                        selected={pullConflictResolutions[conflict.id] === 'accept_remote'}
                        onPress={() => {
                          setPullConflictResolution(conflict, 'accept_remote');
                        }}
                      />
                      <ChoiceChip
                        label="Yereli koru"
                        selected={pullConflictResolutions[conflict.id] === 'keep_local'}
                        onPress={() => {
                          setPullConflictResolution(conflict, 'keep_local');
                        }}
                      />
                    </View>
	                </View>
	              ))}
	            </View>
	          ) : null}

          <View style={styles.inlineActionRow}>
	            <Pressable
	              onPress={() => {
	                void handleApplyPull();
	              }}
	              disabled={syncBusy || unresolvedPullConflictCount > 0}
	              style={({ pressed }) => [
	                styles.primaryButton,
	                (syncBusy || unresolvedPullConflictCount > 0) && styles.buttonDisabled,
	                pressed &&
	                  !syncBusy &&
	                  unresolvedPullConflictCount === 0 &&
	                  styles.pressed,
	              ]}
	            >
              <Text style={styles.primaryButtonText}>
                {syncBusy ? 'Uygulanıyor...' : 'Pull uygula'}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {transferQueueSummary ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Transfer kuyruğu</Text>
          <Text style={styles.cardText}>
            Pull sırasında biriken dosya indirmeleri burada kalır. Uygulama kapanırsa
            kuyruk kaybolmaz; buradan sürdürüp başarısız olanları yeniden deneyebilirsin.
          </Text>

          <View style={styles.heroPillRow}>
            <InfoPill
              label={`${transferQueueSummary.pendingCount} bekliyor`}
              tone={transferQueueSummary.pendingCount > 0 ? 'accent' : 'default'}
            />
            <InfoPill
              label={`${transferQueueSummary.runningCount} aktif`}
              tone={transferQueueSummary.runningCount > 0 ? 'accent' : 'default'}
            />
            <InfoPill
              label={`${transferQueueSummary.failedCount} başarısız`}
              tone={transferQueueSummary.failedCount > 0 ? 'warning' : 'default'}
            />
            <InfoPill
              label={`${transferQueueSummary.completedCount} tamamlandı`}
              tone={transferQueueSummary.completedCount > 0 ? 'success' : 'default'}
            />
          </View>

          <SettingRow
            label="Toplam kayıt"
            value={String(transferQueueSummary.totalCount)}
          />
          <SettingRow
            label="Sürdürülebilir kayıt"
            value={String(transferQueueSummary.resumableCount)}
          />
          <SettingRow
            label="Son tamamlanan"
            value={formatDateTime(transferQueueSummary.lastCompletedAt)}
          />
          <SettingRow
            label="Son hata"
            value={formatDateTime(transferQueueSummary.lastFailedAt)}
          />

          <View style={styles.inlineActionRow}>
            <Pressable
              onPress={() => {
                void handleRefreshTransferQueue();
              }}
              disabled={syncBusy}
              style={({ pressed }) => [
                styles.secondaryButton,
                syncBusy && styles.buttonDisabled,
                pressed && !syncBusy && styles.pressed,
              ]}
            >
              <Text style={styles.secondaryButtonText}>Kuyruğu yenile</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                void handleProcessTransferQueue();
              }}
              disabled={
                syncBusy ||
                transferQueueSummary.pendingCount + transferQueueSummary.runningCount === 0
              }
              style={({ pressed }) => [
                styles.primaryButton,
                (syncBusy ||
                  transferQueueSummary.pendingCount + transferQueueSummary.runningCount === 0) &&
                  styles.buttonDisabled,
                pressed &&
                  !syncBusy &&
                  transferQueueSummary.pendingCount + transferQueueSummary.runningCount > 0 &&
                  styles.pressed,
              ]}
            >
              <Text style={styles.primaryButtonText}>
                {syncBusy ? 'İşleniyor...' : 'İndirmeleri sürdür'}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                void handleRetryFailedTransfers();
              }}
              disabled={syncBusy || transferQueueSummary.failedCount === 0}
              style={({ pressed }) => [
                styles.secondaryButton,
                (syncBusy || transferQueueSummary.failedCount === 0) && styles.buttonDisabled,
                pressed &&
                  !syncBusy &&
                  transferQueueSummary.failedCount > 0 &&
                  styles.pressed,
              ]}
            >
              <Text style={styles.secondaryButtonText}>Başarısızları yeniden dene</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                void handleClearCompletedTransfers();
              }}
              disabled={syncBusy || transferQueueSummary.completedCount === 0}
              style={({ pressed }) => [
                styles.secondaryButton,
                (syncBusy || transferQueueSummary.completedCount === 0) && styles.buttonDisabled,
                pressed &&
                  !syncBusy &&
                  transferQueueSummary.completedCount > 0 &&
                  styles.pressed,
              ]}
            >
              <Text style={styles.secondaryButtonText}>Tamamlananları temizle</Text>
            </Pressable>
          </View>

          {transferQueueSummary.recentTasks.length > 0 ? (
            <View style={styles.transferTaskList}>
              {transferQueueSummary.recentTasks.map((task) => (
                <View key={task.id} style={styles.transferTaskRow}>
                  <Text style={styles.transferTaskTitle}>
                    {task.fileName ?? `${getTransferEntityLabel(task.entityType)} dosyası`}
                  </Text>
                  <Text style={styles.transferTaskMeta}>
                    {getTransferEntityLabel(task.entityType)} • {getTransferTaskStatusLabel(task.status)} • Deneme:{' '}
                    {task.attemptCount}
                  </Text>
                  <Text style={styles.transferTaskMeta}>
                    Son işlem: {formatDateTime(task.completedAt ?? task.lastAttemptAt ?? task.enqueuedAt)}
                  </Text>
                  {task.lastError ? (
                    <Text style={styles.transferTaskError}>{task.lastError}</Text>
                  ) : null}
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.cardHint}>Henüz transfer kuyruğunda kayıt yok.</Text>
          )}
        </View>
      ) : null}

      {observabilitySnapshot ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Observability</Text>
          <Text style={styles.cardText}>
            Beta aşamasında son auth, sync ve lifecycle olaylarını burada görürsün.
            Gerçek analytics ve crash provider bağlandığında aynı yüzey ürün
            telemetrisi için yaşamaya devam edecek.
          </Text>

          <View style={styles.heroPillRow}>
            <InfoPill
              label={observabilitySnapshot.analyticsRuntimeLabel}
              tone={observabilitySnapshot.enabled ? 'success' : 'default'}
            />
            <InfoPill
              label={observabilitySnapshot.crashRuntimeLabel}
              tone={observabilitySnapshot.enabled ? 'success' : 'default'}
            />
            <InfoPill
              label={`${observabilitySnapshot.errorCount} hata`}
              tone={observabilitySnapshot.errorCount > 0 ? 'warning' : 'default'}
            />
          </View>

          <SettingRow
            label="Toplam event"
            value={String(observabilitySnapshot.totalCount)}
          />
          <SettingRow
            label="Bilgi kayıtları"
            value={String(observabilitySnapshot.infoCount)}
          />
          <SettingRow
            label="Uyarılar"
            value={String(observabilitySnapshot.warningCount)}
          />
          <SettingRow
            label="Hatalar"
            value={String(observabilitySnapshot.errorCount)}
          />
          <SettingRow
            label="Son event"
            value={formatDateTime(observabilitySnapshot.lastEventAt)}
          />
          <SettingRow
            label="Son hata"
            value={formatDateTime(observabilitySnapshot.lastErrorAt)}
          />

          <View style={styles.inlineActionRow}>
            <Pressable
              onPress={() => {
                void handleRefreshObservability();
              }}
              disabled={observabilityBusy}
              style={({ pressed }) => [
                styles.secondaryButton,
                observabilityBusy && styles.buttonDisabled,
                pressed && !observabilityBusy && styles.pressed,
              ]}
            >
              <Text style={styles.secondaryButtonText}>
                {observabilityBusy ? 'Yenileniyor...' : 'Eventleri yenile'}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                void handleClearObservability();
              }}
              disabled={observabilityBusy || observabilitySnapshot.totalCount === 0}
              style={({ pressed }) => [
                styles.secondaryButton,
                (observabilityBusy || observabilitySnapshot.totalCount === 0) &&
                  styles.buttonDisabled,
                pressed &&
                  !observabilityBusy &&
                  observabilitySnapshot.totalCount > 0 &&
                  styles.pressed,
              ]}
            >
              <Text style={styles.secondaryButtonText}>Eventleri temizle</Text>
            </Pressable>
          </View>

          {observabilitySnapshot.recentEvents.length > 0 ? (
            <View style={styles.observabilityEventList}>
              {observabilitySnapshot.recentEvents.map((event) => (
                <View key={event.id} style={styles.observabilityEventRow}>
                  <View style={styles.observabilityEventHeader}>
                    <Text style={styles.observabilityEventTitle}>{event.name}</Text>
                    <InfoPill
                      label={getObservabilityLevelLabel(event.level)}
                      tone={event.level === 'info' ? 'default' : 'warning'}
                    />
                  </View>
                  <Text style={styles.observabilityEventMeta}>
                    {event.feature} • {event.source} • {formatDateTime(event.timestamp)}
                  </Text>
                  {event.message ? (
                    <Text style={styles.observabilityEventMessage}>{event.message}</Text>
                  ) : null}
                  {event.metadata ? (
                    <Text style={styles.observabilityEventMeta}>
                      {JSON.stringify(event.metadata)}
                    </Text>
                  ) : null}
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.cardHint}>Henüz observability eventi yok.</Text>
          )}
        </View>
      ) : null}

      {appRuntime.authProvider === 'custom' ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Custom Sync API</Text>
          <SettingRow
            label="Durum"
            value={getWorkspaceSyncRemoteRuntimeStatusLabel()}
          />
          <SettingRow
            label="Base URL"
            value={workspaceSyncRemoteRuntimeConfig.baseUrl ?? 'Tanımlı değil'}
          />
          <SettingRow
            label="Preflight yolu"
            value={workspaceSyncRemoteRuntimeConfig.preflightPath}
          />
          <SettingRow
            label="Push yolu"
            value={workspaceSyncRemoteRuntimeConfig.pushPath}
          />
          <SettingRow
            label="Pull yolu"
            value={workspaceSyncRemoteRuntimeConfig.pullPath}
          />
          <Text style={styles.cardHint}>
            {isCustomWorkspaceSyncConfigured()
              ? 'Hazırlık kontrolü bu endpointlere bağlandı. Sonraki sprintte delta push/pull akışı aynı kontrat üzerinden ilerleyecek.'
              : 'Sync base URL tanımlı değilse auth base URL fallback kullanılır. İkisi de yoksa sync kontrolü sadece local özet üretir.'}
          </Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Çalışma alanları</Text>
        <Text style={styles.cardText}>
          Aktif şirket bağlamını burada değiştirebilirsin. Bu seçim kaşe kütüphanesi
          ve sonraki sync katmanı için oturum bağlamı olarak kullanılacak.
        </Text>

        <View style={styles.workspaceList}>
          {workspaces.length === 0 ? (
            <Text style={styles.cardHint}>Henüz kullanılabilir çalışma alanı yok.</Text>
          ) : (
            workspaces.map((workspace) => {
              const active = workspace.id === session?.activeWorkspaceId;
              const switching = switchingWorkspaceId === workspace.id;

              return (
                <Pressable
                  key={workspace.id}
                  onPress={() => {
                    void handleSwitchWorkspace(workspace.id);
                  }}
                  disabled={busy || switching || active}
                  style={({ pressed }) => [
                    styles.workspaceRow,
                    active && styles.workspaceRowActive,
                    pressed && !busy && !switching && !active && styles.pressed,
                  ]}
                >
                  <View style={styles.workspaceRowTextWrap}>
                    <Text style={styles.workspaceRowTitle}>{workspace.name}</Text>
                    <Text style={styles.workspaceRowSubtitle}>
                      {getAuthWorkspaceRoleLabel(workspace.role)} •{' '}
                      {workspace.isPersonal ? 'Kişisel' : 'Kurumsal'}
                    </Text>
                  </View>

                  <Text style={styles.workspaceRowMeta}>
                    {switching ? 'Geçiliyor...' : active ? 'Aktif' : 'Geç'}
                  </Text>
                </Pressable>
              );
            })
          )}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Tarama kalitesi ve boyutu</Text>

        <View style={styles.chipRow}>
          <ChoiceChip
            label="Kompakt"
            selected={scanQuality === 'compact'}
            onPress={() => setScanQuality('compact')}
          />
          <ChoiceChip
            label="Dengeli"
            selected={scanQuality === 'balanced'}
            onPress={() => setScanQuality('balanced')}
          />
          <ChoiceChip
            label="Yüksek"
            selected={scanQuality === 'high'}
            onPress={() => setScanQuality('high')}
          />
        </View>

        <Text style={styles.cardHint}>{qualityDescription}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Tanıma dili</Text>

        <View style={styles.chipRow}>
          <ChoiceChip
            label="Türkçe"
            selected={recognitionLanguage === 'tr'}
            onPress={() => setRecognitionLanguage('tr')}
          />
          <ChoiceChip
            label="İngilizce"
            selected={recognitionLanguage === 'en'}
            onPress={() => setRecognitionLanguage('en')}
          />
          <ChoiceChip
            label="Çok dilli"
            selected={recognitionLanguage === 'multi'}
            onPress={() => setRecognitionLanguage('multi')}
          />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Tarama sonrası davranış</Text>

        <ToggleRow
          title="Orijinal görüntüleri Fotoğraflar’a kaydet"
          subtitle="Ham giriş görsellerini cihaz galerisine yazar."
          value={saveOriginalsToPhotos}
          onPress={() => setSaveOriginalsToPhotos((value) => !value)}
        />

        <View style={styles.separator} />

        <ToggleRow
          title="Taramaları Fotoğraflar’a kaydet"
          subtitle="İyileştirilmiş çıktı görsellerini galeride tutar."
          value={saveScansToPhotos}
          onPress={() => setSaveScansToPhotos((value) => !value)}
        />

        <View style={styles.separator} />

        <ToggleRow
          title="Kamera ile başlat"
          subtitle="Tara akışında varsayılan olarak kamera seçili açılır."
          value={startWithCamera}
          onPress={() => setStartWithCamera((value) => !value)}
        />

        <View style={styles.separator} />

        <ToggleRow
          title="Lens temizleme ipuçları"
          subtitle="Tarama öncesi kısa kamera kalite hatırlatmaları gösterir."
          value={lensTipsEnabled}
          onPress={() => setLensTipsEnabled((value) => !value)}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Kaşe işleme</Text>
        <Text style={styles.cardText}>
          Kaşe kütüphanesi yerel optimizasyon, önizleme üretimi ve orijinale dönüş
          akışına hazır. Arka planı gerçekten temizlemek için şeffaf PNG kullanmak
          en doğru üretim akışıdır.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Durum</Text>
        <Text style={styles.cardText}>
          Bu ekran local-first ayar shell’i olarak hazırlandı. Persist edilen ayar
          store’u sonraki turda bağlanabilir.
        </Text>
      </View>

      <Pressable
        disabled={busy}
        onPress={handleLogout}
        style={({ pressed }) => [
          styles.logoutButton,
          busy && styles.logoutButtonDisabled,
          pressed && !busy && styles.pressed,
        ]}
      >
        <Text style={styles.logoutButtonText}>
          {busy ? 'Çıkış yapılıyor...' : 'Çıkış yap'}
        </Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    gap: Spacing.sm,
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  heroEyebrow: {
    ...Typography.caption,
    color: colors.primary,
    letterSpacing: 1.1,
    fontWeight: '800',
  },
  heroTitle: {
    ...Typography.titleLarge,
    color: colors.text,
  },
  heroText: {
    ...Typography.body,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  heroPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  infoPill: {
    minHeight: 30,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  infoPillAccent: {
    borderColor: 'rgba(59, 130, 246, 0.28)',
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
  },
  infoPillSuccess: {
    borderColor: 'rgba(53, 199, 111, 0.28)',
    backgroundColor: 'rgba(53, 199, 111, 0.12)',
  },
  infoPillWarning: {
    borderColor: 'rgba(245, 158, 11, 0.24)',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
  },
  infoPillText: {
    ...Typography.caption,
    color: colors.textSecondary,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  infoPillTextAccent: {
    color: '#60A5FA',
  },
  infoPillTextSuccess: {
    color: colors.primary,
  },
  infoPillTextWarning: {
    color: '#FBBF24',
  },
  runtimeNoticeCard: {
    backgroundColor: colors.card,
    borderColor: 'rgba(245, 158, 11, 0.22)',
    borderWidth: 1,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  runtimeNoticeTextWrap: {
    gap: 4,
  },
  runtimeNoticeTitle: {
    ...Typography.titleSmall,
    color: colors.text,
  },
  runtimeNoticeText: {
    ...Typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    gap: Spacing.sm,
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  cardTitle: {
    ...Typography.titleSmall,
    color: colors.text,
  },
  cardText: {
    ...Typography.body,
    color: colors.textSecondary,
  },
  workspaceList: {
    gap: Spacing.sm,
  },
  workspaceRow: {
    minHeight: 60,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  workspaceRowActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryMuted,
  },
  workspaceRowTextWrap: {
    flex: 1,
    gap: 2,
  },
  workspaceRowTitle: {
    ...Typography.body,
    color: colors.text,
    fontWeight: '800',
  },
  workspaceRowSubtitle: {
    ...Typography.bodySmall,
    color: colors.textSecondary,
  },
  workspaceRowMeta: {
    ...Typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: '800',
  },
  cardHint: {
    ...Typography.bodySmall,
    color: colors.textTertiary,
  },
  inlineActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  primaryButton: {
    minHeight: 44,
    borderRadius: Radius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  primaryButtonText: {
    ...Typography.bodySmall,
    color: colors.onPrimary,
    fontWeight: '800',
  },
  secondaryButton: {
    minHeight: 44,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  secondaryButtonText: {
    ...Typography.bodySmall,
    color: colors.text,
    fontWeight: '800',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  conflictList: {
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  conflictHelperText: {
    ...Typography.bodySmall,
    color: colors.textSecondary,
  },
  conflictRow: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: 2,
  },
  conflictTitle: {
    ...Typography.bodySmall,
    color: colors.text,
    fontWeight: '800',
  },
  conflictMeta: {
    ...Typography.caption,
    color: colors.textSecondary,
  },
  conflictResolutionText: {
    ...Typography.caption,
    color: colors.primary,
    fontWeight: '700',
  },
  transferTaskList: {
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  transferTaskRow: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: 2,
  },
  transferTaskTitle: {
    ...Typography.bodySmall,
    color: colors.text,
    fontWeight: '800',
  },
  transferTaskMeta: {
    ...Typography.caption,
    color: colors.textSecondary,
  },
  transferTaskError: {
    ...Typography.caption,
    color: '#FBBF24',
    fontWeight: '700',
  },
  observabilityEventList: {
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  observabilityEventRow: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: 4,
  },
  observabilityEventHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  observabilityEventTitle: {
    ...Typography.bodySmall,
    color: colors.text,
    fontWeight: '800',
    flex: 1,
  },
  observabilityEventMeta: {
    ...Typography.caption,
    color: colors.textSecondary,
  },
  observabilityEventMessage: {
    ...Typography.caption,
    color: '#FBBF24',
    fontWeight: '700',
  },
  settingRow: {
    gap: 2,
  },
  settingLabel: {
    ...Typography.caption,
    color: colors.textTertiary,
  },
  settingValue: {
    ...Typography.body,
    color: colors.text,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  chip: {
    minHeight: 40,
    paddingHorizontal: Spacing.md,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    ...Typography.bodySmall,
    color: colors.text,
    fontWeight: '700',
  },
  chipTextSelected: {
    color: colors.onPrimary,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  toggleTextBlock: {
    flex: 1,
    gap: 2,
  },
  toggleTitle: {
    ...Typography.body,
    color: colors.text,
    fontWeight: '700',
  },
  toggleSubtitle: {
    ...Typography.bodySmall,
    color: colors.textSecondary,
  },
  switchBase: {
    width: 50,
    height: 30,
    borderRadius: 999,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 3,
    justifyContent: 'center',
  },
  switchBaseActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  switchKnob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.text,
  },
  switchKnobActive: {
    alignSelf: 'flex-end',
    backgroundColor: colors.onPrimary,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: Spacing.xs,
  },
  logoutButton: {
    backgroundColor: '#1F1720',
    borderColor: '#4B2632',
    borderWidth: 1,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    marginTop: Spacing.xs,
  },
  logoutButtonDisabled: {
    opacity: 0.65,
  },
  logoutButtonText: {
    ...Typography.label,
    color: colors.danger,
    textAlign: 'center',
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.92,
  },
});
