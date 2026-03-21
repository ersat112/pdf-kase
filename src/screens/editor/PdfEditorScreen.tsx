import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
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
  EditorAssetTray,
} from '../../components/editor/EditorAssetTray';
import {
  EditorInspectorPanel,
} from '../../components/editor/EditorInspectorPanel';
import {
  EditorPageStrip,
  type EditorPageStripItem,
} from '../../components/editor/EditorPageStrip';
import {
  EditorToolTabBar,
  type EditorToolTabKey,
} from '../../components/editor/EditorToolTabBar';
import {
  createAssetFromImage,
  getAssetsByType,
  getPreferredAssetPreviewUri,
  parseAssetMetadata,
  type AssetType,
  type StoredAsset,
} from '../../modules/assets/asset.service';
import {
  documentActionLabels,
  documentEditorCopy,
} from '../../modules/documents/document-action-copy';
import {
  getDocumentDetail,
  type DocumentDetail,
} from '../../modules/documents/document.service';
import { prepareStampAssetImage } from '../../modules/imaging/imaging.service';
import {
  addSignatureAssetOverlay,
  addStampOverlay,
  deleteOverlay,
  getOverlayAssetId,
  getOverlaySignatureColor,
  getPageOverlays,
  updateOverlayTransform,
  updateSignatureOverlayStyle,
  type DocumentOverlay,
} from '../../modules/overlays/overlay.service';
import { removeFilesIfExist } from '../../modules/storage/file.service';
import type { RootStackParamList } from '../../navigation/types';
import {
  Radius,
  Shadows,
  Spacing,
  Typography,
  colors,
} from '../../theme';

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
      asset: StoredAsset;
      style: ViewStyle;
      isSelected: boolean;
    };

type SnapGuides = {
  vertical: number[];
  horizontal: number[];
  labels: string[];
};

const DEFAULT_STAMP_WIDTH_BY_PRESET: Record<StampSizePreset, number> = {
  small: 0.18,
  medium: 0.28,
  large: 0.38,
};

const OVERLAY_SCALE_STEP = 0.03;
const OVERLAY_OPACITY_STEP = 0.1;
const OVERLAY_MIN_WIDTH = 0.08;
const OVERLAY_MAX_WIDTH = 0.7;
const OVERLAY_MIN_HEIGHT = 0.04;
const OVERLAY_MAX_HEIGHT = 0.7;
const OVERLAY_SNAP_THRESHOLD = 0.025;
const DEFAULT_SIGNATURE_COLOR = '#111111';
const SIGNATURE_OVERLAY_COLORS = [
  '#111111',
  '#374151',
  '#2563EB',
  '#0F766E',
  '#7C3AED',
  '#D97706',
  '#DC2626',
  '#15803D',
] as const;

