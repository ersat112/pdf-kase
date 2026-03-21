import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Canvas, Path, Skia, useCanvasRef } from '@shopify/react-native-skia';
import { File, Paths } from 'expo-file-system';
import * as ScreenOrientation from 'expo-screen-orientation';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
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
import { Radius, Shadows, Spacing, Typography, colors } from '../../theme';

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

const SIGNATURE_COLORS = [
  '#111111',
  '#1F2937',
  '#374151',
  '#4B5563',
  '#1D4ED8',
  '#2563EB',
  '#0F766E',
  '#0D9488',
  '#7C3AED',
  '#9333EA',
  '#B45309',
  '#D97706',
  '#B91C1C',
  '#DC2626',
  '#166534',
  '#15803D',
  '#0F172A',
  '#334155',
] as const;

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
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        primary ? styles.primaryButton : styles.secondaryButton,
        disabled && styles.buttonDisabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Text
        style={primary ? styles.primaryButtonText : styles.secondaryButtonText}
      >
        {title}
      </Text>
    </Pressable>
  );
}

function ColorSwatch({
  color,
  selected,
  onPress,
  disabled,
}: {
  color: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.colorSwatchOuter,
        selected && styles.colorSwatchOuterSelected,
        disabled && styles.buttonDisabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <View style={[styles.colorSwatchInner, { backgroundColor: color }]} />
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
  const [selectedColor, setSelectedColor] = useState(DEFAULT_SIGNATURE_COLOR);
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
          strokeColor: selectedColor,
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
        strokeColor: selectedColor,
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
    selectedColor,
    selectedStrokeWidth,
    strokes,
  ]);

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={['top', 'left', 'right', 'bottom']}
    >
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <View style={styles.headerTextBlock}>
            <Text style={styles.title}>İmza Oluştur</Text>
            <Text style={styles.subtitle}>
              Yatay imza alanında imzanı at, gerekirse son çizgiyi geri al ve
              trim edilmiş olarak belgeye yerleştir.
            </Text>

            <View style={styles.metaRow}>
              <MetaBadge value={`${strokeCount} çizgi`} />
              <MetaBadge value={`${pointCount} nokta`} />
              <MetaBadge
                value={`${selectedStrokeWidth.toFixed(1).replace('.', ',')} px`}
              />
            </View>
          </View>

          <View style={styles.headerActions}>
            <ActionButton
              title="Son çizgiyi geri al"
              onPress={handleUndo}
              disabled={busy || strokes.length === 0}
            />
            <ActionButton
              title="Temizle"
              onPress={() => setStrokes([])}
              disabled={busy || strokes.length === 0}
            />
            <ActionButton
              title="Vazgeç"
              onPress={() => navigation.goBack()}
              disabled={busy}
            />
            <ActionButton
              title="Kaydet ve yerleştir"
              onPress={() => {
                void handleSave();
              }}
              disabled={busy || !canSave}
              primary
            />
          </View>
        </View>

        <View style={styles.controlsCard}>
          <View style={styles.controlSection}>
            <Text style={styles.controlLabel}>Renk</Text>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.paletteRow}
            >
              {SIGNATURE_COLORS.map((color) => (
                <ColorSwatch
                  key={color}
                  color={color}
                  selected={selectedColor === color}
                  onPress={() => setSelectedColor(color)}
                  disabled={busy}
                />
              ))}
            </ScrollView>
          </View>

          <View style={styles.controlSection}>
            <Text style={styles.controlLabel}>Kalem kalınlığı</Text>

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
        </View>

        <View style={styles.padCard}>
          <Text style={styles.cardTitle}>Geniş imza alanı</Text>
          <Text style={styles.cardHint}>
            Parmağınla veya kalemle imzanı at. Kayıt sırasında görsel, çizginin
            gerçek sınırlarına göre kırpılır ve kütüphaneye temiz küçük resim
            olarak kaydedilir.
          </Text>

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
                color={selectedColor}
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.lg,
  },
  headerTextBlock: {
    flex: 1,
    gap: Spacing.sm,
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
  headerActions: {
    width: 220,
    gap: Spacing.sm,
  },
  controlsCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    gap: Spacing.lg,
    ...Shadows.sm,
  },
  controlSection: {
    gap: Spacing.sm,
  },
  controlLabel: {
    ...Typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: '700',
  },
  paletteRow: {
    gap: Spacing.sm,
    paddingRight: Spacing.lg,
  },
  widthRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  colorSwatchOuter: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorSwatchOuterSelected: {
    borderWidth: 2,
    borderColor: colors.primary,
    transform: [{ scale: 1.06 }],
  },
  colorSwatchInner: {
    width: 26,
    height: 26,
    borderRadius: 13,
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
    backgroundColor: colors.primary + '14',
  },
  widthChipText: {
    ...Typography.bodySmall,
    color: colors.text,
    fontWeight: '700',
  },
  widthChipTextSelected: {
    color: colors.primary,
  },
  padCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    ...Shadows.sm,
  },
  cardTitle: {
    ...Typography.titleLarge,
    color: colors.text,
    marginBottom: Spacing.xs,
  },
  cardHint: {
    ...Typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: Spacing.lg,
  },
  signaturePad: {
    flex: 1,
    minHeight: 260,
    borderRadius: Radius.xl,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E7E9EE',
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
  secondaryButton: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: Radius.xl,
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  secondaryButtonText: {
    color: colors.text,
    textAlign: 'center',
    fontWeight: '700',
    fontSize: 15,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: Radius.xl,
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  primaryButtonText: {
    color: colors.onPrimary,
    textAlign: 'center',
    fontWeight: '800',
    fontSize: 15,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  pressed: {
    opacity: 0.92,
  },
});
