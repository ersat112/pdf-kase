import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  InteractionManager,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { executeToolPrimaryAction } from '../../features/tools/tools.actions';
import { findToolByKey, scanLauncherKeys } from '../../features/tools/tools.registry';
import type { ToolDefinition } from '../../features/tools/tools.types';
import {
  createDraftFromImportedImage,
  createDraftFromScannedImages,
  importDocumentsFromPickedFiles,
} from '../../modules/documents/document.service';
import { launchNativeScanner } from '../../modules/scanner/scanner.service';
import type {
  AppTabParamList,
  RootStackParamList,
  ScanEntryLaunchMode,
} from '../../navigation/types';
import { Radius, Shadows, Spacing, Typography, colors } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'ScanEntry'>;

type QrScanResult = {
  type: string;
  data: string;
};

type LauncherSettingKey =
  | 'autoCapture'
  | 'grid'
  | 'rotateByText'
  | 'volumeCapture'
  | 'autoCrop';

type LauncherSettingsState = Record<LauncherSettingKey, boolean>;

type CaptureTone = 'Renkli' | 'Gri' | 'Siyah Beyaz';
type CaptureCountMode = 'single' | 'multi';

type EntryModeSurfaceCopy = {
  eyebrow: string;
  title: string;
  description: string;
  helper: string;
  primaryActionLabel: string;
};

const AUTO_RUN_MODES: ReadonlySet<ScanEntryLaunchMode> = new Set([
  'camera',
  'import-images',
  'import-files',
  'id-card',
]);

const SETTING_LABELS: Record<LauncherSettingKey, string> = {
  autoCapture: 'Otomatik Yakala',
  grid: 'Izgara',
  rotateByText: 'Metin Yönüne Göre Döndür',
  volumeCapture: 'Ses Düğmesi ile Yakala',
  autoCrop: 'Otomatik Kırp',
};

const TONE_OPTIONS: CaptureTone[] = ['Renkli', 'Gri', 'Siyah Beyaz'];

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message.trim().length > 0
    ? error.message
    : fallback;
}

function getInitialLauncherKey(initialMode?: ScanEntryLaunchMode) {
  switch (initialMode) {
    case 'import-images':
      return 'import-images';
    case 'import-files':
      return 'import-files';
    case 'id-card':
      return 'scan-id-card';
    case 'enhance-photo':
      return 'edit-enhance-photo';
    case 'qr':
      return 'utility-qr';
    case 'camera':
    default:
      return 'scan-camera';
  }
}

function looksLikeUrl(value: string) {
  return /^https?:\/\//i.test(value.trim());
}

function buildLauncherTools() {
  return scanLauncherKeys
    .map((key) => findToolByKey(key))
    .filter((tool): tool is ToolDefinition => Boolean(tool))
    .filter(
      (tool) =>
        tool.availability === 'ready' &&
        tool.routeTarget === 'ScanEntry' &&
        tool.scanLauncherVisible !== false,
    );
}

function resolveModeLabel(tool: ToolDefinition) {
  return tool.title;
}

function isScannerMode(mode?: ScanEntryLaunchMode) {
  return mode === 'camera' || mode === 'enhance-photo' || mode === 'id-card';
}

function isLivePreviewMode(mode?: ScanEntryLaunchMode) {
  return isScannerMode(mode) || mode === 'qr';
}

