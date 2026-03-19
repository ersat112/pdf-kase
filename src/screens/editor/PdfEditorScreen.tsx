import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  type ViewStyle,
} from 'react-native';

import { Screen } from '../../components/common/Screen';
import {
  createAssetFromImage,
  getAssetsByType,
  getPreferredAssetPreviewUri,
  type StoredAsset,
} from '../../modules/assets/asset.service';
import {
  getDocumentDetail,
  type DocumentDetail,
} from '../../modules/documents/document.service';
import { prepareStampAssetImage } from '../../modules/imaging/imaging.service';
import {
  addStampOverlay,
  deleteOverlay,
  getOverlayAssetId,
  getPageOverlays,
  updateOverlayTransform,
  updateSignatureOverlayStyle,
  type DocumentOverlay,
  type SignatureStroke,
} from '../../modules/overlays/overlay.service';
import { removeFilesIfExist } from '../../modules/storage/file.service';
import type { RootStackParamList } from '../../navigation/types';
import { Radius, Typography, colors } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'PdfEditor'>;

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

type StampSizePreset = 'small' | 'medium' | 'large';

type OverlayDraft = {
  overlayId: number;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
};

type DragSession = {
  overlayId: number;
  startPageX: number;
  startPageY: number;
  initialX: number;
  initialY: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
};

type ResizeSession = {
  overlayId: number;
  startPageX: number;
  startPageY: number;
  initialX: number;
  initialY: number;
  initialWidth: number;
  initialHeight: number;
  rotation: number;
  opacity: number;
};

type SignaturePoint = {
  x: number;
  y: number;
};

type SignaturePresentation = {
  strokes: SignatureStroke[];
  color: string;
};

type OverlayPreviewItem =
  | {
      kind: 'stamp';
      overlay: DocumentOverlay;
      asset: StoredAsset;
      style: ViewStyle;
      isSelected: boolean;
    }
  | {
      kind: 'signature';
      overlay: DocumentOverlay;
      strokes: SignatureStroke[];
      color: string;
      style: ViewStyle;
      isSelected: boolean;
    };

const DEFAULT_STAMP_WIDTH_BY_PRESET: Record<StampSizePreset, number> = {
  small: 0.18,
  medium: 0.28,
  large: 0.38,
};

const OVERLAY_SCALE_STEP = 0.03;
const OVERLAY_MIN_WIDTH = 0.08;
const OVERLAY_MAX_WIDTH = 0.7;
const OVERLAY_MIN_HEIGHT = 0.04;
const OVERLAY_MAX_HEIGHT = 0.7;
const DEFAULT_SIGNATURE_COLOR = '#111111';

const SIGNATURE_COLOR_PALETTE = [
  '#111111',
  '#1F2937',
  '#374151',
  '#4B5563',
  '#1F4B99',
  '#2563EB',
  '#0F766E',
  '#0D9488',
  '#7C3AED',
  '#9333EA',
  '#B45309',
  '#D97706',
  '#B91C1C',
  '#DC2626',
];

