import type { ReviewsData, SortKey } from "./types";
import { env } from "@/env";

export const PAGE_SIZE = 10;
const API_BASE_URL = (env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080").replace(/\/+$/, "");

function getErrorMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object" && "error" in payload) {
    const error = (payload as { error?: unknown }).error;
    if (typeof error === "string" && error.trim()) {
      return error;
    }
    if (error && typeof error === "object" && "message" in error) {
      const message = (error as { message?: unknown }).message;
      if (typeof message === "string" && message.trim()) {
        return message;
      }
    }
  }
  return fallback;
}

export class ReviewRequestError extends Error {
  readonly status: number;

  constructor(status: number, message = "") {
    super(message);
    this.name = "ReviewRequestError";
    this.status = status;
  }
}

export async function fetchReviewsPage(
  productId: string,
  page: number,
  rating: number | null,
  sort: SortKey,
  errorFallback: string,
  lang?: string,
) {
  const params = new URLSearchParams({
    page: String(page),
    size: String(PAGE_SIZE),
    sort,
  });
  if (rating) params.set("rating", String(rating));
  if (lang) params.set("lang", lang);
  const res = await fetch(`/api/products/${productId}/reviews/?${params.toString()}`);
  const payload = (await res.json().catch(() => null)) as ReviewsData | { error?: string } | null;

  if (!res.ok) {
    throw new Error(getErrorMessage(payload, errorFallback));
  }

  return payload as ReviewsData;
}

export async function uploadReviewPhoto(
  productId: string,
  file: File,
): Promise<string> {
  const form = new FormData();
  form.set("file", file);
  const res = await fetch(
    `${API_BASE_URL}/api/v1/products/${encodeURIComponent(productId)}/reviews/photos`,
    {
      method: "POST",
      credentials: "include",
      headers: { Accept: "application/json" },
      body: form,
    },
  );
  const payload = (await res.json().catch(() => null)) as
    | { data?: { url?: string }; error?: string | { message?: string } }
    | null;
  if (!res.ok) {
    throw new ReviewRequestError(res.status, getErrorMessage(payload, ""));
  }
  const url = payload?.data?.url;
  if (!url) {
    throw new ReviewRequestError(502);
  }
  return url;
}

export type SubmitReviewPayload = {
  authorName: string;
  authorEmail?: string;
  rating: number;
  comment: string;
  photos: string[];
  website: string;
};

export async function submitProductReview(
  productId: string,
  body: SubmitReviewPayload,
): Promise<void> {
  const res = await fetch(
    `${API_BASE_URL}/api/v1/products/${encodeURIComponent(productId)}/reviews`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    const payload = (await res.json().catch(() => null)) as
      | { error?: string | { message?: string } }
      | null;
    throw new ReviewRequestError(res.status, getErrorMessage(payload, ""));
  }
}
