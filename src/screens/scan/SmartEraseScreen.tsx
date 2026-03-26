import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  type ViewStyle,
} from 'react-native';

import { Screen } from '../../components/common/Screen';
import {
  getDocumentDetail,
  replaceDocumentPageFromScan,
  type DocumentDetail,
} from '../../modules/documents/document.service';
import {
  applySmartEraseToImage,
  getImageSize,
  type EraseStroke,
} from '../../modules/imaging/imaging.service';
import { removeFileIfExists } from '../../modules/storage/file.service';
import type { RootStackParamList } from '../../navigation/types';
import {
  Radius,
  Shadows,
  Spacing,
  Typography,
  colors,
} from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'SmartErase'>;

type BrushPreset = 'small' | 'medium' | 'large';

type Size = {
  width: number;
  height: number;
};

type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type Point = {
  x: number;
  y: number;
};

const BRUSH_SIZE_RATIO: Record<BrushPreset, number> = {
  small: 0.012,
  medium: 0.02,
  large: 0.032,
};

const MASK_FILL_COLOR = 'rgba(53, 199, 111, 0.32)';
const MASK_BORDER_COLOR = 'rgba(53, 199, 111, 0.68)';
const MASK_CENTER_COLOR = 'rgba(53, 199, 111, 0.92)';

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message.trim().length > 0
    ? error.message
    : fallback;
}

function clamp01(value: number) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 0;
  }

  return Math.max(0, Math.min(1, value));
}

function fitContain(container: Size, content: Size): Rect {
  if (
    container.width <= 0 ||
    container.height <= 0 ||
    content.width <= 0 ||
    content.height <= 0
  ) {
    return {
      x: 0,
      y: 0,
      width: container.width,
      height: container.height,
    };
  }

  const scale = Math.min(
    container.width / content.width,
    container.height / content.height,
  );

  const width = content.width * scale;
  const height = content.height * scale;

  return {
    x: (container.width - width) / 2,
    y: (container.height - height) / 2,
    width,
    height,
  };
}

function segmentStyle(
  from: Point,
  to: Point,
  width: number,
  height: number,
  thickness: number,
): ViewStyle {
  const x1 = from.x * width;
  const y1 = from.y * height;
  const x2 = to.x * width;
  const y2 = to.y * height;

  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.max(1, Math.sqrt(dx * dx + dy * dy));
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;

  return {
    position: 'absolute',
    left: x1,
    top: y1,
    width: length,
    height: thickness,
    borderRadius: 999,
    backgroundColor: MASK_FILL_COLOR,
    borderWidth: 1,
    borderColor: MASK_BORDER_COLOR,
    transform: [{ translateY: -thickness / 2 }, { rotate: `${angle}deg` }],
    transformOrigin: 'left center',
  };
}

