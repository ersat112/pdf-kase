// src/screens/documents/DocumentsScreen.tsx
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Screen } from '../../components/common/Screen';
import {
  getRecentDocuments,
  type DocumentSummary,
} from '../../modules/documents/document.service';
import {
  Radius,
  Shadows,
  Spacing,
  Typography,
  colors,
} from '../../theme';

function getStatusLabel(status: string) {
  switch (status) {
    case 'draft':
      return 'Taslak';
    case 'ready':
      return 'Hazır';
    case 'exported':
      return 'PDF oluşturuldu';
    default:
      return status;
  }
}

function formatDate(value: string) {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return 'Tarih yok';
  }

  return parsed.toLocaleString('tr-TR');
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <View style={styles.emptyCard}>
      <Text style={styles.emptyTitle}>Henüz belge yok</Text>
      <Text style={styles.emptyText}>
        Belge Tara ekranından galeriden görsel seçebilir veya kamerayla çoklu
        sayfa tarayıp yeni bir taslak oluşturabilirsin.
      </Text>

      <Pressable
        onPress={onCreate}
        style={({ pressed }) => [
          styles.primaryButton,
          pressed && styles.pressed,
        ]}
      >
        <Text style={styles.primaryButtonText}>Yeni belge oluştur</Text>
      </Pressable>
    </View>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function DocumentCard({
  item,
  onPress,
}: {
  item: DocumentSummary;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.thumbnailFrame}>
        {item.thumbnail_path ? (
          <Image source={{ uri: item.thumbnail_path }} style={styles.thumbnail} />
        ) : (
          <View style={styles.thumbnailPlaceholder}>
            <Text style={styles.thumbnailPlaceholderText}>Önizleme yok</Text>
          </View>
        )}
      </View>

      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <Text numberOfLines={2} style={styles.cardTitle}>
            {item.title}
          </Text>

          <View style={styles.statusBadge}>
            <Text style={styles.statusBadgeText}>{getStatusLabel(item.status)}</Text>
          </View>
        </View>

        <Text style={styles.cardMeta}>Sayfa: {item.page_count}</Text>
        <Text style={styles.cardMeta}>Güncelleme: {formatDate(item.updated_at)}</Text>
      </View>
    </Pressable>
  );
}

export function DocumentsScreen() {
  const navigation = useNavigation<any>();

  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  const loadDocuments = useCallback(async () => {
    try {
      setLoading(true);
      const rows = await getRecentDocuments();
      setDocuments(rows);
    } catch (error) {
      console.warn('[Documents] Load failed:', error);
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadDocuments();
    }, [loadDocuments]),
  );

  const filteredDocuments = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('tr-TR');

    if (!normalizedQuery) {
      return documents;
    }

    return documents.filter((item) => {
      const haystack = [
        item.title,
        item.status,
        getStatusLabel(item.status),
      ]
        .join(' ')
        .toLocaleLowerCase('tr-TR');

      return haystack.includes(normalizedQuery);
    });
  }, [documents, query]);

  const totalPages = useMemo(() => {
    return documents.reduce((sum, item) => sum + item.page_count, 0);
  }, [documents]);

  const readyCount = useMemo(() => {
    return documents.filter((item) => item.status === 'ready').length;
  }, [documents]);

  return (
    <Screen
      title="Dosyalar"
      subtitle="Belge detayına gir, sayfaları kontrol et, kaşe ekle, PDF üret ve paylaş."
    >
      <View style={styles.heroCard}>
        <View style={styles.heroTop}>
          <View style={styles.heroTextBlock}>
            <Text style={styles.heroTitle}>Belge merkezi</Text>
            <Text style={styles.heroText}>
              Son güncellenen dosyalar, taslaklar ve hazır PDF belgeleri tek akışta.
            </Text>
          </View>

          <Pressable
            onPress={() => navigation.navigate('ScanEntry')}
            style={({ pressed }) => [
              styles.heroActionButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.heroActionButtonText}>Yeni belge</Text>
          </Pressable>
        </View>

        <View style={styles.searchWrap}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Dosyalarda ara"
            placeholderTextColor={colors.textTertiary}
            style={styles.searchInput}
          />
        </View>
      </View>

      <View style={styles.statsRow}>
        <StatCard label="Toplam belge" value={documents.length} />
        <StatCard label="Toplam sayfa" value={totalPages} />
        <StatCard label="Hazır belge" value={readyCount} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Belgeler yükleniyor...</Text>
        </View>
      ) : filteredDocuments.length === 0 ? (
        <EmptyState onCreate={() => navigation.navigate('ScanEntry')} />
      ) : (
        <View style={styles.list}>
          {filteredDocuments.map((item) => (
            <DocumentCard
              key={item.id}
              item={item}
              onPress={() =>
                navigation.navigate('DocumentDetail', {
                  documentId: item.id,
                })
              }
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    gap: Spacing.md,
    ...Shadows.sm,
  },
  heroTop: {
    gap: Spacing.md,
  },
  heroTextBlock: {
    gap: Spacing.xs,
  },
  heroTitle: {
    ...Typography.titleLarge,
    color: colors.text,
  },
  heroText: {
    ...Typography.body,
    color: colors.textSecondary,
  },
  heroActionButton: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  heroActionButtonText: {
    color: colors.primaryForeground,
    fontWeight: '800',
    fontSize: 14,
  },
  searchWrap: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
  },
  searchInput: {
    minHeight: 48,
    color: colors.text,
    ...Typography.body,
  },
  statsRow: {
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  statCard: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  statLabel: {
    ...Typography.caption,
    color: colors.textTertiary,
    marginBottom: 4,
  },
  statValue: {
    ...Typography.titleLarge,
    color: colors.text,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 10,
  },
  loadingText: {
    color: colors.textSecondary,
  },
  emptyCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    gap: Spacing.sm,
    ...Shadows.sm,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  emptyText: {
    color: colors.textSecondary,
    lineHeight: 20,
  },
  primaryButton: {
    marginTop: 6,
    backgroundColor: colors.primary,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  primaryButtonText: {
    color: colors.primaryForeground,
    textAlign: 'center',
    fontWeight: '800',
    fontSize: 15,
  },
  list: {
    gap: Spacing.md,
  },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: Radius.xl,
    padding: Spacing.md,
    flexDirection: 'row',
    gap: Spacing.md,
    ...Shadows.sm,
  },
  thumbnailFrame: {
    width: 76,
    height: 100,
    borderRadius: Radius.md,
    overflow: 'hidden',
    backgroundColor: '#0F141B',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  thumbnailPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  thumbnailPlaceholderText: {
    color: colors.textTertiary,
    fontSize: 11,
    textAlign: 'center',
    fontWeight: '600',
  },
  cardContent: {
    flex: 1,
    justifyContent: 'center',
    gap: 4,
  },
  cardHeader: {
    gap: Spacing.xs,
    marginBottom: 4,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  statusBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
  },
  statusBadgeText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  cardMeta: {
    color: colors.textSecondary,
  },
  pressed: {
    opacity: 0.92,
  },
});