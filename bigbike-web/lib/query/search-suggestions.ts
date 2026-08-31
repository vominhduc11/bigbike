import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { ArticleSuggestion, SearchSuggestion } from "@/components/layout/search/types";
import { queryKeys } from "./keys";

export type SearchSuggestionResult = { products: SearchSuggestion[]; articles: ArticleSuggestion[] };

export class SearchSuggestionsError extends Error {
  constructor(
    public readonly status: number,
    public readonly code?: string,
  ) {
    super("Search suggestions unavailable");
    this.name = "SearchSuggestionsError";
  }
}

export async function fetchSearchSuggestions(
  query: string,
  locale: "vi" | "en",
  signal?: AbortSignal,
): Promise<SearchSuggestionResult> {
  const params = new URLSearchParams({ q: query, lang: locale });
  const response = await fetch(`/api/search-suggest?${params.toString()}`, { signal });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as {
      error?: { code?: string };
    } | null;
    throw new SearchSuggestionsError(response.status, payload?.error?.code);
  }
  const value = await response.json() as Partial<SearchSuggestionResult>;
  return { products: value.products ?? [], articles: value.articles ?? [] };
}

export function useSearchSuggestions(locale: "vi" | "en", query: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.searchSuggestions(locale, query),
    queryFn: ({ signal }) => fetchSearchSuggestions(query, locale, signal),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}
