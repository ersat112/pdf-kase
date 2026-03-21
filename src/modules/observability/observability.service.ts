import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  appRuntime,
  getAnalyticsRuntimeDisplayLabel,
  getCrashRuntimeDisplayLabel,
} from '../../config/runtime';

const OBSERVABILITY_EVENTS_KEY = 'pdf-kase.observability.events.v1';
const MAX_OBSERVABILITY_EVENTS = 80;

export type ObservabilityEventLevel = 'info' | 'warning' | 'error';

export type ObservabilityEventKind = 'event' | 'error';

export type ObservabilityEvent = {
  id: string;
  timestamp: string;
  kind: ObservabilityEventKind;
  level: ObservabilityEventLevel;
  feature: string;
  name: string;
  source: string;
  message: string | null;
  metadata: Record<string, unknown> | null;
};

export type ObservabilitySnapshot = {
  enabled: boolean;
  analyticsRuntimeLabel: string;
  crashRuntimeLabel: string;
  totalCount: number;
  infoCount: number;
  warningCount: number;
  errorCount: number;
  lastEventAt: string | null;
  lastErrorAt: string | null;
  recentEvents: ObservabilityEvent[];
};

type TrackObservabilityEventInput = {
  feature: string;
  name: string;
  source: string;
  level?: Exclude<ObservabilityEventLevel, 'error'>;
  message?: string | null;
  metadata?: Record<string, unknown> | null;
};

type CaptureObservabilityErrorInput = {
  feature: string;
  name: string;
  source: string;
  error: unknown;
  level?: Extract<ObservabilityEventLevel, 'warning' | 'error'>;
  metadata?: Record<string, unknown> | null;
};

let writeQueue: Promise<void> = Promise.resolve();