function resolveEntryModeSurfaceCopy(tool: ToolDefinition | null): EntryModeSurfaceCopy {
  const mode = tool?.scanEntryMode;

  switch (mode) {
    case 'camera':
      return {
        eyebrow: 'Belgeyi al',
        title: 'Tek akış belge tarama',
        description:
          'Belgeyi tara, sayfaları tek dosyada topla ve doğrudan düzenleme akışına geç.',
        helper:
          'Deklanşöre bastığında native scanner açılır. Sonuç belge detaya ve editöre taşınır.',
        primaryActionLabel: tool?.primaryActionLabel ?? 'Taramayı başlat',
      };
    case 'enhance-photo':
      return {
        eyebrow: 'Düzeltme odaklı giriş',
        title: 'Fotoğrafı belgeye çevir',
        description:
          'Perspektif düzeltme, temiz sayfa görünümü ve daha iyi çıktı için belgeyi iyileştirme akışından başlat.',
        helper:
          'Bu giriş taramayı başlatır; devamında belge detayı ve editör yüzeyi kullanılır.',
        primaryActionLabel: tool?.primaryActionLabel ?? 'İyileştirme akışını aç',
      };
    case 'id-card':
      return {
        eyebrow: 'Kimlik tarama',
        title: 'Ön ve arka yüzü düzenli topla',
        description:
          'Kimlik odaklı giriş akışı ile kartı hızlıca belgeye dönüştür ve sonraki OCR adımına hazırla.',
        helper:
          'Tarama sonrası sayfalar belge olarak kaydedilir; detay ekranından OCR ve export devam eder.',
        primaryActionLabel: tool?.primaryActionLabel ?? 'Kimlik taramayı başlat',
      };
    case 'import-images':
      return {
        eyebrow: 'Galeriden belge',
        title: 'Görselleri tek dosyada topla',
        description:
          'Galeriden bir veya birden fazla görsel seç, sayfa sırasıyla belge taslağına dönüştür.',
        helper:
          'Tek seçimde hızlı taslak, çoklu seçimde çok sayfalı belge oluşturulur.',
        primaryActionLabel: tool?.primaryActionLabel ?? 'Görsel seç',
      };
    case 'import-files':
      return {
        eyebrow: 'PDF ve dosya içe aktar',
        title: 'Hazır dosyayı belge havuzuna al',
        description:
          'PDF ve görsel dosyalarını tek yüzeyden içe aktar, ardından belge detayı veya kütüphaneden devam et.',
        helper:
          'PDF hazır belge olarak, görseller ise yeni sayfa taslağı olarak kaydedilir.',
        primaryActionLabel: tool?.primaryActionLabel ?? 'Dosya seç',
      };
    case 'qr':
      return {
        eyebrow: 'Canlı QR tarama',
        title: 'Bağlantıyı veya metni anında yakala',
        description:
          'Kamera QR kodu canlı okur. URL ise doğrudan açabilir, metin ise kopyalayabilirsin.',
        helper:
          'Torch sadece QR modunda görünür. İlk okutulan sonuç kilitlenir ve kartta gösterilir.',
        primaryActionLabel: tool?.primaryActionLabel ?? 'QR tarayıcıyı aç',
      };
    default:
      return {
        eyebrow: 'Belge girişi',
        title: tool?.title ?? 'Belge akışı',
        description:
          tool?.shortDescription ??
          'Belgeyi al, düzenle, OCR uygula ve sonucu paylaşılabilir çıktıya dönüştür.',
        helper:
          tool?.longDescription ??
          'Bu yüzey belge akışını başlatmak için kullanılır.',
        primaryActionLabel: tool?.primaryActionLabel ?? 'Akışı başlat',
      };
  }
}

function ToggleRow({
  label,
  value,
  onPress,
}: {
  label: string;
  value: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.settingsRow, pressed && styles.pressed]}
    >
      <Text style={styles.settingsRowLabel}>{label}</Text>
      <View style={[styles.settingsPill, value && styles.settingsPillActive]}>
        <Text
          style={[styles.settingsPillText, value && styles.settingsPillTextActive]}
        >
          {value ? 'ON' : 'OFF'}
        </Text>
      </View>
    </Pressable>
  );
}

function ModeChip({
  title,
  active,
  onPress,
}: {
  title: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.modeChip,
        active && styles.modeChipActive,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.modeChipText, active && styles.modeChipTextActive]}>
        {title}
      </Text>
    </Pressable>
  );
}

function FocusBadge({ label }: { label: string }) {
  return (
    <View style={styles.focusBadge}>
      <Text style={styles.focusBadgeText}>{label}</Text>
    </View>
  );
}

