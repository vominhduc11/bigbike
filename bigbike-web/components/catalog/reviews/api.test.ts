import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ReviewRequestError,
  submitProductReview,
  uploadReviewPhoto,
} from "./api";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("review public mutations", () => {
  it("uploads directly to the public API with credentials and unwraps the URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { url: "/media/reviews/a/review.webp" } }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const file = new File(["image"], "review.webp", { type: "image/webp" });

    await expect(uploadReviewPhoto("prod/1", file)).resolves.toBe(
      "/media/reviews/a/review.webp",
    );

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/api\/v1\/products\/prod%2F1\/reviews\/photos$/);
    expect(init).toMatchObject({ method: "POST", credentials: "include" });
    expect(init.body).toBeInstanceOf(FormData);
  });

  it("submits guest identity and review data directly with credentials", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { success: true } }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await submitProductReview("prod-1", {
      authorName: "Khách thử nghiệm",
      authorEmail: "guest@example.invalid",
      rating: 4.5,
      comment: "Phản hồi thử nghiệm",
      photos: ["/media/reviews/a/review.webp"],
      website: "",
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/api\/v1\/products\/prod-1\/reviews$/);
    expect(init).toMatchObject({ method: "POST", credentials: "include" });
    expect(JSON.parse(String(init.body))).toEqual({
      authorName: "Khách thử nghiệm",
      authorEmail: "guest@example.invalid",
      rating: 4.5,
      comment: "Phản hồi thử nghiệm",
      photos: ["/media/reviews/a/review.webp"],
      website: "",
    });
  });

  it.each([
    [400, "Dữ liệu đánh giá không hợp lệ."],
    [409, "Đánh giá đã tồn tại."],
    [429, "Vui lòng thử lại sau."],
  ])("preserves backend status %i and message", async (status, message) => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { message } }), {
          status,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    await expect(
      submitProductReview("prod-1", {
        authorName: "Khách thử nghiệm",
        rating: 4,
        comment: "",
        photos: [],
        website: "",
      }),
    ).rejects.toMatchObject<ReviewRequestError>({ status, message });
  });

  it("leaves network failures distinguishable from backend responses", async () => {
    const networkError = new TypeError("fetch failed");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(networkError));

    await expect(
      submitProductReview("prod-1", {
        authorName: "Khách thử nghiệm",
        rating: 5,
        comment: "",
        photos: [],
        website: "",
      }),
    ).rejects.toBe(networkError);
  });
});
