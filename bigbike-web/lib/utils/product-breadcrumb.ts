import type { Category, CategorySummary } from "@/lib/contracts/public";

function isUsableCategory(category: CategorySummary | null | undefined): category is CategorySummary {
  return Boolean(
    category?.name &&
    category.slug &&
    category.slug !== "chua-phan-loai" &&
    category.slug !== "uncategorized" &&
    category.visible !== false &&
    category.deleted !== true,
  );
}

/** Build the public category chain without changing the category API shape. */
export function buildCategoryBreadcrumbCategories(
  primary: CategorySummary | null | undefined,
  categories: Category[],
): CategorySummary[] {
  if (!isUsableCategory(primary)) return [];

  const byId = new Map(categories.map((category) => [category.id, category]));
  const current = byId.get(primary.id);
  if (!current) return [primary];

  const chain: Category[] = [];
  const seen = new Set<string>();
  let cursor: Category | undefined = current;
  while (cursor && !seen.has(cursor.id)) {
    seen.add(cursor.id);
    chain.unshift(cursor);
    cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
  }

  return chain
    .map((category) => ({
      id: category.id,
      slug: category.slug,
      slugEn: category.slugEn,
      name: category.name,
      visible: category.isVisible,
      deleted: false,
    }))
    .filter(isUsableCategory);
}