function ActionButton({
  title,
  onPress,
  disabled,
  primary,
  active,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  primary?: boolean;
  active?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        primary ? styles.primaryButton : styles.secondaryButton,
        active && styles.activeButton,
        disabled && styles.buttonDisabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Text
        style={[
          primary ? styles.primaryButtonText : styles.secondaryButtonText,
          active && styles.activeButtonText,
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

function MetaPill({ value }: { value: string }) {
  return (
    <View style={styles.metaPill}>
      <Text style={styles.metaPillText}>{value}</Text>
    </View>
  );
}

function BrushPresetCard({
  title,
  subtitle,
  active,
  onPress,
  disabled,
}: {
  title: string;
  subtitle: string;
  active: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.brushPresetCard,
        active && styles.brushPresetCardActive,
        disabled && styles.buttonDisabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Text
        style={[
          styles.brushPresetTitle,
          active && styles.brushPresetTitleActive,
        ]}
      >
        {title}
      </Text>
      <Text
        style={[
          styles.brushPresetSubtitle,
          active && styles.brushPresetSubtitleActive,
        ]}
      >
        {subtitle}
      </Text>
    </Pressable>
  );
}

export function SmartEraseScreen({ route, navigation }: Props) {
  const { documentId, pageId } = route.params;

  const [document, setDocument] = useState<DocumentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [brushPreset, setBrushPreset] = useState<BrushPreset>('medium');
  const [previewSize, setPreviewSize] = useState<Size>({ width: 0, height: 0 });
  const [pageImageSize, setPageImageSize] = useState<Size>({ width: 0, height: 0 });
  const [strokes, setStrokes] = useState<EraseStroke[]>([]);
  const [maskVisible, setMaskVisible] = useState(true);

  const drawingRef = useRef(false);

  const currentPage = useMemo(
    () => document?.pages.find((page) => page.id === pageId) ?? null,
    [document, pageId],
  );

  const previewFrame = useMemo(
    () => fitContain(previewSize, pageImageSize),
    [pageImageSize, previewSize],
  );

  const brushSizeRatio = BRUSH_SIZE_RATIO[brushPreset];

  const visualBrushThickness = Math.max(
    8,
    Math.round(Math.max(previewFrame.width, previewFrame.height) * brushSizeRatio),
  );

  const normalizedStrokes = useMemo(
    () => strokes.filter((stroke) => stroke.length >= 2),
    [strokes],
  );

  const strokeCount = normalizedStrokes.length;

  const pointCount = useMemo(
    () => normalizedStrokes.reduce((sum, stroke) => sum + stroke.length, 0),
    [normalizedStrokes],
  );

  const brushLabel = useMemo(() => {
    switch (brushPreset) {
      case 'small':
        return 'Küçük detaylar';
      case 'large':
        return 'Büyük alanlar';
      case 'medium':
      default:
        return 'Genel kullanım';
    }
  }, [brushPreset]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        setLoading(true);
        const nextDocument = await getDocumentDetail(documentId);
        const page = nextDocument.pages.find((item) => item.id === pageId);

        if (!page) {
          throw new Error('Silinecek sayfa bulunamadı.');
        }

        const nextSize = await getImageSize(page.image_path);

        if (!active) {
          return;
        }

        setDocument(nextDocument);
        setPageImageSize(nextSize);
      } catch (error) {
        if (active) {
          Alert.alert('Hata', getErrorMessage(error, 'Akıllı silme ekranı açılamadı.'));
          navigation.goBack();
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      active = false;
      drawingRef.current = false;
    };
  }, [documentId, navigation, pageId]);

  const appendPoint = useCallback(
    (event: GestureResponderEvent, startNewStroke: boolean) => {
      if (previewFrame.width <= 0 || previewFrame.height <= 0) {
        return;
      }

      const { locationX, locationY } = event.nativeEvent;
      const insidePreview =
        locationX >= previewFrame.x &&
        locationX <= previewFrame.x + previewFrame.width &&
        locationY >= previewFrame.y &&
        locationY <= previewFrame.y + previewFrame.height;

      if (!insidePreview) {
        if (startNewStroke) {
          drawingRef.current = false;
        }
        return;
      }

      const point = {
        x: clamp01((locationX - previewFrame.x) / previewFrame.width),
        y: clamp01((locationY - previewFrame.y) / previewFrame.height),
      };

      setStrokes((current) => {
        if (startNewStroke || current.length === 0) {
          return [...current, [point]];
        }

        const next = [...current];
        const lastStroke = next[next.length - 1] ?? [];
        const previousPoint = lastStroke[lastStroke.length - 1];

        if (
          previousPoint &&
          Math.abs(previousPoint.x - point.x) < 0.0018 &&
          Math.abs(previousPoint.y - point.y) < 0.0018
        ) {
          return current;
        }

        next[next.length - 1] = [...lastStroke, point];
        return next;
      });
    },
    [previewFrame.height, previewFrame.width, previewFrame.x, previewFrame.y],
  );

  const handlePreviewLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setPreviewSize({ width, height });
  }, []);

  const handleUndo = useCallback(() => {
    setStrokes((current) => current.slice(0, -1));
  }, []);

  const handleClear = useCallback(() => {
    setStrokes([]);
  }, []);

  const handleSave = useCallback(async () => {
    if (!currentPage) {
      Alert.alert('Sayfa yok', 'Silinecek sayfa bulunamadı.');
      return;
    }

    if (!normalizedStrokes.length) {
      Alert.alert('Alan seçilmedi', 'Silmek istediğin alanı önce işaretle.');
      return;
    }

    let outputUri: string | null = null;

    try {
      setBusy(true);

      outputUri = await applySmartEraseToImage(currentPage.image_path, normalizedStrokes, {
        brushSizeRatio,
        outputFormat: 'jpg',
        quality: 0.97,
        backgroundColor: '#FFFFFF',
      });

      await replaceDocumentPageFromScan(pageId, outputUri);
      navigation.goBack();
    } catch (error) {
      Alert.alert('Hata', getErrorMessage(error, 'Akıllı silme uygulanamadı.'));
    } finally {
      if (outputUri) {
        await removeFileIfExists(outputUri);
      }
      setBusy(false);
    }
  }, [brushSizeRatio, currentPage, navigation, normalizedStrokes, pageId]);

  if (loading) {
    return (
      <Screen title="Akıllı Silme" subtitle="Sayfa hazırlanıyor...">
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.centerStateText}>Sayfa hazırlanıyor...</Text>
        </View>
      </Screen>
    );
  }

  if (!currentPage) {
    return (
      <Screen title="Akıllı Silme" subtitle="Sayfa bulunamadı.">
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>Silinecek sayfa yok</Text>
          <Text style={styles.errorText}>
            İlgili sayfa artık mevcut değil veya belge güncellenmiş olabilir.
          </Text>
          <View style={styles.bottomActionRow}>
            <ActionButton title="Geri dön" onPress={() => navigation.goBack()} />
          </View>
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      title="Akıllı Silme"
      subtitle="Kalem izi, küçük işaret ve istenmeyen notları lokal olarak temizle."
    >
      <View style={styles.heroCard}>
        <View style={styles.heroTextWrap}>
          <Text style={styles.heroTitle}>Silinecek alanı boya</Text>
          <Text style={styles.heroText}>
            Bu akış özellikle beyaz kâğıt üstündeki işaret, not ve küçük izleri
            temizlemek için uygundur. Önce alanı işaretle, sonra kaydet.
          </Text>
        </View>

        <View style={styles.metaRow}>
          <MetaPill value={`${strokeCount} stroke`} />
          <MetaPill value={`${pointCount} nokta`} />
          <MetaPill value={brushLabel} />
          <MetaPill value={maskVisible ? 'Maske görünür' : 'Maske gizli'} />
        </View>
      </View>

      <View style={styles.toolbarCard}>
        <Text style={styles.toolbarTitle}>Fırça boyutu</Text>

        <View style={styles.brushPresetRow}>
          <BrushPresetCard
            title="Küçük"
            subtitle="Nokta ve ince iz"
            active={brushPreset === 'small'}
            onPress={() => setBrushPreset('small')}
            disabled={busy}
          />
          <BrushPresetCard
            title="Orta"
            subtitle="Genel kullanım"
            active={brushPreset === 'medium'}
            onPress={() => setBrushPreset('medium')}
            disabled={busy}
          />
          <BrushPresetCard
            title="Büyük"
            subtitle="Hızlı geniş alan"
            active={brushPreset === 'large'}
            onPress={() => setBrushPreset('large')}
            disabled={busy}
          />
        </View>

        <Text style={styles.toolbarHint}>
          Görsel fırça kalınlığı: {visualBrushThickness}px
        </Text>
      </View>

      <View
        onLayout={handlePreviewLayout}
        style={styles.previewContainer}
        onStartShouldSetResponder={() => !busy}
        onMoveShouldSetResponder={() => !busy}
        onResponderGrant={(event) => {
          drawingRef.current = true;
          appendPoint(event, true);
        }}
        onResponderMove={(event) => {
          if (!drawingRef.current) {
            return;
          }

          appendPoint(event, false);
        }}
        onResponderRelease={() => {
          drawingRef.current = false;
        }}
        onResponderTerminate={() => {
          drawingRef.current = false;
        }}
      >
        <Image
          source={{ uri: currentPage.image_path }}
          resizeMode="contain"
          style={styles.previewImage}
        />

        {maskVisible ? (
          <View
            pointerEvents="none"
            style={[
              styles.strokeOverlay,
              {
                left: previewFrame.x,
                top: previewFrame.y,
                width: previewFrame.width,
                height: previewFrame.height,
              },
            ]}
          >
            {normalizedStrokes.flatMap((stroke, strokeIndex) =>
              stroke.slice(1).map((point, pointIndex) => {
                const previous = stroke[pointIndex];

                return (
                  <View
                    key={`${strokeIndex}-${pointIndex}`}
                    style={segmentStyle(
                      previous,
                      point,
                      previewFrame.width,
                      previewFrame.height,
                      visualBrushThickness,
                    )}
                  />
                );
              }),
            )}
          </View>
        ) : null}

        <View pointerEvents="none" style={styles.previewHintWrap}>
          <Text style={styles.previewHintText}>
            Parmağınla işaretle • Son çizgiyi geri al • Gerekirse maskeyi gizleyip sayfayı kontrol et
          </Text>
        </View>

        <View pointerEvents="none" style={styles.brushIndicatorWrap}>
          <View
            style={[
              styles.brushIndicator,
              {
                width: visualBrushThickness,
                height: visualBrushThickness,
                borderRadius: visualBrushThickness / 2,
              },
            ]}
          />
        </View>

        {busy ? (
          <View style={styles.busyOverlay} pointerEvents="none">
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.busyOverlayText}>Silme uygulanıyor...</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.quickActionRow}>
        <ActionButton
          title={maskVisible ? 'Maskeyi gizle' : 'Maskeyi göster'}
          onPress={() => setMaskVisible((current) => !current)}
          disabled={busy}
          active={maskVisible}
        />
        <ActionButton
          title="Son çizgiyi geri al"
          onPress={handleUndo}
          disabled={busy || strokes.length === 0}
        />
      </View>

      <View style={styles.bottomActionRow}>
        <ActionButton
          title="Temizle"
          onPress={handleClear}
          disabled={busy || strokes.length === 0}
        />
        <ActionButton
          title="Vazgeç"
          onPress={() => navigation.goBack()}
          disabled={busy}
        />
        <ActionButton
          title={busy ? 'Kaydediliyor...' : 'Kaydet'}
          onPress={() => {
            void handleSave();
          }}
          disabled={busy || strokes.length === 0}
          primary
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centerState: {
    paddingVertical: 48,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  centerStateText: {
    ...Typography.body,
    color: colors.textSecondary,
  },
  heroCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    gap: Spacing.md,
    ...Shadows.sm,
  },
  heroTextWrap: {
    gap: 6,
  },
  heroTitle: {
    ...Typography.titleLarge,
    color: colors.text,
  },
  heroText: {
    ...Typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  metaPill: {
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  metaPillText: {
    ...Typography.caption,
    color: colors.textSecondary,
    fontWeight: '800',
  },
  toolbarCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    gap: Spacing.md,
    ...Shadows.sm,
  },
  toolbarTitle: {
    ...Typography.titleSmall,
    color: colors.text,
  },
  brushPresetRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  brushPresetCard: {
    flex: 1,
    minHeight: 84,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    gap: 6,
  },
  brushPresetCardActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(53, 199, 111, 0.10)',
  },
  brushPresetTitle: {
    ...Typography.bodySmall,
    color: colors.text,
    fontWeight: '800',
  },
  brushPresetTitleActive: {
    color: colors.primary,
  },
  brushPresetSubtitle: {
    ...Typography.caption,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  brushPresetSubtitleActive: {
    color: colors.textSecondary,
  },
  toolbarHint: {
    ...Typography.bodySmall,
    color: colors.textTertiary,
  },
  previewContainer: {
    width: '100%',
    height: 480,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#0F141B',
    overflow: 'hidden',
    marginBottom: Spacing.md,
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  strokeOverlay: {
    position: 'absolute',
    overflow: 'hidden',
    borderRadius: 8,
  },
  previewHintWrap: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
  },
  previewHintText: {
    color: '#D9E6EE',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    backgroundColor: 'rgba(11, 15, 20, 0.74)',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
  },
  brushIndicatorWrap: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(11, 15, 20, 0.74)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brushIndicator: {
    backgroundColor: MASK_FILL_COLOR,
    borderWidth: 1,
    borderColor: MASK_CENTER_COLOR,
  },
  busyOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: 'rgba(11, 15, 20, 0.18)',
  },
  busyOverlayText: {
    ...Typography.bodySmall,
    color: colors.text,
    fontWeight: '700',
  },
  quickActionRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  bottomActionRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: Radius.xl,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: colors.text,
    textAlign: 'center',
    fontWeight: '700',
    fontSize: 15,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: Radius.xl,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: colors.onPrimary,
    textAlign: 'center',
    fontWeight: '800',
    fontSize: 15,
  },
  activeButton: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceElevated,
  },
  activeButtonText: {
    color: colors.primary,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  pressed: {
    opacity: 0.92,
  },
  errorCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    ...Shadows.sm,
  },
  errorTitle: {
    ...Typography.titleSmall,
    color: colors.text,
    marginBottom: Spacing.sm,
  },
  errorText: {
    ...Typography.body,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: Spacing.md,
  },
});
