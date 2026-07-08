"use client";

import { useCallback, useEffect, useState } from "react";
import { safeStorage } from "@/lib/utils/storage";

const STORAGE_KEY = "bb_recent_searches";
const MAX_ITEMS = 8;

function loadFromStorage(): string[] {
  const parsed = safeStorage.get<unknown>(STORAGE_KEY, []);
  return Array.isArray(parsed)
    ? parsed.filter((s): s is string => typeof s === "string")
    : [];
}

function saveToStorage(searches: string[]): void {
  safeStorage.set(STORAGE_KEY, searches);
}

export function useRecentSearches() {
  const [searches, setSearches] = useState<string[]>([]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load searches from localStorage after mount to prevent hydration mismatch
    setSearches(loadFromStorage());
  }, []);

  const addSearch = useCallback((q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setSearches((prev) => {
      const deduped = prev.filter(
        (s) => s.toLowerCase() !== trimmed.toLowerCase(),
      );
      const next = [trimmed, ...deduped].slice(0, MAX_ITEMS);
      saveToStorage(next);
      return next;
    });
  }, []);

  const removeSearch = useCallback((q: string) => {
    setSearches((prev) => {
      const next = prev.filter((s) => s !== q);
      saveToStorage(next);
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    saveToStorage([]);
    setSearches([]);
  }, []);

  return { searches, addSearch, removeSearch, clearAll };
}
