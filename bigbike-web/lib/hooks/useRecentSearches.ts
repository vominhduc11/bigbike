"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "bb_recent_searches";
const MAX_ITEMS = 8;

function loadFromStorage(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((s): s is string => typeof s === "string")
      : [];
  } catch {
    return [];
  }
}

function saveToStorage(searches: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(searches));
  } catch {
    // localStorage unavailable (private mode, quota exceeded)
  }
}

export function useRecentSearches() {
  const [searches, setSearches] = useState<string[]>([]);

  useEffect(() => {
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
