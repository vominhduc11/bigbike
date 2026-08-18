import type { Category } from "@/lib/contracts/public";
import type { Locale } from "@/i18n/locale";
import { listProducts } from "@/lib/api/public-api";
import {
  selectDiscontinuedSuggestions,
  type DiscontinuedSuggestionSource,
} from "@/lib/utils/discontinued-suggestions";

const SUGGESTION_FETCH_SIZE = 100;
const MIN_SUGGESTIONS = 4;
const MAX_SUGGESTIONS = 8;
const POPULARITY_SORT = "popularity";
const AVAILABLE_FALLBACK_SORT = "createdAt:desc";

function withoutIds(products: Awaited<ReturnType<typeof listProducts>>["data"], ids: Set<string>) {
  return (products ?? []).filter((product) => !ids.has(product.id));
}

async function listSuggestionCandidates(query: Parameters<typeof listProducts>[0]) {
  const popularResult = await listProducts({ ...query, sort: POPULARITY_SORT });
  if (!popularResult.error) return popularResult;

  // Older local API containers accept only field:direction sorts. Keep the
  // recommendation rail populated there while newer API versions use popularity.
  return listProducts({ ...query, sort: AVAILABLE_FALLBACK_SORT });
}

/**
 * Load active candidates without changing the public API. The public product list already
 * excludes discontinued rows; this helper only ranks and fills the visual recommendation rail.
 */
export async function getDiscontinuedSuggestions({
  categorySlug,
  categories,
  source,
  locale,
}: {
  categorySlug?: string;
  categories: Category[];
  source: DiscontinuedSuggestionSource;
  locale: Locale;
}) {
  const selected: Awaited<ReturnType<typeof listProducts>>["data"] = [];
  const selectedIds = new Set<string>();

  if (categorySlug) {
    const categoryResult = await listSuggestionCandidates({
      page: 1,
      size: SUGGESTION_FETCH_SIZE,
      category: categorySlug,
      lang: locale,
    });
    const categorySuggestions = selectDiscontinuedSuggestions(categoryResult.data ?? [], source, MAX_SUGGESTIONS);
    selected.push(...categorySuggestions);
    categorySuggestions.forEach((product) => selectedIds.add(product.id));
  }

  if (selected.length < MIN_SUGGESTIONS && categorySlug) {
    const categoryById = new Map(categories.map((category) => [category.id, category]));
    const currentCategory = categories.find((category) => category.slug === categorySlug);
    const parent = currentCategory?.parentId ? categoryById.get(currentCategory.parentId) : undefined;
    if (parent?.slug && parent.slug !== categorySlug) {
      const parentResult = await listSuggestionCandidates({
        page: 1,
        size: SUGGESTION_FETCH_SIZE,
        category: parent.slug,
        lang: locale,
      });
      const parentSuggestions = selectDiscontinuedSuggestions(
        withoutIds(parentResult.data, selectedIds),
        source,
        MAX_SUGGESTIONS - selected.length,
      );
      selected.push(...parentSuggestions);
      parentSuggestions.forEach((product) => selectedIds.add(product.id));
    }
  }

  if (selected.length < MIN_SUGGESTIONS) {
    const popularResult = await listSuggestionCandidates({
      page: 1,
      size: SUGGESTION_FETCH_SIZE,
      lang: locale,
    });
    selected.push(
      ...selectDiscontinuedSuggestions(
        withoutIds(popularResult.data, selectedIds),
        source,
        MAX_SUGGESTIONS - selected.length,
      ),
    );
  }

  return selected.slice(0, MAX_SUGGESTIONS);
}
