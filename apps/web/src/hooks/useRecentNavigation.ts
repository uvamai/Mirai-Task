import { useCallback, useEffect, useState } from 'react';

/**
 * M7 — Recent visits for the command palette. Persists the last N projects/boards
 * the user jumped to so the palette can offer one-keystroke "back to where I was"
 * navigation when the search field is empty.
 *
 * Storage is per-browser (localStorage); no server roundtrip.
 */
export type RecentItem = {
  /** Stable id; project or board UUID. */
  key: string;
  /** Display label shown in the palette. */
  label: string;
  /** Route path. */
  to: string;
  /** Visit timestamp (ms). */
  at: number;
  /** Optional sub-label ("Board" / "Project"). */
  hint?: string;
};

const STORAGE_KEY = 'mirai_recent_nav_v1';
const MAX_ENTRIES = 8;

function read(): RecentItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (x): x is RecentItem =>
        Boolean(x) &&
        typeof x === 'object' &&
        typeof (x as RecentItem).key === 'string' &&
        typeof (x as RecentItem).label === 'string' &&
        typeof (x as RecentItem).to === 'string' &&
        typeof (x as RecentItem).at === 'number'
    );
  } catch {
    return [];
  }
}

function write(items: RecentItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ENTRIES)));
  } catch {
    /** quota exceeded / private mode — fail closed. */
  }
}

export function useRecentNavigation() {
  const [items, setItems] = useState<RecentItem[]>(() => read());

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY) setItems(read());
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const push = useCallback((entry: Omit<RecentItem, 'at'>) => {
    setItems((prev) => {
      const next = [
        { ...entry, at: Date.now() },
        ...prev.filter((p) => p.key !== entry.key),
      ].slice(0, MAX_ENTRIES);
      write(next);
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    write([]);
    setItems([]);
  }, []);

  return { items, push, clear };
}