export function ScanEntryScreen({ navigation, route }: Props) {
  const launcherTools = useMemo(() => buildLauncherTools(), []);

  const initialLauncherKey = useMemo(
    () => getInitialLauncherKey(route.params?.initialMode),
    [route.params?.initialMode],
  );

  const autoLaunchSignature = useMemo(() => {
    const initialMode = route.params?.initialMode;

    if (!initialMode) {
      return null;
    }

    return `${route.key}:${initialMode}`;
  }, [route.key, route.params?.initialMode]);

  const [selectedToolKey, setSelectedToolKey] = useState(initialLauncherKey);
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('Belge akışı hazırlanıyor...');
  const [qrEnabled, setQrEnabled] = useState(false);
  const [qrTorchEnabled, setQrTorchEnabled] = useState(false);
  const [qrResult, setQrResult] = useState<QrScanResult | null>(null);

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const [captureCountMode, setCaptureCountMode] =
    useState<CaptureCountMode>('single');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tonePickerOpen, setTonePickerOpen] = useState(false);
  const [captureTone, setCaptureTone] = useState<CaptureTone>('Renkli');
  const [hdEnabled, setHdEnabled] = useState(true);
  const [launcherSettings, setLauncherSettings] = useState<LauncherSettingsState>({
    autoCapture: true,
    grid: false,
    rotateByText: true,
    volumeCapture: false,
    autoCrop: true,
  });

  const loadingRef = useRef(false);
  const autoLaunchHandledRef = useRef<string | null>(null);
  const qrScanLockedRef = useRef(false);

  const selectedTool = useMemo(() => {
    return (
      launcherTools.find((tool) => tool.key === selectedToolKey) ??
      launcherTools[0] ??
      null
    );
  }, [launcherTools, selectedToolKey]);

  const selectedMode = selectedTool?.scanEntryMode;
  const isQrMode = selectedMode === 'qr';
  const showScannerControls = isScannerMode(selectedMode);
  const showLivePreview = isLivePreviewMode(selectedMode);
  const focusCopy = useMemo(
    () => resolveEntryModeSurfaceCopy(selectedTool),
    [selectedTool],
  );

  useEffect(() => {
    setSelectedToolKey(initialLauncherKey);
  }, [initialLauncherKey]);

  useEffect(() => {
    if (selectedTool?.scanEntryMode !== 'qr') {
      setQrEnabled(false);
      setQrTorchEnabled(false);
      setQrResult(null);
      qrScanLockedRef.current = false;
    }
  }, [selectedTool?.scanEntryMode]);

  useEffect(() => {
    if (!showScannerControls) {
      setSettingsOpen(false);
      setTonePickerOpen(false);
    }
  }, [showScannerControls]);

  const beginLoading = useCallback((message: string) => {
    if (loadingRef.current) {
      return false;
    }

    loadingRef.current = true;
    setLoadingText(message);
    setLoading(true);
    return true;
  }, []);

  const endLoading = useCallback(() => {
    loadingRef.current = false;
    setLoading(false);
    setLoadingText('Belge akışı hazırlanıyor...');
  }, []);

  const navigateToHomeTab = useCallback(
    (
      screen: keyof Pick<
        AppTabParamList,
        'HomeTab' | 'DocumentsTab' | 'ToolsTab' | 'MeTab'
      >,
    ) => {
      navigation.navigate('Home', { screen });
    },
    [navigation],
  );

  const handlePickFromGallery = useCallback(async () => {
    if (!beginLoading('Galeri hazırlanıyor...')) {
      return;
    }

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          'İzin gerekli',
          permission.canAskAgain
            ? 'Galeriden belge seçmek için izin vermelisin.'
            : 'Galeri izni kapalı. Cihaz ayarlarından erişim iznini açmalısın.',
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: false,
        allowsMultipleSelection: true,
        quality: 1,
        selectionLimit: 10,
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        orderedSelection: true,
      });

      if (result.canceled || !result.assets?.length) {
        return;
      }

      const uris = result.assets
        .map((asset) => asset.uri)
        .filter((uri): uri is string => typeof uri === 'string' && uri.length > 0);

      if (!uris.length) {
        throw new Error('Seçilen görseller okunamadı.');
      }

      setLoadingText('Belge taslağı oluşturuluyor...');

      const created =
        uris.length === 1
          ? await createDraftFromImportedImage(uris[0])
          : await createDraftFromScannedImages(uris);

      navigation.replace('DocumentDetail', {
        documentId: created.documentId,
      });
    } catch (error) {
      Alert.alert(
        'Hata',
        getErrorMessage(
          error,
          'Galeriden belge eklenirken beklenmeyen hata oluştu.',
        ),
      );
    } finally {
      endLoading();
    }
  }, [beginLoading, endLoading, navigation]);

  const handlePickFiles = useCallback(async () => {
    if (!beginLoading('Dosya seçici açılıyor...')) {
      return;
    }

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        multiple: true,
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.length) {
        return;
      }

      setLoadingText('Dosyalar içe aktarılıyor...');

      const imported = await importDocumentsFromPickedFiles(
        result.assets.map((asset) => ({
          uri: asset.uri,
          name: asset.name,
          mimeType: asset.mimeType ?? null,
        })),
      );

      if (imported.createdCount === 1) {
        navigation.replace('DocumentDetail', {
          documentId: imported.firstDocumentId,
        });
        return;
      }

      const infoParts: string[] = [`${imported.createdCount} belge oluşturuldu.`];

      if (imported.importedImageCount > 0) {
        infoParts.push(`${imported.importedImageCount} görsel içeri aktarıldı.`);
      }

      if (imported.importedPdfCount > 0) {
        infoParts.push(`${imported.importedPdfCount} PDF belge olarak kaydedildi.`);
      }

      if (imported.unsupportedFiles.length > 0) {
        infoParts.push(
          `Desteklenmeyen dosyalar atlandı: ${imported.unsupportedFiles.join(', ')}`,
        );
      }

      Alert.alert('İçe aktarma tamamlandı', infoParts.join('\n'));
      navigation.navigate('Documents');
    } catch (error) {
      Alert.alert(
        'Hata',
        getErrorMessage(
          error,
          'Dosyalar içe aktarılırken beklenmeyen hata oluştu.',
        ),
      );
    } finally {
      endLoading();
    }
  }, [beginLoading, endLoading, navigation]);

  const handleScanWithCamera = useCallback(
    async (options?: { startText?: string; progressText?: string }) => {
      if (!beginLoading(options?.startText ?? 'Tarayıcı açılıyor...')) {
        return;
      }

      try {
        const result = await launchNativeScanner();

        if (result.status === 'cancel' || result.pages.length === 0) {
          return;
        }

        setLoadingText(
          options?.progressText ?? 'Taranan sayfalar belgeye dönüştürülüyor...',
        );

        const created = await createDraftFromScannedImages(
          result.pages.map((page) => page.normalizedUri),
        );

        navigation.replace('DocumentDetail', {
          documentId: created.documentId,
        });
      } catch (error) {
        Alert.alert(
          'Hata',
          getErrorMessage(
            error,
            'Belge tarama sırasında beklenmeyen hata oluştu.',
          ),
        );
      } finally {
        endLoading();
      }
    },
    [beginLoading, endLoading, navigation],
  );

  const handleStartQrScanner = useCallback(async () => {
    if (loadingRef.current) {
      return;
    }

    if (!cameraPermission?.granted) {
      const requested = await requestCameraPermission();

      if (!requested.granted) {
        Alert.alert(
          'İzin gerekli',
          requested.canAskAgain
            ? 'QR taramak için kamera izni vermelisin.'
            : 'Kamera izni kapalı. Cihaz ayarlarından erişim iznini açmalısın.',
        );
        return;
      }
    }

    qrScanLockedRef.current = false;
    setQrResult(null);
    setQrEnabled(true);
  }, [cameraPermission?.granted, requestCameraPermission]);

  const handleQrScanned = useCallback((event: { data: string; type: string }) => {
    if (qrScanLockedRef.current) {
      return;
    }

    const data = event.data?.trim();

    if (!data) {
      return;
    }

    qrScanLockedRef.current = true;
    setQrResult({
      data,
      type: event.type,
    });
  }, []);

  const handleOpenQrResult = useCallback(async () => {
    if (!qrResult || !looksLikeUrl(qrResult.data)) {
      return;
    }

    try {
      const supported = await Linking.canOpenURL(qrResult.data);

      if (!supported) {
        Alert.alert('Açılamadı', 'Okutulan bağlantı cihazda açılamıyor.');
        return;
      }

      await Linking.openURL(qrResult.data);
    } catch (error) {
      Alert.alert(
        'Hata',
        getErrorMessage(error, 'QR içeriği açılırken hata oluştu.'),
      );
    }
  }, [qrResult]);

  const handleSelectedToolAction = useCallback(
    async (tool: ToolDefinition) => {
      if (tool.routeTarget === 'ScanEntry') {
        switch (tool.scanEntryMode) {
          case 'camera':
            await handleScanWithCamera({
              startText: 'Tarayıcı açılıyor...',
              progressText: 'Taranan sayfalar belgeye dönüştürülüyor...',
            });
            return;
          case 'enhance-photo':
            await handleScanWithCamera({
              startText: 'İyileştirme için tarayıcı açılıyor...',
              progressText: 'Belge iyileştirme taslağı hazırlanıyor...',
            });
            return;
          case 'id-card':
            await handleScanWithCamera({
              startText: 'Kimlik tarama açılıyor...',
              progressText: 'Kimlik sayfaları belgeye dönüştürülüyor...',
            });
            return;
          case 'import-images':
            await handlePickFromGallery();
            return;
          case 'import-files':
            await handlePickFiles();
            return;
          case 'qr':
            await handleStartQrScanner();
            return;
          default:
            break;
        }
      }

      await executeToolPrimaryAction(tool, navigation);
    },
    [
      handlePickFiles,
      handlePickFromGallery,
      handleScanWithCamera,
      handleStartQrScanner,
      navigation,
    ],
  );

  useEffect(() => {
    if (!autoLaunchSignature || !selectedTool) {
      return;
    }

    if (autoLaunchHandledRef.current === autoLaunchSignature) {
      return;
    }

    if (
      selectedTool.routeTarget !== 'ScanEntry' ||
      !selectedTool.scanEntryMode ||
      !AUTO_RUN_MODES.has(selectedTool.scanEntryMode)
    ) {
      return;
    }

    autoLaunchHandledRef.current = autoLaunchSignature;

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const interactionTask = InteractionManager.runAfterInteractions(() => {
      timeoutId = setTimeout(() => {
        if (cancelled) {
          return;
        }

        void handleSelectedToolAction(selectedTool);
      }, 160);
    });

    return () => {
      cancelled = true;

      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      interactionTask.cancel();
    };
  }, [autoLaunchSignature, handleSelectedToolAction, selectedTool]);

  const handlePrimaryCapture = useCallback(() => {
    if (!selectedTool) {
      return;
    }

    void handleSelectedToolAction(selectedTool);
  }, [handleSelectedToolAction, selectedTool]);

  const toggleLauncherSetting = useCallback((key: LauncherSettingKey) => {
    setLauncherSettings((current) => ({
      ...current,
      [key]: !current[key],
    }));
  }, []);

  const handleClose = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    navigation.navigate('Home');
  }, [navigation]);

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <Pressable
            onPress={handleClose}
            style={({ pressed }) => [
              styles.topIconButton,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons name="close" size={22} color={colors.text} />
          </Pressable>

          <View style={styles.topBarCenter}>
            <Text style={styles.topBarTitle}>{focusCopy.title}</Text>
            <Text style={styles.topBarSubtitle}>{focusCopy.eyebrow}</Text>
          </View>

          <View style={styles.topBarRight}>
            {isQrMode ? (
              <Pressable
                onPress={() => setQrTorchEnabled((current) => !current)}
                style={({ pressed }) => [
                  styles.topIconButton,
                  qrTorchEnabled && styles.topIconButtonActive,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons
                  name={qrTorchEnabled ? 'flash' : 'flash-off'}
                  size={18}
                  color={qrTorchEnabled ? colors.onPrimary : colors.text}
                />
              </Pressable>
            ) : null}

            {showScannerControls ? (
              <Pressable
                onPress={() => setHdEnabled((current) => !current)}
                style={({ pressed }) => [
                  styles.topBadgeButton,
                  hdEnabled && styles.topBadgeButtonActive,
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[
                    styles.topBadgeButtonText,
                    hdEnabled && styles.topBadgeButtonTextActive,
                  ]}
                >
                  HD
                </Text>
              </Pressable>
            ) : null}

            {showScannerControls ? (
              <Pressable
                onPress={() => {
                  setTonePickerOpen((current) => !current);
                  setSettingsOpen(false);
                }}
                style={({ pressed }) => [
                  styles.topIconButton,
                  tonePickerOpen && styles.topIconButtonActive,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons
                  name="color-filter-outline"
                  size={18}
                  color={tonePickerOpen ? colors.onPrimary : colors.text}
                />
              </Pressable>
            ) : null}

            {showScannerControls ? (
              <Pressable
                onPress={() => {
                  setSettingsOpen((current) => !current);
                  setTonePickerOpen(false);
                }}
                style={({ pressed }) => [
                  styles.topIconButton,
                  settingsOpen && styles.topIconButtonActive,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons
                  name="ellipsis-horizontal"
                  size={18}
                  color={settingsOpen ? colors.onPrimary : colors.text}
                />
              </Pressable>
            ) : null}
          </View>
        </View>

        {tonePickerOpen ? (
          <View style={styles.panelCard}>
            <Text style={styles.panelTitle}>Renk modu</Text>
            <View style={styles.toneRow}>
              {TONE_OPTIONS.map((tone) => {
                const active = tone === captureTone;

                return (
                  <Pressable
                    key={tone}
                    onPress={() => setCaptureTone(tone)}
                    style={({ pressed }) => [
                      styles.toneChip,
                      active && styles.toneChipActive,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.toneChipText,
                        active && styles.toneChipTextActive,
                      ]}
                    >
                      {tone}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        {settingsOpen ? (
          <View style={styles.panelCard}>
            <Text style={styles.panelTitle}>Tarama ayarları</Text>

            {(Object.keys(SETTING_LABELS) as LauncherSettingKey[]).map((key) => (
              <ToggleRow
                key={key}
                label={SETTING_LABELS[key]}
                value={launcherSettings[key]}
                onPress={() => toggleLauncherSetting(key)}
              />
            ))}
          </View>
        ) : null}

        <View style={styles.previewSection}>
          <View style={styles.previewFrame}>
            {isQrMode && qrEnabled && cameraPermission?.granted ? (
              <CameraView
                style={styles.camera}
                facing="back"
                enableTorch={qrTorchEnabled}
                barcodeScannerSettings={{
                  barcodeTypes: ['qr'],
                }}
                onBarcodeScanned={handleQrScanned}
              />
            ) : (
              <View style={styles.previewPlaceholder}>
                <Text style={styles.previewEyebrow}>{focusCopy.eyebrow}</Text>
                <Text style={styles.previewTitle}>{focusCopy.title}</Text>
                <Text style={styles.previewSubtitle}>{focusCopy.description}</Text>
                <Text style={styles.previewHelper}>{focusCopy.helper}</Text>

                <View style={styles.previewBadgeRow}>
                  <FocusBadge label={captureCountMode === 'single' ? 'Tek çekim' : 'Toplu çekim'} />
                  {showScannerControls ? <FocusBadge label={captureTone} /> : null}
                  {showScannerControls && hdEnabled ? <FocusBadge label="HD" /> : null}
                  {selectedTool?.badges?.slice(0, 2).map((badge) => (
                    <FocusBadge key={badge} label={badge} />
                  ))}
                </View>
              </View>
            )}

            {showLivePreview ? (
              <View pointerEvents="none" style={styles.previewGuideOverlay}>
                <View style={styles.previewGuideBox} />
              </View>
            ) : null}

            {showScannerControls ? (
              <View style={styles.captureCountSwitch}>
                <Pressable
                  onPress={() => setCaptureCountMode('single')}
                  style={({ pressed }) => [
                    styles.captureCountButton,
                    captureCountMode === 'single' && styles.captureCountButtonActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.captureCountButtonText,
                      captureCountMode === 'single' &&
                        styles.captureCountButtonTextActive,
                    ]}
                  >
                    Tek
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => setCaptureCountMode('multi')}
                  style={({ pressed }) => [
                    styles.captureCountButton,
                    captureCountMode === 'multi' && styles.captureCountButtonActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.captureCountButtonText,
                      captureCountMode === 'multi' &&
                        styles.captureCountButtonTextActive,
                    ]}
                  >
                    Toplu
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        </View>

        {qrResult ? (
          <View style={styles.qrResultCard}>
            <Text style={styles.qrResultTitle}>Okutulan içerik</Text>
            <Text style={styles.qrResultType}>{qrResult.type}</Text>
            <Text selectable style={styles.qrResultValue}>
              {qrResult.data}
            </Text>

            {looksLikeUrl(qrResult.data) ? (
              <Pressable
                onPress={() => {
                  void handleOpenQrResult();
                }}
                style={({ pressed }) => [
                  styles.qrOpenButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.qrOpenButtonText}>Bağlantıyı aç</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <View style={styles.bottomSheet}>
          <View style={styles.focusCard}>
            <View style={styles.focusCardTextWrap}>
              <Text style={styles.focusCardTitle}>{focusCopy.title}</Text>
              <Text style={styles.focusCardText}>{focusCopy.description}</Text>
            </View>

            <View style={styles.focusActionPill}>
              <Text style={styles.focusActionPillText}>{focusCopy.primaryActionLabel}</Text>
            </View>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.modeRail}
          >
            {launcherTools.map((tool) => (
              <ModeChip
                key={tool.key}
                title={resolveModeLabel(tool)}
                active={tool.key === selectedToolKey}
                onPress={() => setSelectedToolKey(tool.key)}
              />
            ))}
          </ScrollView>

          <View style={styles.shutterRow}>
            <Pressable
              onPress={() => navigateToHomeTab('ToolsTab')}
              style={({ pressed }) => [
                styles.sideActionButton,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons name="grid-outline" size={22} color={colors.text} />
            </Pressable>

            <Pressable
              onPress={handlePrimaryCapture}
              disabled={loading || !selectedTool}
              style={({ pressed }) => [
                styles.shutterButtonOuter,
                (loading || !selectedTool) && styles.shutterButtonDisabled,
                pressed && !loading && styles.pressed,
              ]}
            >
              <View style={styles.shutterButtonInner} />
            </Pressable>

            <Pressable
              onPress={() => navigation.navigate('Documents')}
              style={({ pressed }) => [
                styles.sideActionButton,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons
                name="document-text-outline"
                size={22}
                color={colors.text}
              />
            </Pressable>
          </View>

          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.loadingText}>{loadingText}</Text>
            </View>
          ) : selectedTool ? (
            <Text style={styles.modeHintText}>
              {resolveModeLabel(selectedTool)} • {focusCopy.primaryActionLabel}
            </Text>
          ) : null}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topBar: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  topBarCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  topBarTitle: {
    ...Typography.titleSmall,
    color: colors.text,
    textAlign: 'center',
  },
  topBarSubtitle: {
    ...Typography.caption,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    minWidth: 40,
    justifyContent: 'flex-end',
  },
  topIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topIconButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  topBadgeButton: {
    minWidth: 46,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
  },
  topBadgeButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  topBadgeButtonText: {
    ...Typography.bodySmall,
    color: colors.text,
    fontWeight: '800',
  },
  topBadgeButtonTextActive: {
    color: colors.onPrimary,
  },
  panelCard: {
    marginTop: Spacing.md,
    marginHorizontal: Spacing.lg,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: Spacing.lg,
    gap: Spacing.sm,
    ...Shadows.sm,
  },
  panelTitle: {
    ...Typography.titleSmall,
    color: colors.text,
  },
  settingsRow: {
    minHeight: 52,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  settingsRowLabel: {
    ...Typography.bodySmall,
    color: colors.text,
    flex: 1,
    fontWeight: '700',
  },
  settingsPill: {
    minWidth: 56,
    borderRadius: Radius.full,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
  },
  settingsPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  settingsPillText: {
    ...Typography.caption,
    color: colors.textSecondary,
    fontWeight: '900',
  },
  settingsPillTextActive: {
    color: colors.onPrimary,
  },
  toneRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  toneChip: {
    minHeight: 40,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toneChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  toneChipText: {
    ...Typography.bodySmall,
    color: colors.text,
    fontWeight: '700',
  },
  toneChipTextActive: {
    color: colors.onPrimary,
  },
  previewSection: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xs,
  },
  previewFrame: {
    flex: 1,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#0A0D12',
    overflow: 'hidden',
    ...Shadows.sm,
  },
  camera: {
    flex: 1,
  },
  previewPlaceholder: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing['2xl'],
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  previewEyebrow: {
    ...Typography.caption,
    color: colors.primary,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  previewTitle: {
    ...Typography.titleLarge,
    color: colors.text,
    textAlign: 'center',
  },
  previewSubtitle: {
    ...Typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
  },
  previewHelper: {
    ...Typography.bodySmall,
    color: colors.textTertiary,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 320,
  },
  previewBadgeRow: {
    marginTop: Spacing.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  focusBadge: {
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(11, 15, 20, 0.64)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
  },
  focusBadgeText: {
    ...Typography.caption,
    color: colors.text,
    fontWeight: '800',
  },
  previewGuideOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
  },
  previewGuideBox: {
    width: '100%',
    height: '82%',
    borderRadius: Radius.xl,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.78)',
    backgroundColor: 'transparent',
  },
  captureCountSwitch: {
    position: 'absolute',
    bottom: Spacing.md,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  captureCountButton: {
    minWidth: 54,
    minHeight: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    backgroundColor: 'rgba(11, 15, 20, 0.64)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.sm,
  },
  captureCountButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  captureCountButtonText: {
    ...Typography.caption,
    color: colors.text,
    fontWeight: '800',
    fontSize: 11,
    lineHeight: 14,
  },
  captureCountButtonTextActive: {
    color: colors.onPrimary,
  },
  qrResultCard: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: Spacing.lg,
    gap: Spacing.sm,
    ...Shadows.sm,
  },
  qrResultTitle: {
    ...Typography.titleSmall,
    color: colors.text,
  },
  qrResultType: {
    ...Typography.caption,
    color: colors.textTertiary,
    textTransform: 'uppercase',
  },
  qrResultValue: {
    ...Typography.body,
    color: colors.text,
  },
  qrOpenButton: {
    marginTop: Spacing.xs,
    alignSelf: 'flex-start',
    borderRadius: Radius.lg,
    backgroundColor: colors.primary,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  qrOpenButtonText: {
    color: colors.onPrimary,
    fontWeight: '800',
  },
  bottomSheet: {
    paddingTop: Spacing.xs,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  focusCard: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: Spacing.md,
    gap: Spacing.md,
    ...Shadows.sm,
  },
  focusCardTextWrap: {
    gap: 4,
  },
  focusCardTitle: {
    ...Typography.titleSmall,
    color: colors.text,
  },
  focusCardText: {
    ...Typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  focusActionPill: {
    alignSelf: 'flex-start',
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  focusActionPillText: {
    ...Typography.bodySmall,
    color: colors.text,
    fontWeight: '800',
  },
  modeRail: {
    gap: Spacing.sm,
    paddingRight: Spacing.md,
  },
  modeChip: {
    minHeight: 40,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  modeChipText: {
    ...Typography.bodySmall,
    color: colors.text,
    fontWeight: '700',
  },
  modeChipTextActive: {
    color: colors.onPrimary,
  },
  shutterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.lg,
  },
  sideActionButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterButtonOuter: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 3,
    borderColor: colors.text,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterButtonDisabled: {
    opacity: 0.6,
  },
  shutterButtonInner: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: colors.text,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  loadingText: {
    ...Typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  modeHintText: {
    ...Typography.bodySmall,
    color: colors.textTertiary,
    textAlign: 'center',
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.92,
  },
});