function createEventId() {
  return `obs_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function trimString(value: string, maxLength = 240) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}

function normalizeMetadataValue(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) {
    return null;
  }

  if (depth >= 3) {
    return '[truncated]';
  }

  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return typeof value === 'string' ? trimString(value, 180) : value;
  }

  if (Array.isArray(value)) {
    return value.slice(0, 8).map((item) => normalizeMetadataValue(item, depth + 1));
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).slice(0, 16);
    return Object.fromEntries(
      entries.map(([key, item]) => [key, normalizeMetadataValue(item, depth + 1)]),
    );
  }

  return String(value);
}

function normalizeMetadata(
  metadata: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!metadata) {
    return null;
  }

  const normalized = normalizeMetadataValue(metadata);
  return normalized && typeof normalized === 'object' && !Array.isArray(normalized)
    ? (normalized as Record<string, unknown>)
    : null;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim().length > 0) {
    return trimString(error.message);
  }

  if (typeof error === 'string' && error.trim().length > 0) {
    return trimString(error.trim());
  }

  return 'Beklenmeyen hata';
}

async function readEvents() {
  try {
    const raw = await AsyncStorage.getItem(OBSERVABILITY_EVENTS_KEY);

    if (!raw) {
      return [] as ObservabilityEvent[];
    }

    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) {
      return [] as ObservabilityEvent[];
    }

    return parsed.filter((item): item is ObservabilityEvent => {
      if (!item || typeof item !== 'object') {
        return false;
      }

      const candidate = item as Partial<ObservabilityEvent>;
      return Boolean(
        typeof candidate.id === 'string' &&
          typeof candidate.timestamp === 'string' &&
          (candidate.kind === 'event' || candidate.kind === 'error') &&
          (candidate.level === 'info' ||
            candidate.level === 'warning' ||
            candidate.level === 'error') &&
          typeof candidate.feature === 'string' &&
          typeof candidate.name === 'string' &&
          typeof candidate.source === 'string',
      );
    });
  } catch (error) {
    console.warn('[Observability] Failed to read events:', error);
    return [] as ObservabilityEvent[];
  }
}

async function writeEvents(events: ObservabilityEvent[]) {
  try {
    await AsyncStorage.setItem(
      OBSERVABILITY_EVENTS_KEY,
      JSON.stringify(events.slice(0, MAX_OBSERVABILITY_EVENTS)),
    );
  } catch (error) {
    console.warn('[Observability] Failed to write events:', error);
  }
}

async function flushWriteQueue() {
  try {
    await writeQueue;
  } catch {
    return;
  }
}

async function appendEvent(event: ObservabilityEvent) {
  writeQueue = writeQueue
    .catch(() => undefined)
    .then(async () => {
      const events = await readEvents();
      await writeEvents([event, ...events]);
    });

  await writeQueue;
}

function logToConsole(event: ObservabilityEvent) {
  const prefix = `[Observability][${event.feature}] ${event.name}`;

  if (event.level === 'error') {
    console.error(prefix, event.message ?? event.metadata ?? null);
    return;
  }

  if (event.level === 'warning') {
    console.warn(prefix, event.message ?? event.metadata ?? null);
    return;
  }

  console.info(prefix, event.metadata ?? null);
}

export async function trackObservabilityEvent(
  input: TrackObservabilityEventInput,
): Promise<void> {
  if (!appRuntime.observabilityEnabled || appRuntime.analyticsProvider === 'none') {
    return;
  }

  const event: ObservabilityEvent = {
    id: createEventId(),
    timestamp: new Date().toISOString(),
    kind: 'event',
    level: input.level ?? 'info',
    feature: trimString(input.feature, 48),
    name: trimString(input.name, 80),
    source: trimString(input.source, 64),
    message:
      typeof input.message === 'string' && input.message.trim().length > 0
        ? trimString(input.message.trim())
        : null,
    metadata: normalizeMetadata(input.metadata),
  };

  logToConsole(event);
  await appendEvent(event);
}

export async function captureObservabilityError(
  input: CaptureObservabilityErrorInput,
): Promise<void> {
  if (!appRuntime.observabilityEnabled || appRuntime.crashProvider === 'none') {
    return;
  }

  const event: ObservabilityEvent = {
    id: createEventId(),
    timestamp: new Date().toISOString(),
    kind: 'error',
    level: input.level ?? 'error',
    feature: trimString(input.feature, 48),
    name: trimString(input.name, 80),
    source: trimString(input.source, 64),
    message: getErrorMessage(input.error),
    metadata: normalizeMetadata(input.metadata),
  };

  logToConsole(event);
  await appendEvent(event);
}

export async function getObservabilitySnapshot(): Promise<ObservabilitySnapshot> {
  await flushWriteQueue();
  const recentEvents = await readEvents();
  const latestError = recentEvents.find((event) => event.level === 'error');

  return {
    enabled: appRuntime.observabilityEnabled,
    analyticsRuntimeLabel: getAnalyticsRuntimeDisplayLabel(),
    crashRuntimeLabel: getCrashRuntimeDisplayLabel(),
    totalCount: recentEvents.length,
    infoCount: recentEvents.filter((event) => event.level === 'info').length,
    warningCount: recentEvents.filter((event) => event.level === 'warning').length,
    errorCount: recentEvents.filter((event) => event.level === 'error').length,
    lastEventAt: recentEvents[0]?.timestamp ?? null,
    lastErrorAt: latestError?.timestamp ?? null,
    recentEvents: recentEvents.slice(0, 8),
  };
}

export async function clearObservabilityEvents(): Promise<void> {
  writeQueue = writeQueue
    .catch(() => undefined)
    .then(async () => {
      try {
        await AsyncStorage.removeItem(OBSERVABILITY_EVENTS_KEY);
      } catch (error) {
        console.warn('[Observability] Failed to clear events:', error);
      }
    });

  await writeQueue;
}

export const observabilityService = {
  trackObservabilityEvent,
  captureObservabilityError,
  getObservabilitySnapshot,
  clearObservabilityEvents,
};
