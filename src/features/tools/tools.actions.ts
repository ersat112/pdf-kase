import { Alert } from 'react-native';

import type { ToolDefinition } from './tools.types';

type ToolsNavigation = {
  navigate: (...args: [string] | [string, Record<string, unknown> | undefined]) => void;
};

function getToolAlertTitle(tool: ToolDefinition) {
  switch (tool.availability) {
    case 'ready':
      return 'Araç';
    case 'shell':
      return 'Araç kabuğu hazır';
    case 'planned':
    default:
      return 'Planlanan modül';
  }
}

function getToolAlertMessage(tool: ToolDefinition) {
  switch (tool.availability) {
    case 'ready':
      return `${tool.title} akışı hazır ancak eksik route veya executor tanımı var.`;
    case 'shell':
      return `${tool.title} için ürün kabuğu ve içerik yapısı hazır. Servis entegrasyonu sonraki sprintte bağlanacak.`;
    case 'planned':
    default:
      return `${tool.title} modülü ürün planında yerini aldı. Gerçek servis ve çıktı akışı sonraki sprintte tamamlanacak.`;
  }
}

export async function executeToolPrimaryAction(
  tool: ToolDefinition,
  navigation: ToolsNavigation,
) {
  if (tool.routeTarget === 'ScanEntry') {
    navigation.navigate('ScanEntry', {
      initialMode: tool.scanEntryMode,
    });
    return;
  }

  if (tool.routeTarget === 'StampManager') {
    navigation.navigate('StampManager');
    return;
  }

  if (tool.routeTarget === 'Documents') {
    navigation.navigate('Documents');
    return;
  }

  if (tool.routeTarget === 'ToolsTab') {
    navigation.navigate('ToolsTab');
    return;
  }

  if (tool.routeTarget === 'DocumentsTab') {
    navigation.navigate('DocumentsTab');
    return;
  }

  Alert.alert(getToolAlertTitle(tool), getToolAlertMessage(tool));
}