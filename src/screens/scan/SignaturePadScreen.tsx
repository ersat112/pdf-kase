import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Canvas, Path, Skia, useCanvasRef } from '@shopify/react-native-skia';
import { File, Paths } from 'expo-file-system';
import * as ScreenOrientation from 'expo-screen-orientation';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { createAssetFromImage } from '../../modules/assets/asset.service';
import {
  addSignatureAssetOverlay,
  type SignatureStroke,
} from '../../modules/overlays/overlay.service';
import { createTrimmedSignatureImage } from '../../modules/signatures/signature-image';
import { removeFileIfExists } from '../../modules/storage/file.service';
import type { RootStackParamList } from '../../navigation/types';
import {
  Radius,
  Shadows,
  Spacing,
  Typography,
  colors,
} from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'SignaturePad'>;

type SignaturePoint = {
  x: number;
  y: number;
};

type StrokeWidthPreset = {
  key: 'fine' | 'medium' | 'bold';
  label: string;
  value: number;
};

const DEFAULT_SIGNATURE_FRAME = {
  x: 0.16,
  y: 0.72,
  width: 0.46,
  height: 0.14,
};

const DEFAULT_SIGNATURE_COLOR = '#111111';

const STROKE_WIDTH_PRESETS: StrokeWidthPreset[] = [
  { key: 'fine', label: 'İnce', value: 2.5 },
  { key: 'medium', label: 'Orta', value: 4 },
  { key: 'bold', label: 'Kalın', value: 5.5 },
];

function clampUnit(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(1, value));
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message.trim().length > 0
    ? error.message
    : fallback;
}

function distanceSquared(from: SignaturePoint, to: SignaturePoint) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return dx * dx + dy * dy;
}

function normalizeSignatureStrokes(strokes: SignatureStroke[]) {
  return strokes
    .map((stroke) =>
      stroke
        .map((point) => ({
          x: clampUnit(point.x),
          y: clampUnit(point.y),
        }))
        .filter(
          (point, index, array) =>
            index === 0 || distanceSquared(array[index - 1], point) > 0.000001,
        ),
    )
    .filter((stroke) => stroke.length >= 2);
}

function chaikinSmoothStroke(
  stroke: SignatureStroke,
  iterations = 2,
): SignatureStroke {
  let result = normalizeSignatureStrokes([stroke])[0] ?? [];

  if (result.length < 3) {
    return result;
  }

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    if (result.length < 3) {
      break;
    }

    const next: SignatureStroke = [result[0]];

    for (let index = 0; index < result.length - 1; index += 1) {
      const current = result[index];
      const following = result[index + 1];

      const q = {
        x: clampUnit(current.x * 0.75 + following.x * 0.25),
        y: clampUnit(current.y * 0.75 + following.y * 0.25),
      };

      const r = {
        x: clampUnit(current.x * 0.25 + following.x * 0.75),
        y: clampUnit(current.y * 0.25 + following.y * 0.75),
      };

      next.push(q, r);
    }

    next.push(result[result.length - 1]);
    result = normalizeSignatureStrokes([next])[0] ?? [];
  }

  return result;
}

function smoothSignatureStrokes(strokes: SignatureStroke[]) {
  return normalizeSignatureStrokes(
    strokes.map((stroke) => chaikinSmoothStroke(stroke, 2)),
  );
}

function buildSignaturePath(
  strokes: SignatureStroke[],
  width: number,
  height: number,
) {
  const path = Skia.Path.Make();

  if (width <= 0 || height <= 0) {
    return path;
  }

  for (const stroke of strokes) {
    if (stroke.length === 0) {
      continue;
    }

    const first = stroke[0];
    path.moveTo(first.x * width, first.y * height);

    if (stroke.length === 1) {
      continue;
    }

    if (stroke.length === 2) {
      const last = stroke[1];
      path.lineTo(last.x * width, last.y * height);
      continue;
    }

    for (let index = 1; index < stroke.length - 1; index += 1) {
      const current = stroke[index];
      const next = stroke[index + 1];
      const midX = ((current.x + next.x) / 2) * width;
      const midY = ((current.y + next.y) / 2) * height;

      path.quadTo(current.x * width, current.y * height, midX, midY);
    }

    const last = stroke[stroke.length - 1];
    path.lineTo(last.x * width, last.y * height);
  }

  return path;
}

