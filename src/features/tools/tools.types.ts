import type { ScanEntryLaunchMode } from '../../navigation/types';

export type ToolSectionKey =
  | 'scan'
  | 'import'
  | 'convert'
  | 'edit'
  | 'utilities';

export type ToolAvailability = 'ready' | 'shell' | 'planned';

export type ToolActionRouteTarget =
  | 'ScanEntry'
  | 'StampManager'
  | 'Documents'
  | 'ToolsTab'
  | 'DocumentsTab';

export type ToolDefinition = {
  key: string;
  section: ToolSectionKey;
  title: string;
  shortDescription: string;
  longDescription: string;
  availability: ToolAvailability;
  badges: string[];
  primaryActionLabel: string;
  secondaryActionLabel?: string;
  routeTarget?: ToolActionRouteTarget;
  scanEntryMode?: ScanEntryLaunchMode;
  homeVisible?: boolean;
  scanLauncherVisible?: boolean;
};

export type ToolSectionDefinition = {
  key: ToolSectionKey;
  title: string;
  description: string;
  items: ToolDefinition[];
};