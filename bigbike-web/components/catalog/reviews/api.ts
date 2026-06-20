import type { ReviewsData, SortKey } from "./types";

export const PAGE_SIZE = 10;

function getErrorMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object" && "error" in payload) {
    const error = (payload as { error?: unknown }).error;
    if (typeof error === "string" && error.trim()) {
      return error;
    }
  }
  return fallback;
}

export async function fetchReviewsPage(
  productId: string,
  page: number,
  rating: number | null,
  sort: SortKey,
  errorFallback: string,
) {
  const params = new URLSearchParams({
    page: String(page),
    size: String(PAGE_SIZE),
    sort,
  });
  if (rating) params.set("rating", String(rating));
  const res = await fetch(`/api/products/${productId}/reviews/?${params.toString()}`);
  const payload = (await res.json().catch(() => null)) as ReviewsData | { error?: string } | null;

  if (!res.ok) {
    throw new Error(getErrorMessage(payload, errorFallback));
  }

  return payload as ReviewsData;
}