function ToolbarButton({
  title,
  onPress,
  disabled,
  active,
  danger,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  active?: boolean;
  danger?: boolean;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.toolbarButton,
        active && styles.toolbarButtonActive,
        danger && styles.toolbarButtonDanger,
        disabled && styles.toolbarButtonDisabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Text
        style={[
          styles.toolbarButtonText,
          active && styles.toolbarButtonTextActive,
          danger && styles.toolbarButtonTextDanger,
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

function SignatureColorSwatch({
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
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.colorSwatchOuter,
        selected && styles.colorSwatchOuterSelected,
        disabled && styles.toolbarButtonDisabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <View style={[styles.colorSwatchInner, { backgroundColor: color }]} />
    </Pressable>
  );
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message.trim().length > 0
    ? error.message
    : fallback;
}

function resolveImageSize(uri: string) {
  return new Promise<Size>((resolve, reject) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      reject,
    );
  });
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

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function clampOverlayFrame(input: {
  x: number;
  y: number;
  width: number;
  height: number;
}) {
  const width = Math.max(OVERLAY_MIN_WIDTH, Math.min(OVERLAY_MAX_WIDTH, input.width));
  const height = Math.max(
    OVERLAY_MIN_HEIGHT,
    Math.min(OVERLAY_MAX_HEIGHT, input.height),
  );

  return {
    width,
    height,
    x: Math.max(0, Math.min(input.x, 1 - width)),
    y: Math.max(0, Math.min(input.y, 1 - height)),
  };
}

function formatOverlayPosition(overlay: Pick<DocumentOverlay, 'x' | 'y'>) {
  const x = Math.round(overlay.x * 100);
  const y = Math.round(overlay.y * 100);

  return `X:${x}% • Y:${y}%`;
}

function buildOverlayDraftFromOverlay(overlay: DocumentOverlay): OverlayDraft {
  return {
    overlayId: overlay.id,
    x: overlay.x,
    y: overlay.y,
    width: overlay.width,
    height: overlay.height,
    rotation: overlay.rotation,
    opacity: overlay.opacity,
  };
}

function normalizeHexColor(value: unknown) {
  if (typeof value !== 'string') {
    return DEFAULT_SIGNATURE_COLOR;
  }

  const trimmed = value.trim();

  if (/^#[0-9a-fA-F]{6}$/.test(trimmed) || /^#[0-9a-fA-F]{8}$/.test(trimmed)) {
    return trimmed.toUpperCase();
  }

  return DEFAULT_SIGNATURE_COLOR;
}

function getOverlaySignaturePresentation(
  overlay: Pick<DocumentOverlay, 'content'>,
): SignaturePresentation {
  if (!overlay.content) {
    return {
      strokes: [],
      color: DEFAULT_SIGNATURE_COLOR,
    };
  }

  try {
    const parsed = JSON.parse(overlay.content) as {
      strokes?: Array<Array<{ x?: number; y?: number }>>;
      color?: string;
      strokeColor?: string;
    };

    const strokes = Array.isArray(parsed?.strokes)
      ? parsed.strokes
          .map((stroke) =>
            Array.isArray(stroke)
              ? stroke
                  .map((point) => ({
                    x:
                      typeof point?.x === 'number' && Number.isFinite(point.x)
                        ? clamp01(point.x)
                        : 0,
                    y:
                      typeof point?.y === 'number' && Number.isFinite(point.y)
                        ? clamp01(point.y)
                        : 0,
                  }))
                  .filter(
                    (point) =>
                      Number.isFinite(point.x) && Number.isFinite(point.y),
                  )
              : [],
          )
          .filter((stroke) => stroke.length >= 2)
      : [];

    return {
      strokes,
      color: normalizeHexColor(parsed?.strokeColor ?? parsed?.color),
    };
  } catch {
    return {
      strokes: [],
      color: DEFAULT_SIGNATURE_COLOR,
    };
  }
}

function segmentStyle(
  from: SignaturePoint,
  to: SignaturePoint,
  width: number,
  height: number,
  color: string,
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
    height: 2.6,
    borderRadius: 999,
    backgroundColor: color,
    transform: [{ translateY: -1.3 }, { rotate: `${angle}deg` }],
    transformOrigin: 'left center',
  };
}

function SignaturePreview({
  strokes,
  color,
  selected,
}: {
  strokes: SignatureStroke[];
  color: string;
  selected?: boolean;
}) {
  return (
    <View
      style={[
        styles.signatureOverlayBox,
        selected && styles.signatureOverlayBoxSelected,
      ]}
    >
      {strokes.flatMap((stroke, strokeIndex) =>
        stroke.slice(1).map((point, pointIndex) => {
          const previous = stroke[pointIndex];

          return (
            <View
              key={`${strokeIndex}-${pointIndex}`}
              style={segmentStyle(previous, point, 1, 1, color)}
            />
          );
        }),
      )}
    </View>
  );
}

export function PdfEditorScreen({ route, navigation }: Props) {
  const { documentId } = route.params;

  const [document, setDocument] = useState<DocumentDetail | null>(null);
  const [assets, setAssets] = useState<StoredAsset[]>([]);
  const [overlays, setOverlays] = useState<DocumentOverlay[]>([]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [selectedAssetId, setSelectedAssetId] = useState<number | null>(null);
  const [selectedOverlayId, setSelectedOverlayId] = useState<number | null>(null);
  const [stampSizePreset, setStampSizePreset] = useState<StampSizePreset>('medium');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [previewSize, setPreviewSize] = useState<Size>({ width: 0, height: 0 });
  const [pageImageSize, setPageImageSize] = useState<Size>({ width: 0, height: 0 });
  const [selectedAssetImageSize, setSelectedAssetImageSize] = useState<Size>({
    width: 0,
    height: 0,
  });
  const [overlayDraft, setOverlayDraft] = useState<OverlayDraft | null>(null);

  const dragSessionRef = useRef<DragSession | null>(null);
  const resizeSessionRef = useRef<ResizeSession | null>(null);

  const currentPage = document?.pages[currentPageIndex] ?? null;

  const selectedAsset = useMemo(
    () => assets.find((asset) => asset.id === selectedAssetId) ?? null,
    [assets, selectedAssetId],
  );

  const selectedOverlay = useMemo(
    () => overlays.find((overlay) => overlay.id === selectedOverlayId) ?? null,
    [overlays, selectedOverlayId],
  );

  const selectedSignatureInfo = useMemo(() => {
    if (!selectedOverlay || selectedOverlay.type !== 'signature') {
      return null;
    }

    return getOverlaySignaturePresentation(selectedOverlay);
  }, [selectedOverlay]);

  const previewFrame = useMemo(
    () => fitContain(previewSize, pageImageSize),
    [pageImageSize, previewSize],
  );

  const reloadCurrentPageOverlays = useCallback(async () => {
    if (!currentPage) {
      setOverlays([]);
      setSelectedOverlayId(null);
      setOverlayDraft(null);
      return;
    }

    const pageOverlays = await getPageOverlays(currentPage.id);
    setOverlays(pageOverlays);
    setSelectedOverlayId((current) => {
      if (current && pageOverlays.some((overlay) => overlay.id === current)) {
        return current;
      }

      return pageOverlays[0]?.id ?? null;
    });
    setOverlayDraft(null);
  }, [currentPage]);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const run = async () => {
        try {
          setLoading(true);

          const [doc, stampAssets] = await Promise.all([
            getDocumentDetail(documentId),
            getAssetsByType('stamp'),
          ]);

          if (!active) {
            return;
          }

          setDocument(doc);
          setAssets(stampAssets);
          setSelectedAssetId((current) => {
            if (current && stampAssets.some((asset) => asset.id === current)) {
              return current;
            }

            return stampAssets[0]?.id ?? null;
          });
          setCurrentPageIndex((prev) => {
            if (doc.pages.length === 0) {
              return 0;
            }

            return Math.min(prev, doc.pages.length - 1);
          });
        } catch (error) {
          Alert.alert('Hata', getErrorMessage(error, 'Editör verileri yüklenemedi.'));
        } finally {
          if (active) {
            setLoading(false);
          }
        }
      };

      void run();

      return () => {
        active = false;
      };
    }, [documentId]),
  );

  useEffect(() => {
    let active = true;

    if (!currentPage) {
      setOverlays([]);
      setSelectedOverlayId(null);
      setPageImageSize({ width: 0, height: 0 });
      setOverlayDraft(null);
      return;
    }

    const run = async () => {
      try {
        const [pageOverlays, naturalSize] = await Promise.all([
          getPageOverlays(currentPage.id),
          resolveImageSize(currentPage.image_path),
        ]);

        if (!active) {
          return;
        }

        setOverlays(pageOverlays);
        setSelectedOverlayId(pageOverlays[0]?.id ?? null);
        setPageImageSize(naturalSize);
        setOverlayDraft(null);
      } catch (error) {
        console.warn('[PdfEditor] Page load failed:', error);

        if (active) {
          setOverlays([]);
          setSelectedOverlayId(null);
          setPageImageSize({ width: 0, height: 0 });
          setOverlayDraft(null);
        }
      }
    };

    void run();

    return () => {
      active = false;
    };
  }, [currentPage]);

  useEffect(() => {
    let active = true;

    if (!selectedAsset?.file_path) {
      setSelectedAssetImageSize({ width: 0, height: 0 });
      return;
    }

    const run = async () => {
      try {
        const nextSize = await resolveImageSize(selectedAsset.file_path);

        if (!active) {
          return;
        }

        setSelectedAssetImageSize(nextSize);
      } catch (error) {
        console.warn('[PdfEditor] Failed to resolve selected stamp size:', error);

        if (active) {
          setSelectedAssetImageSize({ width: 0, height: 0 });
        }
      }
    };

    void run();

    return () => {
      active = false;
    };
  }, [selectedAsset]);

  const handlePreviewLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setPreviewSize({ width, height });
  }, []);

  const handleImportStamp = useCallback(async () => {
    if (busy) {
      return;
    }

    try {
      setBusy(true);

      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          'İzin gerekli',
          permission.canAskAgain
            ? 'Kaşe görseli seçmek için galeri izni vermelisin.'
            : 'Galeri izni kapalı. Cihaz ayarlarından erişim iznini açmalısın.',
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: false,
        quality: 1,
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        selectionLimit: 1,
      });

      if (result.canceled || !result.assets.length) {
        return;
      }

      const pickedUri = result.assets[0].uri;
      const prepared = await prepareStampAssetImage(pickedUri);

      try {
        const created = await createAssetFromImage({
          sourceUri: prepared.processedUri,
          originalSourceUri: pickedUri,
          previewSourceUri: prepared.previewUri,
          type: 'stamp',
          metadata: prepared.metadata,
        });

        const nextAssets = await getAssetsByType('stamp');
        setAssets(nextAssets);
        setSelectedAssetId(created.id);
      } finally {
        await removeFilesIfExist([prepared.processedUri, prepared.previewUri]);
      }
    } catch (error) {
      Alert.alert('Hata', getErrorMessage(error, 'Kaşe eklenirken hata oluştu.'));
    } finally {
      setBusy(false);
    }
  }, [busy]);

  const resolvedPlacementSize = useMemo(() => {
    const width = DEFAULT_STAMP_WIDTH_BY_PRESET[stampSizePreset];

    if (
      previewFrame.width <= 0 ||
      previewFrame.height <= 0 ||
      selectedAssetImageSize.width <= 0 ||
      selectedAssetImageSize.height <= 0
    ) {
      return {
        width,
        height: 0.12,
      };
    }

    const assetAspectRatio = selectedAssetImageSize.width / selectedAssetImageSize.height;
    const frameAspectRatio = previewFrame.width / previewFrame.height;

    const height = clamp01((width * frameAspectRatio) / assetAspectRatio);

    return clampOverlayFrame({
      x: 0,
      y: 0,
      width,
      height: Math.max(0.06, Math.min(0.38, height)),
    });
  }, [previewFrame.height, previewFrame.width, selectedAssetImageSize, stampSizePreset]);

  const handlePlaceStamp = useCallback(
    async (event: GestureResponderEvent) => {
      if (busy) {
        return;
      }

      if (!currentPage || !selectedAsset) {
        Alert.alert('Kaşe seç', 'Önce bir kaşe seç veya yeni bir kaşe ekle.');
        return;
      }

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
        return;
      }

      const relativeX = (locationX - previewFrame.x) / previewFrame.width;
      const relativeY = (locationY - previewFrame.y) / previewFrame.height;

      const nextFrame = clampOverlayFrame({
        x: relativeX - resolvedPlacementSize.width / 2,
        y: relativeY - resolvedPlacementSize.height / 2,
        width: resolvedPlacementSize.width,
        height: resolvedPlacementSize.height,
      });

      try {
        setBusy(true);

        await addStampOverlay({
          documentId,
          pageId: currentPage.id,
          assetId: selectedAsset.id,
          x: nextFrame.x,
          y: nextFrame.y,
          width: nextFrame.width,
          height: nextFrame.height,
          opacity: 0.95,
          rotation: 0,
        });

        await reloadCurrentPageOverlays();
      } catch (error) {
        Alert.alert('Hata', getErrorMessage(error, 'Kaşe yerleştirilemedi.'));
      } finally {
        setBusy(false);
      }
    },
    [
      busy,
      currentPage,
      documentId,
      previewFrame,
      reloadCurrentPageOverlays,
      resolvedPlacementSize.height,
      resolvedPlacementSize.width,
      selectedAsset,
    ],
  );

  const commitOverlayDraft = useCallback(
    async (draft: OverlayDraft | null) => {
      if (!draft) {
        dragSessionRef.current = null;
        resizeSessionRef.current = null;
        return;
      }

      try {
        setBusy(true);

        await updateOverlayTransform({
          overlayId: draft.overlayId,
          x: draft.x,
          y: draft.y,
          width: draft.width,
          height: draft.height,
          rotation: draft.rotation,
          opacity: draft.opacity,
        });

        await reloadCurrentPageOverlays();
      } catch (error) {
        Alert.alert('Hata', getErrorMessage(error, 'Öğe konumu güncellenemedi.'));
      } finally {
        dragSessionRef.current = null;
        resizeSessionRef.current = null;
        setOverlayDraft(null);
        setBusy(false);
      }
    },
    [reloadCurrentPageOverlays],
  );

  const handleOverlayDragStart = useCallback(
    (overlay: DocumentOverlay, event: GestureResponderEvent) => {
      if (busy || previewFrame.width <= 0 || previewFrame.height <= 0) {
        return;
      }

      setSelectedOverlayId(overlay.id);

      dragSessionRef.current = {
        overlayId: overlay.id,
        startPageX: event.nativeEvent.pageX,
        startPageY: event.nativeEvent.pageY,
        initialX: overlay.x,
        initialY: overlay.y,
        width: overlay.width,
        height: overlay.height,
        rotation: overlay.rotation,
        opacity: overlay.opacity,
      };

      resizeSessionRef.current = null;
      setOverlayDraft(buildOverlayDraftFromOverlay(overlay));
    },
    [busy, previewFrame.height, previewFrame.width],
  );

  const handleOverlayDragMove = useCallback(
    (event: GestureResponderEvent) => {
      const session = dragSessionRef.current;

      if (!session || previewFrame.width <= 0 || previewFrame.height <= 0) {
        return;
      }

      const deltaX = (event.nativeEvent.pageX - session.startPageX) / previewFrame.width;
      const deltaY = (event.nativeEvent.pageY - session.startPageY) / previewFrame.height;

      const nextFrame = clampOverlayFrame({
        x: session.initialX + deltaX,
        y: session.initialY + deltaY,
        width: session.width,
        height: session.height,
      });

      setOverlayDraft({
        overlayId: session.overlayId,
        x: nextFrame.x,
        y: nextFrame.y,
        width: nextFrame.width,
        height: nextFrame.height,
        rotation: session.rotation,
        opacity: session.opacity,
      });
    },
    [previewFrame.height, previewFrame.width],
  );

  const handleOverlayDragEnd = useCallback(async () => {
    const draft = overlayDraft;
    await commitOverlayDraft(draft);
  }, [commitOverlayDraft, overlayDraft]);

  const handleOverlayResizeStart = useCallback(
    (overlay: DocumentOverlay, event: GestureResponderEvent) => {
      if (busy || previewFrame.width <= 0 || previewFrame.height <= 0) {
        return;
      }

      setSelectedOverlayId(overlay.id);

      resizeSessionRef.current = {
        overlayId: overlay.id,
        startPageX: event.nativeEvent.pageX,
        startPageY: event.nativeEvent.pageY,
        initialX: overlay.x,
        initialY: overlay.y,
        initialWidth: overlay.width,
        initialHeight: overlay.height,
        rotation: overlay.rotation,
        opacity: overlay.opacity,
      };

      dragSessionRef.current = null;
      setOverlayDraft(buildOverlayDraftFromOverlay(overlay));
    },
    [busy, previewFrame.height, previewFrame.width],
  );

  const handleOverlayResizeMove = useCallback(
    (event: GestureResponderEvent) => {
      const session = resizeSessionRef.current;

      if (!session || previewFrame.width <= 0 || previewFrame.height <= 0) {
        return;
      }

      const deltaX = (event.nativeEvent.pageX - session.startPageX) / previewFrame.width;
      const deltaY = (event.nativeEvent.pageY - session.startPageY) / previewFrame.height;

      const nextFrame = clampOverlayFrame({
        x: session.initialX,
        y: session.initialY,
        width: session.initialWidth + deltaX,
        height: session.initialHeight + deltaY,
      });

      setOverlayDraft({
        overlayId: session.overlayId,
        x: nextFrame.x,
        y: nextFrame.y,
        width: nextFrame.width,
        height: nextFrame.height,
        rotation: session.rotation,
        opacity: session.opacity,
      });
    },
    [previewFrame.height, previewFrame.width],
  );

  const handleOverlayResizeEnd = useCallback(async () => {
    const draft = overlayDraft;
    await commitOverlayDraft(draft);
  }, [commitOverlayDraft, overlayDraft]);

  const handleDeleteOverlay = useCallback(
    async (overlayId: number) => {
      try {
        setBusy(true);
        await deleteOverlay(overlayId);
        await reloadCurrentPageOverlays();
      } catch (error) {
        Alert.alert('Hata', getErrorMessage(error, 'Öğe silinemedi.'));
      } finally {
        setBusy(false);
      }
    },
    [reloadCurrentPageOverlays],
  );

  const handleChangePage = useCallback(
    (nextIndex: number) => {
      if (!document || nextIndex < 0 || nextIndex >= document.pages.length) {
        return;
      }

      dragSessionRef.current = null;
      resizeSessionRef.current = null;
      setOverlayDraft(null);
      setCurrentPageIndex(nextIndex);
      setSelectedOverlayId(null);
    },
    [document],
  );

  const updateSelectedOverlaySize = useCallback(
    async (scaleDirection: 'down' | 'up') => {
      if (!selectedOverlay) {
        Alert.alert('Öğe seç', 'Önce boyutlandırmak istediğin öğeyi seç.');
        return;
      }

      const delta = scaleDirection === 'up' ? OVERLAY_SCALE_STEP : -OVERLAY_SCALE_STEP;

      const nextFrame = clampOverlayFrame({
        x: selectedOverlay.x,
        y: selectedOverlay.y,
        width: selectedOverlay.width + delta,
        height: selectedOverlay.height + delta * 0.55,
      });

      try {
        setBusy(true);

        await updateOverlayTransform({
          overlayId: selectedOverlay.id,
          x: nextFrame.x,
          y: nextFrame.y,
          width: nextFrame.width,
          height: nextFrame.height,
          rotation: selectedOverlay.rotation,
          opacity: selectedOverlay.opacity,
        });

        await reloadCurrentPageOverlays();
      } catch (error) {
        Alert.alert('Hata', getErrorMessage(error, 'Öğe boyutu güncellenemedi.'));
      } finally {
        setBusy(false);
      }
    },
    [reloadCurrentPageOverlays, selectedOverlay],
  );

  const handleUpdateSelectedSignatureColor = useCallback(
    async (strokeColor: string) => {
      if (!selectedOverlay || selectedOverlay.type !== 'signature') {
        Alert.alert('İmza seç', 'Önce renk değiştirmek istediğin imzayı seç.');
        return;
      }

      try {
        setBusy(true);

        await updateSignatureOverlayStyle({
          overlayId: selectedOverlay.id,
          strokeColor,
          opacity: selectedOverlay.opacity,
        });

        await reloadCurrentPageOverlays();
      } catch (error) {
        Alert.alert('Hata', getErrorMessage(error, 'İmza rengi güncellenemedi.'));
      } finally {
        setBusy(false);
      }
    },
    [reloadCurrentPageOverlays, selectedOverlay],
  );

  const overlayPreviewItems = useMemo<OverlayPreviewItem[]>(() => {
    return overlays
      .map((overlay) => {
        const draft = overlayDraft?.overlayId === overlay.id ? overlayDraft : null;
        const frame = draft
          ? {
              x: draft.x,
              y: draft.y,
              width: draft.width,
              height: draft.height,
              rotation: draft.rotation,
              opacity: draft.opacity,
            }
          : overlay;

        const style: ViewStyle = {
          position: 'absolute',
          left: previewFrame.x + frame.x * previewFrame.width,
          top: previewFrame.y + frame.y * previewFrame.height,
          width: frame.width * previewFrame.width,
          height: frame.height * previewFrame.height,
          opacity: frame.opacity,
          transform: [{ rotate: `${frame.rotation}deg` }],
        };

        if (overlay.type === 'signature') {
          const signature = getOverlaySignaturePresentation(overlay);

          if (!signature.strokes.length) {
            return null;
          }

          return {
            kind: 'signature',
            overlay,
            strokes: signature.strokes,
            color: signature.color,
            style,
            isSelected: overlay.id === selectedOverlayId,
          };
        }

        const assetId = getOverlayAssetId(overlay);
        const asset = assets.find((item) => item.id === assetId);

        if (!asset) {
          return null;
        }

        return {
          kind: 'stamp',
          overlay,
          asset,
          style,
          isSelected: overlay.id === selectedOverlayId,
        };
      })
      .filter(Boolean) as OverlayPreviewItem[];
  }, [assets, overlayDraft, overlays, previewFrame, selectedOverlayId]);

  if (loading) {
    return (
      <Screen title="PDF Editör" subtitle="Editör yükleniyor...">
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Editör yükleniyor...</Text>
        </View>
      </Screen>
    );
  }

  if (!document || !currentPage) {
    return (
      <Screen title="PDF Editör" subtitle="Düzenlenebilir sayfa bulunamadı.">
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>Bu belgede düzenlenecek sayfa yok</Text>
          <Text style={styles.emptyText}>
            Belgeyi tekrar tara veya farklı bir belge seç.
          </Text>

          <ToolbarButton
            title="Belge detayına dön"
            onPress={() => navigation.goBack()}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      title="PDF Editör"
      subtitle="İmzayı veya kaşeyi tutup sürükle, sağ alt tutamaçtan boyutlandır."
    >
      <View style={styles.summaryCard}>
        <View style={styles.summaryTextBlock}>
          <Text style={styles.summaryTitle}>Düzenlenen sayfa</Text>
          <Text style={styles.summaryHint}>
            Sayfa {currentPageIndex + 1} / {document.pages.length} • Bu sayfada{' '}
            {overlays.length} öğe var
          </Text>
        </View>

        <Text style={styles.summaryValue}>{assets.length}</Text>
      </View>

      <View style={styles.toolbarRow}>
        <ToolbarButton
          title="Yeni kaşe ekle"
          onPress={handleImportStamp}
          disabled={busy}
        />
        <ToolbarButton
          title="Kaşe & İmzalar"
          onPress={() => navigation.navigate('StampManager')}
          disabled={busy}
        />
        <ToolbarButton
          title="Akıllı sil"
          onPress={() =>
            navigation.navigate('SmartErase', {
              documentId,
              pageId: currentPage.id,
            })
          }
          disabled={busy}
        />
        <ToolbarButton
          title="Kaydet ve dön"
          onPress={() => navigation.goBack()}
          disabled={busy}
          active
        />
      </View>

      <View style={styles.toolbarRow}>
        <ToolbarButton
          title="Önceki sayfa"
          onPress={() => handleChangePage(currentPageIndex - 1)}
          disabled={busy || currentPageIndex === 0}
        />
        <ToolbarButton
          title="Sonraki sayfa"
          onPress={() => handleChangePage(currentPageIndex + 1)}
          disabled={busy || currentPageIndex === document.pages.length - 1}
        />
        <ToolbarButton
          title="Yeni imza ekle"
          onPress={() =>
            navigation.navigate('SignaturePad', {
              documentId,
              pageId: currentPage.id,
            })
          }
          disabled={busy}
        />
      </View>

      <View style={styles.sizeCard}>
        <Text style={styles.sizeCardTitle}>Yeni kaşe boyutu</Text>

        <View style={styles.sizeRow}>
          <ToolbarButton
            title="Küçük"
            onPress={() => setStampSizePreset('small')}
            active={stampSizePreset === 'small'}
            disabled={busy}
          />
          <ToolbarButton
            title="Orta"
            onPress={() => setStampSizePreset('medium')}
            active={stampSizePreset === 'medium'}
            disabled={busy}
          />
          <ToolbarButton
            title="Büyük"
            onPress={() => setStampSizePreset('large')}
            active={stampSizePreset === 'large'}
            disabled={busy}
          />
        </View>

        <Text style={styles.sizeHint}>
          Bu boyut sadece yeni eklenecek kaşelerde kullanılır.
        </Text>
      </View>

      {selectedOverlay ? (
        <View style={styles.adjustCard}>
          <Text style={styles.adjustTitle}>Seçili öğe ayarları</Text>
          <Text style={styles.adjustHint}>
            {formatOverlayPosition(selectedOverlay)} • Tutup sürükle, sağ alt köşeden boyutlandır
          </Text>

          {selectedOverlay.type === 'signature' && selectedSignatureInfo ? (
            <>
              <View style={styles.signatureMetaRow}>
                <Text style={styles.signatureMetaLabel}>İmza rengi</Text>
                <View
                  style={[
                    styles.signatureColorPreview,
                    { backgroundColor: selectedSignatureInfo.color },
                  ]}
                />
                <Text style={styles.signatureMetaValue}>{selectedSignatureInfo.color}</Text>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.colorPaletteRow}
              >
                {SIGNATURE_COLOR_PALETTE.map((color) => (
                  <SignatureColorSwatch
                    key={color}
                    color={color}
                    selected={selectedSignatureInfo.color === color}
                    onPress={() => {
                      void handleUpdateSelectedSignatureColor(color);
                    }}
                    disabled={busy}
                  />
                ))}
              </ScrollView>
            </>
          ) : null}

          <View style={styles.adjustRow}>
            <ToolbarButton
              title="Küçült"
              onPress={() => {
                void updateSelectedOverlaySize('down');
              }}
              disabled={busy}
            />
            <ToolbarButton
              title="Büyüt"
              onPress={() => {
                void updateSelectedOverlaySize('up');
              }}
              disabled={busy}
            />
          </View>
        </View>
      ) : null}

      <View onLayout={handlePreviewLayout} style={styles.previewContainer}>
        <Image
          source={{ uri: currentPage.image_path }}
          resizeMode="contain"
          style={styles.previewImage}
        />

        <Pressable
          style={styles.previewHitArea}
          onPress={handlePlaceStamp}
          disabled={busy}
        />

        {overlayPreviewItems.map((item) => (
          <View
            key={item.overlay.id}
            style={item.style}
            onStartShouldSetResponder={() => !busy}
            onResponderGrant={(event) => handleOverlayDragStart(item.overlay, event)}
            onResponderMove={handleOverlayDragMove}
            onResponderRelease={() => {
              void handleOverlayDragEnd();
            }}
            onResponderTerminate={() => {
              void handleOverlayDragEnd();
            }}
          >
            <View
              style={[
                styles.overlayContentBox,
                item.isSelected && styles.overlayContentBoxSelected,
              ]}
            >
              {item.kind === 'stamp' ? (
                <Image
                  source={{ uri: getPreferredAssetPreviewUri(item.asset) }}
                  resizeMode="contain"
                  style={styles.overlayImage}
                />
              ) : (
                <SignaturePreview
                  strokes={item.strokes}
                  color={item.color}
                  selected={item.isSelected}
                />
              )}
            </View>

            {item.isSelected ? (
              <View
                style={styles.resizeHandleHitArea}
                onStartShouldSetResponder={() => !busy}
                onResponderGrant={(event) => handleOverlayResizeStart(item.overlay, event)}
                onResponderMove={handleOverlayResizeMove}
                onResponderRelease={() => {
                  void handleOverlayResizeEnd();
                }}
                onResponderTerminate={() => {
                  void handleOverlayResizeEnd();
                }}
              >
                <View style={styles.resizeHandle} />
              </View>
            ) : null}
          </View>
        ))}

        <View pointerEvents="none" style={styles.previewHintContainer}>
          <Text style={styles.previewHintText}>
            Boş alana dokun: yeni kaşe • Öğeyi tut ve sürükle: taşı • Sağ alt tutamaç: büyüt/küçült
          </Text>
        </View>

        {busy ? (
          <View style={styles.busyOverlay} pointerEvents="none">
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        ) : null}
      </View>

      <Text style={styles.selectedAssetText}>
        Seçili kaşe: {selectedAsset ? selectedAsset.name : 'Yok'}
      </Text>

      {assets.length === 0 ? (
        <View style={styles.emptyAssetCard}>
          <Text style={styles.emptyAssetTitle}>Henüz kaşe yok</Text>
          <Text style={styles.emptyAssetText}>
            Kaşe ekleyip tekrar kullanabilir, sonra aynı kaşeyi farklı belgelere yerleştirebilirsin.
          </Text>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.assetList}
          style={styles.assetScroller}
        >
          {assets.map((asset) => (
            <Pressable
              key={asset.id}
              onPress={() => setSelectedAssetId(asset.id)}
              style={({ pressed }) => [
                styles.assetCard,
                selectedAssetId === asset.id && styles.assetCardSelected,
                pressed && styles.pressed,
              ]}
            >
              <Image
                source={{ uri: getPreferredAssetPreviewUri(asset) }}
                resizeMode="contain"
                style={styles.assetImage}
              />
              <Text numberOfLines={2} style={styles.assetName}>
                {asset.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      <View style={styles.overlayCard}>
        <Text style={styles.overlayCardTitle}>Bu sayfadaki öğeler</Text>

        {overlays.length === 0 ? (
          <Text style={styles.overlayEmptyText}>
            Henüz öğe yok. Kaşe yerleştir veya imza ekle.
          </Text>
        ) : (
          overlays.map((overlay, index) => {
            const assetId = getOverlayAssetId(overlay);
            const asset = assets.find((item) => item.id === assetId);
            const isSelected = selectedOverlayId === overlay.id;
            const isSignature = overlay.type === 'signature';
            const signature = isSignature
              ? getOverlaySignaturePresentation(overlay)
              : null;

            return (
              <Pressable
                key={overlay.id}
                onPress={() => setSelectedOverlayId(overlay.id)}
                style={({ pressed }) => [
                  styles.overlayRow,
                  index > 0 && styles.overlayRowBorder,
                  isSelected && styles.overlayRowSelected,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.overlayMeta}>
                  <Text style={styles.overlayRowText}>
                    {isSignature ? `İmza #${overlay.id}` : `Kaşe #${overlay.id}`}
                  </Text>
                  <Text style={styles.overlayRowHint}>
                    {isSignature
                      ? `İmza overlay • ${formatOverlayPosition(overlay)}`
                      : `${asset?.name ?? 'Bilinmeyen kaşe'} • ${formatOverlayPosition(overlay)}`}
                  </Text>

                  {isSignature && signature ? (
                    <View style={styles.overlaySignatureInfoRow}>
                      <View
                        style={[
                          styles.overlaySignatureColorDot,
                          { backgroundColor: signature.color },
                        ]}
                      />
                      <Text style={styles.overlaySignatureInfoText}>
                        {signature.color}
                      </Text>
                    </View>
                  ) : null}
                </View>

                <ToolbarButton
                  title="Sil"
                  onPress={() => handleDeleteOverlay(overlay.id)}
                  disabled={busy}
                  danger
                />
              </Pressable>
            );
          })
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 10,
  },
  loadingText: {
    color: colors.muted,
  },
  emptyContainer: {
    paddingVertical: 32,
    gap: 12,
    alignItems: 'flex-start',
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  emptyText: {
    color: colors.muted,
    lineHeight: 22,
  },
  summaryCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: Radius.xl,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  summaryTextBlock: {
    flex: 1,
    gap: 4,
  },
  summaryTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  summaryHint: {
    color: colors.muted,
    lineHeight: 20,
  },
  summaryValue: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
  },
  toolbarRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  toolbarButton: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  toolbarButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  toolbarButtonDanger: {
    backgroundColor: '#2A1620',
    borderColor: '#4B2632',
  },
  toolbarButtonDisabled: {
    opacity: 0.5,
  },
  toolbarButtonText: {
    color: colors.text,
    fontWeight: '700',
  },
  toolbarButtonTextActive: {
    color: colors.onPrimary,
  },
  toolbarButtonTextDanger: {
    color: '#FCA5A5',
  },
  colorSwatchOuter: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorSwatchOuterSelected: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  colorSwatchInner: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  sizeCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: 14,
    marginBottom: 16,
    gap: 10,
  },
  sizeCardTitle: {
    ...Typography.titleSmall,
    color: colors.text,
  },
  sizeRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  sizeHint: {
    ...Typography.bodySmall,
    color: colors.muted,
  },
  adjustCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: 14,
    marginBottom: 16,
    gap: 10,
  },
  adjustTitle: {
    ...Typography.titleSmall,
    color: colors.text,
  },
  adjustHint: {
    ...Typography.bodySmall,
    color: colors.muted,
  },
  adjustRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  signatureMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  signatureMetaLabel: {
    ...Typography.bodySmall,
    color: colors.textSecondary,
  },
  signatureMetaValue: {
    ...Typography.bodySmall,
    color: colors.text,
    fontWeight: '700',
  },
  signatureColorPreview: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.border,
  },
  colorPaletteRow: {
    gap: 10,
    paddingRight: 16,
  },
  pressed: {
    opacity: 0.92,
  },
  previewContainer: {
    width: '100%',
    height: 420,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#0F141B',
    overflow: 'hidden',
    marginBottom: 16,
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewHitArea: {
    ...StyleSheet.absoluteFillObject,
  },
  overlayContentBox: {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  overlayContentBoxSelected: {
    borderWidth: 2,
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  overlayImage: {
    width: '100%',
    height: '100%',
  },
  signatureOverlayBox: {
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent',
  },
  signatureOverlayBoxSelected: {
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  resizeHandleHitArea: {
    position: 'absolute',
    right: -10,
    bottom: -10,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resizeHandle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.background,
  },
  previewHintContainer: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
  },
  previewHintText: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    backgroundColor: 'rgba(11, 15, 20, 0.72)',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  busyOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(11, 15, 20, 0.18)',
  },
  selectedAssetText: {
    color: colors.muted,
    marginBottom: 10,
    fontWeight: '600',
  },
  assetScroller: {
    marginBottom: 18,
  },
  assetList: {
    gap: 10,
  },
  assetCard: {
    width: 96,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: 8,
  },
  assetCardSelected: {
    borderColor: colors.primary,
  },
  assetImage: {
    width: '100%',
    height: 60,
    marginBottom: 8,
  },
  assetName: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  emptyAssetCard: {
    backgroundColor: colors.card,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 18,
  },
  emptyAssetTitle: {
    color: colors.text,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptyAssetText: {
    color: colors.muted,
    lineHeight: 20,
  },
  overlayCard: {
    backgroundColor: colors.card,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  overlayCardTitle: {
    color: colors.text,
    fontWeight: '700',
    marginBottom: 10,
  },
  overlayEmptyText: {
    color: colors.muted,
  },
  overlayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
    borderRadius: 12,
    paddingHorizontal: 6,
  },
  overlayRowSelected: {
    backgroundColor: 'rgba(53, 199, 111, 0.08)',
  },
  overlayRowBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  overlayMeta: {
    flex: 1,
    gap: 2,
  },
  overlayRowText: {
    color: colors.text,
    fontWeight: '700',
  },
  overlayRowHint: {
    color: colors.muted,
    fontSize: 12,
  },
  overlaySignatureInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  overlaySignatureColorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: colors.border,
  },
  overlaySignatureInfoText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
});