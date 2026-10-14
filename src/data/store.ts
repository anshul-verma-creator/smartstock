import { useMemo, useSyncExternalStore } from 'react';
import { todayLocal } from '@/lib/dates';
import { DATA_VERSION, generateDemo } from './generate';
import type { AppData } from './types';

const KEY = 'smartstock-demo';
let state: AppData = load();
const listeners = new Set<() => void>();

function load(): AppData {
  const today = todayLocal();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppData;
      if (parsed.version === DATA_VERSION && parsed.anchor === today) return parsed;
    }
  } catch {
    /* storage unavailable or corrupt — fall back to a fresh demo */
  }
  return generateDemo(today);
}

let saveTimer: number | undefined;
function save() {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* quota exceeded or private mode: the demo still works for this session */
    }
  }, 400);
}

const emit = () => listeners.forEach((l) => l());

export function getState() {
  return state;
}

/** Applies a change atomically: the draft is discarded if the function throws (nothing half-posted). */
export function dispatch<T>(fn: (draft: AppData) => T): T {
  const draft = structuredClone(state);
  const result = fn(draft);
  state = draft;
  save();
  emit();
  return result;
}

export function resetDemo() {
  state = generateDemo(todayLocal());
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  emit();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useAppData(): AppData {
  return useSyncExternalStore(subscribe, getState);
}

export function useSelect<T>(selector: (s: AppData) => T): T {
  const s = useAppData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => selector(s), [s]);
}

/** Memoise an expensive derivation per immutable state snapshot. */
export function memo<A extends unknown[], R>(fn: (s: AppData, ...args: A) => R) {
  const cache = new WeakMap<AppData, Map<string, R>>();
  return (s: AppData, ...args: A): R => {
    let m = cache.get(s);
    if (!m) {
      m = new Map();
      cache.set(s, m);
    }
    const k = JSON.stringify(args);
    if (!m.has(k)) m.set(k, fn(s, ...args));
    return m.get(k)!;
  };
}
