import React, { useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type { AppTabScreenProps } from '../../navigation/types';
import {
  Layout,
  Radius,
  Shadows,
  Spacing,
  Typography,
  colors,
} from '../../theme';
import { ToolDetailSheet } from './components/ToolDetailSheet';
import { ToolSectionCard } from './components/ToolSectionCard';
import { executeToolPrimaryAction } from './tools.actions';
import { toolSections } from './tools.registry';
import type { ToolDefinition } from './tools.types';

type Props = AppTabScreenProps<'ToolsTab'>;

export function ToolsScreen({ navigation }: Props) {
  const [selectedTool, setSelectedTool] = useState<ToolDefinition | null>(null);

  const summary = useMemo(() => {
    const allTools = toolSections.flatMap((section) => section.items);

    const readyCount = allTools.filter((item) => item.availability === 'ready').length;
    const shellCount = allTools.filter((item) => item.availability === 'shell').length;
    const plannedCount = allTools.filter((item) => item.availability === 'planned').length;

    return {
      total: allTools.length,
      readyCount,
      shellCount,
      plannedCount,
    };
  }, []);

  const handleOpenTool = (tool: ToolDefinition) => {
    setSelectedTool(tool);
  };

  const handleCloseTool = () => {
    setSelectedTool(null);
  };

  const handlePrimaryAction = async (tool: ToolDefinition) => {
    await executeToolPrimaryAction(tool, navigation);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerCard}>
          <Text style={styles.eyebrow}>ARAÇLAR</Text>
          <Text style={styles.title}>PDF araç merkezi</Text>
          <Text style={styles.subtitle}>
            Liste başlıkları artık sadece görüntü değil; durum bilgisi, içerik sayfası
            ve aksiyon davranışı olan tool registry üzerinden yönetiliyor.
          </Text>

          <View style={styles.metricsRow}>
            <View style={styles.metricPill}>
              <Text style={styles.metricValue}>{summary.total}</Text>
              <Text style={styles.metricLabel}>Toplam</Text>
            </View>

            <View style={styles.metricPill}>
              <Text style={styles.metricValue}>{summary.readyCount}</Text>
              <Text style={styles.metricLabel}>Hazır</Text>
            </View>

            <View style={styles.metricPill}>
              <Text style={styles.metricValue}>{summary.shellCount}</Text>
              <Text style={styles.metricLabel}>Shell</Text>
            </View>

            <View style={styles.metricPill}>
              <Text style={styles.metricValue}>{summary.plannedCount}</Text>
              <Text style={styles.metricLabel}>Plan</Text>
            </View>
          </View>
        </View>

        {toolSections.map((section) => (
          <ToolSectionCard
            key={section.key}
            section={section}
            onPressTool={handleOpenTool}
          />
        ))}
      </ScrollView>

      <ToolDetailSheet
        visible={Boolean(selectedTool)}
        tool={selectedTool}
        onClose={handleCloseTool}
        onPrimaryAction={handlePrimaryAction}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: Layout.screenHorizontalPadding,
    paddingTop: Layout.screenVerticalPadding,
    paddingBottom: 120,
    gap: Spacing.xl,
  },
  headerCard: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: Spacing.xl,
    gap: Spacing.sm,
    ...Shadows.sm,
  },
  eyebrow: {
    ...Typography.caption,
    color: colors.primary,
    letterSpacing: 1.1,
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
  metricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  metricPill: {
    minWidth: 76,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    gap: 2,
  },
  metricValue: {
    ...Typography.title,
    color: colors.text,
  },
  metricLabel: {
    ...Typography.caption,
    color: colors.textSecondary,
  },
});