function ActionButton({
  title,
  onPress,
  disabled,
  primary,
  danger,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  primary?: boolean;
  danger?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.actionButton,
        primary && styles.actionButtonPrimary,
        danger && styles.actionButtonDanger,
        disabled && styles.buttonDisabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Text
        style={[
          styles.actionButtonText,
          primary && styles.actionButtonTextPrimary,
          danger && styles.actionButtonTextDanger,
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

function WidthPresetChip({
  label,
  selected,
  onPress,
  disabled,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.widthChip,
        selected && styles.widthChipSelected,
        disabled && styles.buttonDisabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Text
        style={[
          styles.widthChipText,
          selected && styles.widthChipTextSelected,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function MetaBadge({ value }: { value: string }) {
  return (
    <View style={styles.metaBadge}>
      <Text style={styles.metaBadgeText}>{value}</Text>
    </View>
  );
}

export function SignaturePadScreen({ route, navigation }: Props) {
  const { documentId, pageId } = route.params;

  const [busy, setBusy] = useState(false);
  const [padWidth, setPadWidth] = useState(0);
  const [padHeight, setPadHeight] = useState(0);
  const [strokes, setStrokes] = useState<SignatureStroke[]>([]);
  const [selectedStrokeWidth, setSelectedStrokeWidth] = useState(
    STROKE_WIDTH_PRESETS[1].value,
  );

  const drawingRef = useRef(false);
  const canvasRef = useCanvasRef();

  useEffect(() => {
    void ScreenOrientation.lockAsync(
      ScreenOrientation.OrientationLock.LANDSCAPE,
    );

    return () => {
      drawingRef.current = false;
      void ScreenOrientation.unlockAsync();
    };
  }, []);

  const smoothedStrokes = useMemo(
    () => smoothSignatureStrokes(strokes),
    [strokes],
  );

  const signaturePath = useMemo(
    () => buildSignaturePath(smoothedStrokes, padWidth, padHeight),
    [padHeight, padWidth, smoothedStrokes],
  );

  const canSave = useMemo(
    () => normalizeSignatureStrokes(strokes).length > 0,
    [strokes],
  );

  const strokeCount = useMemo(
    () => normalizeSignatureStrokes(strokes).length,
    [strokes],
  );

  const pointCount = useMemo(
    () =>
      normalizeSignatureStrokes(strokes).reduce(
        (sum, stroke) => sum + stroke.length,
        0,
      ),
    [strokes],
  );

  const appendPoint = useCallback(
    (x: number, y: number, startNewStroke: boolean) => {
      if (padWidth <= 0 || padHeight <= 0) {
        return;
      }

      const normalizedPoint = {
        x: clampUnit(x / padWidth),
        y: clampUnit(y / padHeight),
      };

      const minDistance = Math.max(
        0.0012,
        1.5 / Math.max(padWidth, padHeight),
      );
      const minDistanceSquared = minDistance * minDistance;

      setStrokes((current) => {
        if (startNewStroke || current.length === 0) {
          return [...current, [normalizedPoint]];
        }

        const next = [...current];
        const lastStroke = next[next.length - 1] ?? [];
        const previousPoint = lastStroke[lastStroke.length - 1];

        if (
          previousPoint &&
          distanceSquared(previousPoint, normalizedPoint) < minDistanceSquared
        ) {
          return current;
        }

        next[next.length - 1] = [...lastStroke, normalizedPoint];
        return next;
      });
    },
    [padHeight, padWidth],
  );

  const handlePadLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setPadWidth(width);
    setPadHeight(height);
  }, []);

  const handleUndo = useCallback(() => {
    setStrokes((current) => current.slice(0, -1));
  }, []);

  const createSignatureSnapshot = useCallback(async () => {
    const snapshot = await canvasRef.current?.makeImageSnapshotAsync();

    if (!snapshot) {
      throw new Error('İmza önizlemesi oluşturulamadı.');
    }

    const bytes = snapshot.encodeToBytes();
    const fileName = `signature-pad-${Date.now()}.png`;
    const tempFile = new File(Paths.cache, fileName);

    if (tempFile.exists) {
      tempFile.delete();
    }

    tempFile.create();
    tempFile.write(bytes);

    return tempFile.uri;
  }, [canvasRef]);

  const cleanupTempUris = useCallback(async (uris: Array<string | null>) => {
    const uniqueUris = [...new Set(uris.filter(Boolean))] as string[];

    for (const uri of uniqueUris) {
      await removeFileIfExists(uri);
    }
  }, []);

  const handleSave = useCallback(async () => {
    const normalized = smoothSignatureStrokes(strokes);

    if (!normalized.length) {
      Alert.alert('İmza yok', 'Kaydetmek için önce imza at.');
      return;
    }

    let snapshotUri: string | null = null;
    let trimmedSourceUri: string | null = null;
    let trimmedPreviewUri: string | null = null;

    try {
      setBusy(true);

      snapshotUri = await createSignatureSnapshot();

      const trimmed = await createTrimmedSignatureImage({
        snapshotUri,
        strokes: normalized,
        padWidth,
        padHeight,
        strokeWidth: selectedStrokeWidth,
      });

      trimmedSourceUri = trimmed.sourceUri;
      trimmedPreviewUri = trimmed.previewSourceUri;

      const createdAsset = await createAssetFromImage({
        sourceUri: trimmed.sourceUri,
        originalSourceUri: trimmed.sourceUri,
        previewSourceUri: trimmed.previewSourceUri,
        type: 'signature',
        metadata: {
          strokeColor: DEFAULT_SIGNATURE_COLOR,
          strokeCount: normalized.length,
          pointCount: normalized.reduce((sum, stroke) => sum + stroke.length, 0),
          strokeWidth: selectedStrokeWidth,
          ...trimmed.metadata,
        },
      });

      await addSignatureAssetOverlay({
        documentId,
        pageId,
        assetId: createdAsset.id,
        x: DEFAULT_SIGNATURE_FRAME.x,
        y: DEFAULT_SIGNATURE_FRAME.y,
        width: DEFAULT_SIGNATURE_FRAME.width,
        height: DEFAULT_SIGNATURE_FRAME.height,
        opacity: 1,
        strokeColor: DEFAULT_SIGNATURE_COLOR,
      });

      navigation.replace('PdfEditor', { documentId });
    } catch (error) {
      Alert.alert('Hata', getErrorMessage(error, 'İmza kaydedilemedi.'));
    } finally {
      await cleanupTempUris([snapshotUri, trimmedSourceUri, trimmedPreviewUri]);
      setBusy(false);
    }
  }, [
    cleanupTempUris,
    createSignatureSnapshot,
    documentId,
    navigation,
    padHeight,
    padWidth,
    pageId,
    selectedStrokeWidth,
    strokes,
  ]);

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={['top', 'left', 'right', 'bottom']}
    >
      <View style={styles.container}>
        <View style={styles.heroCard}>
          <View style={styles.heroTextBlock}>
            <Text style={styles.heroEyebrow}>İmza oturumu</Text>
            <Text style={styles.title}>İmza Oluştur</Text>
            <Text style={styles.subtitle}>
              Burada siyah imza oluştur. Editöre döndüğünde yerleştirilen imzanın
              rengini, konumunu ve boyutunu değiştirebilirsin.
            </Text>

            <View style={styles.metaRow}>
              <MetaBadge value={`${strokeCount} çizgi`} />
              <MetaBadge value={`${pointCount} nokta`} />
              <MetaBadge
                value={`${selectedStrokeWidth.toFixed(1).replace('.', ',')} px`}
              />
            </View>
          </View>

          <View style={styles.heroActionRail}>
            <ActionButton
              title="Son çizgiyi geri al"
              onPress={handleUndo}
              disabled={busy || strokes.length === 0}
            />
            <ActionButton
              title="Temizle"
              onPress={() => setStrokes([])}
              disabled={busy || strokes.length === 0}
              danger
            />
            <ActionButton
              title="Vazgeç"
              onPress={() => navigation.goBack()}
              disabled={busy}
            />
            <ActionButton
              title="Kaydet ve editöre dön"
              onPress={() => {
                void handleSave();
              }}
              disabled={busy || !canSave}
              primary
            />
          </View>
        </View>

        <View style={styles.mainRow}>
          <View style={styles.padCard}>
            <View style={styles.padHeader}>
              <Text style={styles.cardTitle}>İmza alanı</Text>
              <Text style={styles.cardHint}>
                Beyaz pad sabit yüzeydir. Kayıt sırasında çizim gerçek sınırlarına göre
                kırpılır ve kütüphaneye thumbnail olarak kaydedilir.
              </Text>
            </View>

            <View style={styles.padSurface}>
              <View
                style={styles.signaturePad}
                onLayout={handlePadLayout}
                onStartShouldSetResponder={() => true}
                onMoveShouldSetResponder={() => true}
                onResponderGrant={(event) => {
                  drawingRef.current = true;
                  appendPoint(
                    event.nativeEvent.locationX,
                    event.nativeEvent.locationY,
                    true,
                  );
                }}
                onResponderMove={(event) => {
                  if (!drawingRef.current) {
                    return;
                  }

                  appendPoint(
                    event.nativeEvent.locationX,
                    event.nativeEvent.locationY,
                    false,
                  );
                }}
                onResponderRelease={() => {
                  drawingRef.current = false;
                }}
                onResponderTerminate={() => {
                  drawingRef.current = false;
                }}
              >
                <Canvas ref={canvasRef} style={StyleSheet.absoluteFill}>
                  <Path
                    path={signaturePath}
                    color={DEFAULT_SIGNATURE_COLOR}
                    style="stroke"
                    strokeWidth={selectedStrokeWidth}
                    strokeCap="round"
                    strokeJoin="round"
                  />
                </Canvas>

                <View pointerEvents="none" style={styles.baseline} />

                {!canSave ? (
                  <View pointerEvents="none" style={styles.placeholderWrap}>
                    <Text style={styles.placeholderText}>Buraya imza at</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>

          <View style={styles.sidePanel}>
            <View style={styles.controlsCard}>
              <Text style={styles.sidePanelTitle}>Kalem kalınlığı</Text>
              <Text style={styles.sidePanelText}>
                Farklı imza stilleri için çizgi kalınlığını burada ayarla.
              </Text>

              <View style={styles.widthRow}>
                {STROKE_WIDTH_PRESETS.map((preset) => (
                  <WidthPresetChip
                    key={preset.key}
                    label={preset.label}
                    selected={selectedStrokeWidth === preset.value}
                    onPress={() => setSelectedStrokeWidth(preset.value)}
                    disabled={busy}
                  />
                ))}
              </View>
            </View>

            <View style={styles.tipCard}>
              <Text style={styles.sidePanelTitle}>Akış notu</Text>
              <Text style={styles.sidePanelText}>
                Kaydettiğin imza otomatik olarak belgeye yerleştirilir ve editöre dönersin.
                Sonraki adım orada sürükle, hizala, renk değiştir ve boyutlandır olur.
              </Text>
            </View>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    gap: Spacing.lg,
  },
  heroCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.lg,
    ...Shadows.sm,
  },
  heroTextBlock: {
    flex: 1,
    gap: Spacing.sm,
  },
  heroEyebrow: {
    ...Typography.caption,
    color: colors.primary,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  title: {
    ...Typography.display,
    color: colors.text,
    fontSize: 28,
    lineHeight: 34,
  },
  subtitle: {
    ...Typography.body,
    color: colors.textSecondary,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  metaBadge: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  metaBadgeText: {
    ...Typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: '700',
  },
  heroActionRail: {
    width: 240,
    gap: Spacing.sm,
  },
  mainRow: {
    flex: 1,
    flexDirection: 'row',
    gap: Spacing.lg,
  },
  padCard: {
    flex: 1,
    minHeight: 360,
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    gap: Spacing.md,
    ...Shadows.sm,
  },
  padHeader: {
    gap: 4,
  },
  cardTitle: {
    ...Typography.titleLarge,
    color: colors.text,
  },
  cardHint: {
    ...Typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  padSurface: {
    flex: 1,
    minHeight: 300,
    borderRadius: Radius.xl,
    backgroundColor: '#EEF2F7',
    padding: 12,
  },
  signaturePad: {
    flex: 1,
    minHeight: 280,
    borderRadius: Radius.xl,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#DCE3EC',
    position: 'relative',
  },
  placeholderWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    ...Typography.bodySmall,
    color: '#9AA3AF',
    fontWeight: '600',
  },
  baseline: {
    position: 'absolute',
    left: 28,
    right: 28,
    bottom: 42,
    borderBottomWidth: 1,
    borderBottomColor: '#D8DDE6',
    borderStyle: 'dashed',
  },
  sidePanel: {
    width: 292,
    gap: Spacing.lg,
  },
  controlsCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    gap: Spacing.md,
    ...Shadows.sm,
  },
  tipCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    gap: Spacing.sm,
    ...Shadows.sm,
  },
  sidePanelTitle: {
    ...Typography.titleSmall,
    color: colors.text,
  },
  sidePanelText: {
    ...Typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  widthRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  widthChip: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  widthChipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryMuted,
  },
  widthChipText: {
    ...Typography.bodySmall,
    color: colors.text,
    fontWeight: '700',
  },
  widthChipTextSelected: {
    color: colors.primary,
  },
  actionButton: {
    minHeight: 46,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  actionButtonPrimary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  actionButtonDanger: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderColor: 'rgba(239, 68, 68, 0.24)',
  },
  actionButtonText: {
    color: colors.text,
    textAlign: 'center',
    fontWeight: '700',
    fontSize: 15,
  },
  actionButtonTextPrimary: {
    color: colors.onPrimary,
    fontWeight: '800',
  },
  actionButtonTextDanger: {
    color: '#F87171',
    fontWeight: '800',
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  pressed: {
    opacity: 0.92,
  },
});