function SmallActionButton({
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
        styles.smallActionButton,
        active && styles.smallActionButtonActive,
        danger && styles.smallActionButtonDanger,
        disabled && styles.actionDisabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Text
        style={[
          styles.smallActionButtonText,
          active && styles.smallActionButtonTextActive,
          danger && styles.smallActionButtonTextDanger,
        ]}
      >
        {title}
      </Text>
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

function formatOverlaySize(overlay: Pick<DocumentOverlay, 'width' | 'height'>) {
  const width = Math.round(overlay.width * 100);
  const height = Math.round(overlay.height * 100);

  return `G:${width}% • Y:${height}%`;
}

function formatOverlayOpacity(opacity: number) {
  return `Opaklık ${Math.round(opacity * 100)}%`;
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

function getAssetLabel(type: AssetType) {
  return type === 'stamp' ? 'Kaşe' : 'İmza';
}

function getSnapTargets(width: number, height: number) {
  return {
    horizontal: [
      { edge: 'left' as const, position: 0, x: 0 },
      { edge: 'center-x' as const, position: width / 2, x: 0.5 - width / 2 },
      { edge: 'right' as const, position: 1, x: 1 - width },
    ],
    vertical: [
      { edge: 'top' as const, position: 0, y: 0 },
      { edge: 'center-y' as const, position: height / 2, y: 0.5 - height / 2 },
      { edge: 'bottom' as const, position: 1, y: 1 - height },
    ],
  };
}

function applySnapToFrame(frame: {
  x: number;
  y: number;
  width: number;
  height: number;
}) {
  const clamped = clampOverlayFrame(frame);
  const targets = getSnapTargets(clamped.width, clamped.height);
  const guides: SnapGuides = {
    vertical: [],
    horizontal: [],
    labels: [],
  };

  let nextX = clamped.x;
  let nextY = clamped.y;

  const currentLeft = clamped.x;
  const currentCenterX = clamped.x + clamped.width / 2;
  const currentRight = clamped.x + clamped.width;

  const currentTop = clamped.y;
  const currentCenterY = clamped.y + clamped.height / 2;
  const currentBottom = clamped.y + clamped.height;

  const horizontalMatches = [
    {
      distance: Math.abs(currentLeft - targets.horizontal[0].position),
      apply: targets.horizontal[0].x,
      guide: 0,
      label: 'Sola hizalandı',
    },
    {
      distance: Math.abs(currentCenterX - targets.horizontal[1].position),
      apply: targets.horizontal[1].x,
      guide: 0.5,
      label: 'Yatay merkeze hizalandı',
    },
    {
      distance: Math.abs(currentRight - targets.horizontal[2].position),
      apply: targets.horizontal[2].x,
      guide: 1,
      label: 'Sağa hizalandı',
    },
  ].sort((a, b) => a.distance - b.distance);

  if (horizontalMatches[0] && horizontalMatches[0].distance <= OVERLAY_SNAP_THRESHOLD) {
    nextX = horizontalMatches[0].apply;
    guides.vertical.push(horizontalMatches[0].guide);
    guides.labels.push(horizontalMatches[0].label);
  }

  const verticalMatches = [
    {
      distance: Math.abs(currentTop - targets.vertical[0].position),
      apply: targets.vertical[0].y,
      guide: 0,
      label: 'Üste hizalandı',
    },
    {
      distance: Math.abs(currentCenterY - targets.vertical[1].position),
      apply: targets.vertical[1].y,
      guide: 0.5,
      label: 'Dikey merkeze hizalandı',
    },
    {
      distance: Math.abs(currentBottom - targets.vertical[2].position),
      apply: targets.vertical[2].y,
      guide: 1,
      label: 'Alta hizalandı',
    },
  ].sort((a, b) => a.distance - b.distance);

  if (verticalMatches[0] && verticalMatches[0].distance <= OVERLAY_SNAP_THRESHOLD) {
    nextY = verticalMatches[0].apply;
    guides.horizontal.push(verticalMatches[0].guide);
    guides.labels.push(verticalMatches[0].label);
  }

  return {
    frame: {
      ...clamped,
      x: nextX,
      y: nextY,
    },
    guides,
  };
}

export function PdfEditorScreen({ route, navigation }: Props) {
  const { documentId } = route.params;

  const [document, setDocument] = useState<DocumentDetail | null>(null);
  const [stampAssets, setStampAssets] = useState<StoredAsset[]>([]);
  const [signatureAssets, setSignatureAssets] = useState<StoredAsset[]>([]);
  const [activeLibraryType, setActiveLibraryType] = useState<AssetType>('stamp');
  const [selectedAssetId, setSelectedAssetId] = useState<number | null>(null);
  const [overlays, setOverlays] = useState<DocumentOverlay[]>([]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [selectedOverlayId, setSelectedOverlayId] = useState<number | null>(null);
  const [stampSizePreset, setStampSizePreset] = useState<StampSizePreset>('medium');
  const [signaturePlacementColor, setSignaturePlacementColor] = useState(
    DEFAULT_SIGNATURE_COLOR,
  );
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [previewSize, setPreviewSize] = useState<Size>({ width: 0, height: 0 });
  const [pageImageSize, setPageImageSize] = useState<Size>({ width: 0, height: 0 });
  const [selectedAssetImageSize, setSelectedAssetImageSize] = useState<Size>({
    width: 0,
    height: 0,
  });
  const [overlayDraft, setOverlayDraft] = useState<OverlayDraft | null>(null);
  const [activeTab, setActiveTab] = useState<EditorToolTabKey>('insert');

  const dragSessionRef = useRef<DragSession | null>(null);
  const resizeSessionRef = useRef<ResizeSession | null>(null);

  const currentPage = document?.pages[currentPageIndex] ?? null;

  const allAssets = useMemo(
    () => [...stampAssets, ...signatureAssets],
    [signatureAssets, stampAssets],
  );

  const activeLibraryAssets = useMemo(
    () => (activeLibraryType === 'stamp' ? stampAssets : signatureAssets),
    [activeLibraryType, signatureAssets, stampAssets],
  );

  const selectedAsset = useMemo(
    () => activeLibraryAssets.find((asset) => asset.id === selectedAssetId) ?? null,
    [activeLibraryAssets, selectedAssetId],
  );

  const selectedOverlay = useMemo(
    () => overlays.find((overlay) => overlay.id === selectedOverlayId) ?? null,
    [overlays, selectedOverlayId],
  );

  const selectedOverlaySignatureColor = useMemo(() => {
    if (!selectedOverlay || selectedOverlay.type !== 'signature') {
      return DEFAULT_SIGNATURE_COLOR;
    }

    return normalizeHexColor(getOverlaySignatureColor(selectedOverlay));
  }, [selectedOverlay]);

  const selectedOverlayAsset = useMemo(() => {
    if (!selectedOverlay) {
      return null;
    }

    const assetId = getOverlayAssetId(selectedOverlay);
    return allAssets.find((asset) => asset.id === assetId) ?? null;
  }, [allAssets, selectedOverlay]);

  const previewFrame = useMemo(
    () => fitContain(previewSize, pageImageSize),
    [pageImageSize, previewSize],
  );

  const activeOverlayFrame = useMemo(() => {
    if (!selectedOverlay) {
      return null;
    }

    const draft =
      overlayDraft && overlayDraft.overlayId === selectedOverlay.id
        ? overlayDraft
        : selectedOverlay;

    return {
      x: draft.x,
      y: draft.y,
      width: draft.width,
      height: draft.height,
      rotation: draft.rotation,
      opacity: draft.opacity,
    };
  }, [overlayDraft, selectedOverlay]);

  const snapGuides = useMemo(() => {
    if (!activeOverlayFrame || previewFrame.width <= 0 || previewFrame.height <= 0) {
      return {
        vertical: [] as number[],
        horizontal: [] as number[],
        labels: [] as string[],
      };
    }

    return applySnapToFrame(activeOverlayFrame).guides;
  }, [activeOverlayFrame, previewFrame.height, previewFrame.width]);

  const reloadCurrentPageOverlays = useCallback(
    async (preferredSelectedOverlayId?: number | null) => {
      if (!currentPage) {
        setOverlays([]);
        setSelectedOverlayId(null);
        setOverlayDraft(null);
        return;
      }

      const pageOverlays = await getPageOverlays(currentPage.id);
      setOverlays(pageOverlays);
      setSelectedOverlayId((current) => {
        if (
          preferredSelectedOverlayId &&
          pageOverlays.some((overlay) => overlay.id === preferredSelectedOverlayId)
        ) {
          return preferredSelectedOverlayId;
        }

        if (current && pageOverlays.some((overlay) => overlay.id === current)) {
          return current;
        }

        return pageOverlays[0]?.id ?? null;
      });
      setOverlayDraft(null);
    },
    [currentPage],
  );

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const run = async () => {
        try {
          setLoading(true);

          const [doc, nextStampAssets, nextSignatureAssets] = await Promise.all([
            getDocumentDetail(documentId),
            getAssetsByType('stamp'),
            getAssetsByType('signature'),
          ]);

          if (!active) {
            return;
          }

          setDocument(doc);
          setStampAssets(nextStampAssets);
          setSignatureAssets(nextSignatureAssets);
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
    if (selectedOverlay) {
      setActiveTab('format');
    }
  }, [selectedOverlay?.id]);

  useEffect(() => {
    if (selectedOverlay?.type === 'signature') {
      setSignaturePlacementColor(selectedOverlaySignatureColor);
      return;
    }

    if (activeLibraryType !== 'signature') {
      return;
    }

    setSignaturePlacementColor((current) => normalizeHexColor(current));
  }, [activeLibraryType, selectedOverlay?.id, selectedOverlay?.type, selectedOverlaySignatureColor]);

  useEffect(() => {
    const nextAssets = activeLibraryType === 'stamp' ? stampAssets : signatureAssets;

    setSelectedAssetId((current) => {
      if (current && nextAssets.some((asset) => asset.id === current)) {
        return current;
      }

      return nextAssets[0]?.id ?? null;
    });
  }, [activeLibraryType, signatureAssets, stampAssets]);

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
        console.warn('[PdfEditor] Failed to resolve selected asset size:', error);

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

        const nextStampAssets = await getAssetsByType('stamp');
        setStampAssets(nextStampAssets);
        setActiveLibraryType('stamp');
        setSelectedAssetId(created.id);
        setActiveTab('insert');
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

  const handlePlaceSelectedAsset = useCallback(
    async (event: GestureResponderEvent) => {
      if (busy) {
        return;
      }

      if (!currentPage || !selectedAsset) {
        Alert.alert(
          `${getAssetLabel(activeLibraryType)} seç`,
          activeLibraryType === 'stamp'
            ? 'Önce bir kaşe seç veya yeni bir kaşe ekle.'
            : 'Önce bir hazır imza seç veya yeni imza oluştur.',
        );
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

      const snapped = applySnapToFrame({
        x: relativeX - resolvedPlacementSize.width / 2,
        y: relativeY - resolvedPlacementSize.height / 2,
        width: resolvedPlacementSize.width,
        height: resolvedPlacementSize.height,
      });

      try {
        setBusy(true);

        if (activeLibraryType === 'signature') {
          const metadata = parseAssetMetadata(selectedAsset.metadata ?? null);
          const strokeColor =
            typeof metadata.strokeColor === 'string'
              ? normalizeHexColor(metadata.strokeColor)
              : signaturePlacementColor;

          await addSignatureAssetOverlay({
            documentId,
            pageId: currentPage.id,
            assetId: selectedAsset.id,
            x: snapped.frame.x,
            y: snapped.frame.y,
            width: snapped.frame.width,
            height: snapped.frame.height,
            opacity: 1,
            rotation: 0,
            strokeColor,
          });
        } else {
          await addStampOverlay({
            documentId,
            pageId: currentPage.id,
            assetId: selectedAsset.id,
            x: snapped.frame.x,
            y: snapped.frame.y,
            width: snapped.frame.width,
            height: snapped.frame.height,
            opacity: 0.95,
            rotation: 0,
          });
        }

        await reloadCurrentPageOverlays();
      } catch (error) {
        Alert.alert(
          'Hata',
          getErrorMessage(
            error,
            activeLibraryType === 'stamp'
              ? 'Kaşe yerleştirilemedi.'
              : 'Hazır imza yerleştirilemedi.',
          ),
        );
      } finally {
        setBusy(false);
      }
    },
    [
      activeLibraryType,
      busy,
      currentPage,
      documentId,
      previewFrame,
      reloadCurrentPageOverlays,
      resolvedPlacementSize.height,
      resolvedPlacementSize.width,
      selectedAsset,
      signaturePlacementColor,
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

      const snapped = applySnapToFrame({
        x: session.initialX + deltaX,
        y: session.initialY + deltaY,
        width: session.width,
        height: session.height,
      });

      setOverlayDraft({
        overlayId: session.overlayId,
        x: snapped.frame.x,
        y: snapped.frame.y,
        width: snapped.frame.width,
        height: snapped.frame.height,
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

      const snapped = applySnapToFrame({
        x: session.initialX,
        y: session.initialY,
        width: session.initialWidth + deltaX,
        height: session.initialHeight + deltaY,
      });

      setOverlayDraft({
        overlayId: session.overlayId,
        x: snapped.frame.x,
        y: snapped.frame.y,
        width: snapped.frame.width,
        height: snapped.frame.height,
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

      const snapped = applySnapToFrame({
        x: selectedOverlay.x,
        y: selectedOverlay.y,
        width: selectedOverlay.width + delta,
        height: selectedOverlay.height + delta * 0.55,
      });

      try {
        setBusy(true);

        await updateOverlayTransform({
          overlayId: selectedOverlay.id,
          x: snapped.frame.x,
          y: snapped.frame.y,
          width: snapped.frame.width,
          height: snapped.frame.height,
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

  const applySelectedOverlayPreset = useCallback(
    async (preset: StampSizePreset) => {
      if (!selectedOverlay) {
        Alert.alert('Öğe seç', 'Önce hazır boyut uygulamak istediğin öğeyi seç.');
        return;
      }

      const targetWidth = DEFAULT_STAMP_WIDTH_BY_PRESET[preset];
      const ratio =
        selectedOverlay.width > 0 && selectedOverlay.height > 0
          ? selectedOverlay.height / selectedOverlay.width
          : 0.55;
      const targetHeight = targetWidth * ratio;

      const snapped = applySnapToFrame({
        x: selectedOverlay.x,
        y: selectedOverlay.y,
        width: targetWidth,
        height: targetHeight,
      });

      try {
        setBusy(true);

        await updateOverlayTransform({
          overlayId: selectedOverlay.id,
          x: snapped.frame.x,
          y: snapped.frame.y,
          width: snapped.frame.width,
          height: snapped.frame.height,
          rotation: selectedOverlay.rotation,
          opacity: selectedOverlay.opacity,
        });

        await reloadCurrentPageOverlays();
      } catch (error) {
        Alert.alert('Hata', getErrorMessage(error, 'Hazır boyut uygulanamadı.'));
      } finally {
        setBusy(false);
      }
    },
    [reloadCurrentPageOverlays, selectedOverlay],
  );

  const updateSelectedOverlayOpacity = useCallback(
    async (direction: 'down' | 'up') => {
      if (!selectedOverlay) {
        Alert.alert('Öğe seç', 'Önce opaklığını değiştirmek istediğin öğeyi seç.');
        return;
      }

      const nextOpacity = clamp01(
        selectedOverlay.opacity + (direction === 'up' ? OVERLAY_OPACITY_STEP : -OVERLAY_OPACITY_STEP),
      );

      try {
        setBusy(true);

        await updateOverlayTransform({
          overlayId: selectedOverlay.id,
          x: selectedOverlay.x,
          y: selectedOverlay.y,
          width: selectedOverlay.width,
          height: selectedOverlay.height,
          rotation: selectedOverlay.rotation,
          opacity: nextOpacity,
        });

        await reloadCurrentPageOverlays();
      } catch (error) {
        Alert.alert('Hata', getErrorMessage(error, 'Opaklık güncellenemedi.'));
      } finally {
        setBusy(false);
      }
    },
    [reloadCurrentPageOverlays, selectedOverlay],
  );

  const handleDuplicateSelectedOverlay = useCallback(async () => {
    if (!selectedOverlay || !currentPage) {
      Alert.alert('Öğe seç', 'Önce çoğaltmak istediğin kaşe veya imzayı seç.');
      return;
    }

    const assetId = getOverlayAssetId(selectedOverlay);

    if (!assetId) {
      Alert.alert('Öğe çoğaltılamadı', 'Seçili overlay için asset bilgisi bulunamadı.');
      return;
    }

    const snapped = applySnapToFrame({
      x: Math.min(selectedOverlay.x + 0.03, 1 - selectedOverlay.width),
      y: Math.min(selectedOverlay.y + 0.03, 1 - selectedOverlay.height),
      width: selectedOverlay.width,
      height: selectedOverlay.height,
    });

    try {
      setBusy(true);

      let nextOverlayId: number;

      if (selectedOverlay.type === 'signature') {
        nextOverlayId = await addSignatureAssetOverlay({
          documentId,
          pageId: currentPage.id,
          assetId,
          x: snapped.frame.x,
          y: snapped.frame.y,
          width: snapped.frame.width,
          height: snapped.frame.height,
          rotation: selectedOverlay.rotation,
          opacity: selectedOverlay.opacity,
          strokeColor: normalizeHexColor(getOverlaySignatureColor(selectedOverlay)),
        });
      } else {
        nextOverlayId = await addStampOverlay({
          documentId,
          pageId: currentPage.id,
          assetId,
          x: snapped.frame.x,
          y: snapped.frame.y,
          width: snapped.frame.width,
          height: snapped.frame.height,
          rotation: selectedOverlay.rotation,
          opacity: selectedOverlay.opacity,
        });
      }

      await reloadCurrentPageOverlays(nextOverlayId);
    } catch (error) {
      Alert.alert('Hata', getErrorMessage(error, 'Seçili öğe çoğaltılamadı.'));
    } finally {
      setBusy(false);
    }
  }, [currentPage, documentId, reloadCurrentPageOverlays, selectedOverlay]);

  const updateSelectedSignatureColorValue = useCallback(
    async (nextColor: string) => {
      const normalizedColor = normalizeHexColor(nextColor);

      if (selectedOverlay?.type === 'signature') {
        try {
          setBusy(true);
          await updateSignatureOverlayStyle({
            overlayId: selectedOverlay.id,
            strokeColor: normalizedColor,
            opacity: selectedOverlay.opacity,
          });
          await reloadCurrentPageOverlays();
          setSignaturePlacementColor(normalizedColor);
        } catch (error) {
          Alert.alert('Hata', getErrorMessage(error, 'İmza rengi güncellenemedi.'));
        } finally {
          setBusy(false);
        }

        return;
      }

      setSignaturePlacementColor(normalizedColor);
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
          const assetId = getOverlayAssetId(overlay);
          const asset = allAssets.find(
            (item) => item.id === assetId && item.type === 'signature',
          );

          if (!asset) {
            return null;
          }

          return {
            kind: 'signature',
            overlay,
            asset,
            style,
            isSelected: overlay.id === selectedOverlayId,
          };
        }

        const assetId = getOverlayAssetId(overlay);
        const asset = allAssets.find((item) => item.id === assetId);

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
  }, [allAssets, overlayDraft, overlays, previewFrame, selectedOverlayId]);

  const pageStripItems = useMemo<EditorPageStripItem[]>(() => {
    if (!document) {
      return [];
    }

    return document.pages.map((page, index) => ({
      key: String(page.id),
      label: `Sayfa ${index + 1}`,
      imageUri: page.image_path,
      active: index === currentPageIndex,
      onPress: () => handleChangePage(index),
    }));
  }, [currentPageIndex, document, handleChangePage]);

  const viewOverlaySummary = selectedOverlay
    ? `${selectedOverlay.type === 'stamp' ? 'Kaşe' : 'İmza'} seçili • ${formatOverlayPosition(
        selectedOverlay,
      )}`
    : selectedAsset
      ? `Seçili ${activeLibraryType === 'stamp' ? 'kaşe' : 'imza'} • ${selectedAsset.name}`
      : 'Henüz seçim yok';

  if (loading) {
    return (
      <Screen
        title={documentEditorCopy.screenTitle}
        subtitle={documentEditorCopy.loadingSubtitle}
      >
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>{documentEditorCopy.loadingText}</Text>
        </View>
      </Screen>
    );
  }

  if (!document || !currentPage) {
    return (
      <Screen
        title={documentEditorCopy.screenTitle}
        subtitle={documentEditorCopy.emptySubtitle}
      >
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>{documentEditorCopy.emptyTitle}</Text>
          <Text style={styles.emptyText}>{documentEditorCopy.emptyText}</Text>

          <SmallActionButton
            title={documentEditorCopy.backToDetail}
            onPress={() => navigation.goBack()}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      title={documentEditorCopy.screenTitle}
      subtitle={documentEditorCopy.screenSubtitle}
    >
      <View style={styles.heroCard}>
        <View style={styles.heroHeader}>
          <View style={styles.heroTextWrap}>
            <Text style={styles.heroEyebrow}>{documentEditorCopy.sessionEyebrow}</Text>
            <Text style={styles.heroTitle}>{document.title || `Belge #${document.id}`}</Text>
            <Text style={styles.heroSubtitle}>
              {documentEditorCopy.resolveSessionSubtitle(
                currentPageIndex + 1,
                document.pages.length,
                overlays.length,
              )}
            </Text>
          </View>

          <View style={styles.heroCounterPill}>
            <Text style={styles.heroCounterPillText}>{activeLibraryAssets.length}</Text>
          </View>
        </View>

        <View style={styles.heroActionRow}>
          <SmallActionButton
            title={documentActionLabels.stampsAndSignatures}
            onPress={() => navigation.navigate('StampManager')}
            disabled={busy}
          />
          <SmallActionButton
            title={documentActionLabels.smartErase}
            onPress={() =>
              navigation.navigate('SmartErase', {
                documentId,
                pageId: currentPage.id,
              })
            }
            disabled={busy}
          />
          <SmallActionButton
            title={documentActionLabels.saveAndBack}
            onPress={() => navigation.goBack()}
            disabled={busy}
            active
          />
        </View>
      </View>

      <View style={styles.previewShell}>
        <View onLayout={handlePreviewLayout} style={styles.previewContainer}>
          <Image
            source={{ uri: currentPage.image_path }}
            resizeMode="contain"
            style={styles.previewImage}
          />

          <Pressable
            style={styles.previewHitArea}
            onPress={handlePlaceSelectedAsset}
            disabled={busy}
          />

          {snapGuides.vertical.map((position, index) => (
            <View
              key={`snap-v-${position}-${index}`}
              pointerEvents="none"
              style={[
                styles.snapGuideVertical,
                {
                  left: previewFrame.x + position * previewFrame.width,
                  top: previewFrame.y,
                  height: previewFrame.height,
                },
              ]}
            />
          ))}

          {snapGuides.horizontal.map((position, index) => (
            <View
              key={`snap-h-${position}-${index}`}
              pointerEvents="none"
              style={[
                styles.snapGuideHorizontal,
                {
                  left: previewFrame.x,
                  top: previewFrame.y + position * previewFrame.height,
                  width: previewFrame.width,
                },
              ]}
            />
          ))}

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
                <Image
                  source={{ uri: getPreferredAssetPreviewUri(item.asset) }}
                  resizeMode="contain"
                  style={[
                    styles.overlayImage,
                    item.kind === 'signature'
                      ? { tintColor: normalizeHexColor(getOverlaySignatureColor(item.overlay)) }
                      : null,
                  ]}
                />

                {item.isSelected ? (
                  <View pointerEvents="none" style={styles.overlaySelectionBadge}>
                    <Text style={styles.overlaySelectionBadgeText}>
                      {item.kind === 'stamp' ? 'Kaşe' : 'İmza'} • {item.asset.name}
                    </Text>
                  </View>
                ) : null}
              </View>

              {item.isSelected ? (
                <>
                  <View pointerEvents="none" style={styles.overlayCenterDot} />

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
                </>
              ) : null}
            </View>
          ))}

          <View pointerEvents="none" style={styles.previewHintContainer}>
            <Text style={styles.previewHintText}>
              {documentEditorCopy.previewHint}
            </Text>

            {snapGuides.labels.length > 0 ? (
              <View style={styles.snapHintPill}>
                <Text style={styles.snapHintPillText}>
                  {snapGuides.labels.join(' • ')}
                </Text>
              </View>
            ) : null}
          </View>

          {busy ? (
            <View style={styles.busyOverlay} pointerEvents="none">
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : null}
        </View>
      </View>

      <EditorPageStrip
        title={documentEditorCopy.pageStripTitle}
        subtitle={documentEditorCopy.pageStripSubtitle}
        items={pageStripItems}
      />

      <View style={styles.contextCard}>
        <Text style={styles.contextLabel}>{documentEditorCopy.currentStateLabel}</Text>
        <Text style={styles.contextValue}>{viewOverlaySummary}</Text>
      </View>

      <EditorToolTabBar
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'view',
            label: documentEditorCopy.tabLabels.view,
            icon: 'image-outline',
          },
          {
            key: 'format',
            label: documentEditorCopy.tabLabels.format,
            icon: 'options-outline',
          },
          {
            key: 'insert',
            label: documentEditorCopy.tabLabels.insert,
            icon: 'add-circle-outline',
          },
        ]}
      />

      {activeTab === 'insert' ? (
        <EditorAssetTray
          activeLibraryType={activeLibraryType}
          onChangeLibraryType={(type) => {
            setActiveLibraryType(type);
            setActiveTab('insert');
          }}
          assets={activeLibraryAssets}
          selectedAssetId={selectedAssetId}
          onSelectAsset={setSelectedAssetId}
          stampSizePreset={stampSizePreset}
          onChangeStampSizePreset={setStampSizePreset}
          signaturePlacementColor={signaturePlacementColor}
          signatureColors={SIGNATURE_OVERLAY_COLORS}
          onSelectSignatureColor={(color) => {
            void updateSelectedSignatureColorValue(color);
          }}
          busy={busy}
          onImportStamp={() => {
            void handleImportStamp();
          }}
          onOpenStampManager={() => navigation.navigate('StampManager')}
          onCreateSignature={() =>
            navigation.navigate('SignaturePad', {
              documentId,
              pageId: currentPage.id,
            })
          }
        />
      ) : null}

      {activeTab === 'format' ? (
        <EditorInspectorPanel
          selectedOverlayLabel={
            selectedOverlay
              ? `${selectedOverlay.type === 'stamp' ? 'Kaşe' : 'İmza'} • ${
                  selectedOverlayAsset?.name ?? 'Öğe'
                }`
              : null
          }
          selectedOverlayMeta={
            selectedOverlay ? formatOverlayPosition(selectedOverlay) : null
          }
          selectedOverlayDetail={
            selectedOverlay
              ? `${formatOverlaySize(selectedOverlay)} • ${formatOverlayOpacity(
                  selectedOverlay.opacity,
                )}`
              : null
          }
          isSignature={selectedOverlay?.type === 'signature'}
          signatureColor={selectedOverlaySignatureColor}
          signatureColors={SIGNATURE_OVERLAY_COLORS}
          onSelectSignatureColor={(color) => {
            void updateSelectedSignatureColorValue(color);
          }}
          onScaleDown={() => {
            void updateSelectedOverlaySize('down');
          }}
          onScaleUp={() => {
            void updateSelectedOverlaySize('up');
          }}
          onApplyPreset={(preset) => {
            void applySelectedOverlayPreset(preset);
          }}
          onOpacityDown={() => {
            void updateSelectedOverlayOpacity('down');
          }}
          onOpacityUp={() => {
            void updateSelectedOverlayOpacity('up');
          }}
          onDuplicate={() => {
            void handleDuplicateSelectedOverlay();
          }}
          onDelete={() => {
            if (selectedOverlay) {
              void handleDeleteOverlay(selectedOverlay.id);
            }
          }}
          busy={busy}
        />
      ) : null}

      {activeTab === 'view' ? (
        <>
          <View style={styles.viewActionCard}>
            <Text style={styles.viewActionTitle}>{documentEditorCopy.viewTitle}</Text>
            <Text style={styles.viewActionText}>{documentEditorCopy.viewText}</Text>

            <View style={styles.heroActionRow}>
              <SmallActionButton
                title={documentActionLabels.previousPage}
                onPress={() => handleChangePage(currentPageIndex - 1)}
                disabled={busy || currentPageIndex === 0}
              />
              <SmallActionButton
                title={documentActionLabels.nextPage}
                onPress={() => handleChangePage(currentPageIndex + 1)}
                disabled={busy || currentPageIndex === document.pages.length - 1}
              />
              <SmallActionButton
                title={documentActionLabels.newSignature}
                onPress={() =>
                  navigation.navigate('SignaturePad', {
                    documentId,
                    pageId: currentPage.id,
                  })
                }
                disabled={busy}
              />
            </View>
          </View>

          <View style={styles.overlayCard}>
            <Text style={styles.overlayCardTitle}>
              {documentEditorCopy.pageItemsTitle}
            </Text>

            {overlays.length === 0 ? (
              <Text style={styles.overlayEmptyText}>
                {documentEditorCopy.pageItemsEmpty}
              </Text>
            ) : (
              overlays.map((overlay, index) => {
                const assetId = getOverlayAssetId(overlay);
                const asset = allAssets.find((item) => item.id === assetId);
                const isSelected = selectedOverlayId === overlay.id;
                const isSignature = overlay.type === 'signature';

                return (
                  <Pressable
                    key={overlay.id}
                    onPress={() => {
                      setSelectedOverlayId(overlay.id);
                      setActiveTab('format');
                    }}
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
                        {(asset?.name ?? 'Varlık')} • {formatOverlayPosition(overlay)}
                      </Text>
                      <Text style={styles.overlayRowHint}>
                        {formatOverlaySize(overlay)} • {formatOverlayOpacity(overlay.opacity)}
                      </Text>
                    </View>

                    <View style={styles.overlayRowActions}>
                      <SmallActionButton
                        title="Sil"
                        onPress={() => {
                          void handleDeleteOverlay(overlay.id);
                        }}
                        disabled={busy}
                        danger
                      />
                    </View>
                  </Pressable>
                );
              })
            )}
          </View>
        </>
      ) : null}
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
  heroCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    gap: Spacing.md,
    marginBottom: Spacing.lg,
    ...Shadows.sm,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  heroTextWrap: {
    flex: 1,
    gap: 4,
  },
  heroEyebrow: {
    ...Typography.caption,
    color: colors.primary,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  heroTitle: {
    ...Typography.titleLarge,
    color: colors.text,
  },
  heroSubtitle: {
    ...Typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  heroCounterPill: {
    minWidth: 44,
    minHeight: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCounterPillText: {
    ...Typography.titleSmall,
    color: colors.text,
    fontWeight: '900',
  },
  heroActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  smallActionButton: {
    minHeight: 38,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallActionButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  smallActionButtonDanger: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderColor: 'rgba(239, 68, 68, 0.24)',
  },
  smallActionButtonText: {
    ...Typography.bodySmall,
    color: colors.text,
    fontWeight: '800',
  },
  smallActionButtonTextActive: {
    color: colors.onPrimary,
  },
  smallActionButtonTextDanger: {
    color: '#F87171',
  },
  previewShell: {
    marginBottom: Spacing.lg,
  },
  previewContainer: {
    width: '100%',
    height: 460,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#0F141B',
    overflow: 'hidden',
    position: 'relative',
    ...Shadows.sm,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewHitArea: {
    ...StyleSheet.absoluteFillObject,
  },
  snapGuideVertical: {
    position: 'absolute',
    width: 1,
    backgroundColor: 'rgba(53, 199, 111, 0.75)',
  },
  snapGuideHorizontal: {
    position: 'absolute',
    height: 1,
    backgroundColor: 'rgba(53, 199, 111, 0.75)',
  },
  overlayContentBox: {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: 'rgba(255,255,255,0.01)',
  },
  overlayContentBoxSelected: {
    borderWidth: 2,
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.24,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  overlayImage: {
    width: '100%',
    height: '100%',
  },
  overlaySelectionBadge: {
    position: 'absolute',
    left: 6,
    top: 6,
    right: 6,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: 'rgba(11, 15, 20, 0.72)',
  },
  overlaySelectionBadgeText: {
    color: '#E5EEF7',
    fontSize: 11,
    fontWeight: '700',
  },
  overlayCenterDot: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    marginLeft: -4,
    marginTop: -4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: colors.background,
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
    gap: 8,
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
  snapHintPill: {
    alignSelf: 'center',
    backgroundColor: 'rgba(53, 199, 111, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(53, 199, 111, 0.32)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  snapHintPillText: {
    color: '#CFF7DE',
    fontSize: 12,
    fontWeight: '700',
  },
  busyOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(11, 15, 20, 0.18)',
  },
  contextCard: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: Spacing.md,
    gap: 4,
    marginBottom: Spacing.lg,
    ...Shadows.sm,
  },
  contextLabel: {
    ...Typography.caption,
    color: colors.primary,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  contextValue: {
    ...Typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  viewActionCard: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: Spacing.lg,
    gap: Spacing.md,
    ...Shadows.sm,
  },
  viewActionTitle: {
    ...Typography.titleSmall,
    color: colors.text,
  },
  viewActionText: {
    ...Typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  overlayCard: {
    backgroundColor: colors.card,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginTop: Spacing.lg,
    ...Shadows.sm,
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
  overlayRowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  overlayRowText: {
    color: colors.text,
    fontWeight: '700',
  },
  overlayRowHint: {
    color: colors.muted,
    fontSize: 12,
  },
  actionDisabled: {
    opacity: 0.56,
  },
  pressed: {
    opacity: 0.92,
  },
});
