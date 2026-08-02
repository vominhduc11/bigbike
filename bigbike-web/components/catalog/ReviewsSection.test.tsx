import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReviewsSection } from "./ReviewsSection";

vi.mock("next-intl", () => ({
  useLocale: () => "vi",
  useTranslations: () => (key: string, values?: { rating?: string; count?: number }) => {
    const messages: Record<string, string> = {
      errorLoad: "Không thể tải đánh giá.",
      formStars: "Số sao",
      formName: "Tên của bạn",
      formComment: "Nhận xét",
      writeButton: "Viết đánh giá",
      submit: "Gửi đánh giá",
      submitting: "Đang gửi...",
      ratingEmpty: "Chưa có đánh giá",
      ratingUnavailable: "Chưa có điểm trung bình",
      ratingEmptyAria: "Chưa có đánh giá, 0 đánh giá",
    };
    if (key === "ratingSummaryAria") return `${values?.rating} sao, ${values?.count} đánh giá`;
    if (key === "ratingCount") return `(${values?.count} đánh giá)`;
    if (key === "ratingUnavailableAria") return `Chưa có điểm trung bình, ${values?.count} đánh giá`;
    return messages[key] ?? key;
  },
}));

function createReviewsPage(page: number, hasNext: boolean, reviews: Array<{
  id: number;
  authorName: string;
  rating: number;
  comment: string;
  createdAt: string;
}>) {
  return {
    avgRating: 4.7,
    totalReviews: 3,
    ratingBreakdown: {},
    reviews,
    pagination: {
      page,
      pageSize: 10,
      totalItems: 3,
      totalPages: 2,
      hasNext,
      hasPrevious: page > 1,
    },
  };
}

function renderReviewsSection() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ReviewsSection productId="prod-test" />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("ReviewsSection", () => {
  it("renders the WooCommerce-style first review page without a load-more control", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify(
          createReviewsPage(1, true, [
            {
              id: 1,
              authorName: "Reviewer One",
              rating: 5,
              comment: "First review",
              createdAt: "2026-05-05T10:00:00Z",
            },
            {
              id: 2,
              authorName: "Reviewer Two",
              rating: 4,
              comment: "Second review",
              createdAt: "2026-05-04T10:00:00Z",
            },
          ]),
        ),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    vi.stubGlobal("fetch", fetchMock);

    renderReviewsSection();

    expect(await screen.findByText("Reviewer One")).toBeInTheDocument();
    expect(screen.getByText("Reviewer Two")).toBeInTheDocument();
    // Khối đánh giá CHỈ để XEM: không còn form viết inline (đã chuyển sang modal),
    // chỉ còn nút "Viết đánh giá" mở modal đó.
    expect(screen.queryByText("Đánh giá của bạn")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Viết đánh giá" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /xem thêm/i })).not.toBeInTheDocument();

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/products/prod-test/reviews/?page=1&size=10&sort=newest&lang=vi",
    );
  });

  // ── REVIEW_RULE_002/003 — summary PDP: trung bình cộng + ẩn khi 0 review ──

  function stubReviewsResponse(payload: {
    avgRating: number;
    totalReviews: number;
    ratingBreakdown?: Record<string, number>;
  }) {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          avgRating: payload.avgRating,
          totalReviews: payload.totalReviews,
          ratingBreakdown: payload.ratingBreakdown ?? {},
          reviews: [],
          pagination: {
            page: 1,
            pageSize: 10,
            totalItems: payload.totalReviews,
            totalPages: 1,
            hasNext: false,
            hasPrevious: false,
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  /** Rating summary là span[aria-label] — phân biệt với nút radio của form. */
  function summaryRatingRow(container: HTMLElement) {
    return container.querySelector('span[aria-label*="đánh giá"]');
  }

  /**
   * Số điểm trung bình lớn (VD "3.5") — query theo class riêng thay vì
   * screen.findByText, vì từ REVIEW_RULE_008 bảng phân bố có 9 dòng nửa sao
   * (5, 4.5, 4, 3.5...) nên "3.5"/"4.5" có thể trùng chữ với nhãn dòng breakdown.
   */
  function avgScoreText(container: HTMLElement) {
    return container.querySelector(".text-a1-title")?.textContent ?? null;
  }

  it("0 review (totalReviews = 0) → hiện sao trung tính và không hiện điểm giả", async () => {
    stubReviewsResponse({ avgRating: 0, totalReviews: 0 });
    const { container } = renderReviewsSection();

    expect(await screen.findByText("beFirst")).toBeInTheDocument();
    expect(summaryRatingRow(container)).not.toBeNull();
    expect(screen.getByText("Chưa có đánh giá")).toBeInTheDocument();
    expect(screen.getByText("(0 đánh giá)")).toBeInTheDocument();
    expect(container.querySelector('[role="group"]')).toBeNull();
    expect(screen.queryByText("0.0")).not.toBeInTheDocument();
  });

  it("review [5,4,3] → trung bình 4.0: hiện '4.0', 4 sao đầy + sao 5 rỗng (không Math.round)", async () => {
    stubReviewsResponse({
      avgRating: 4.0,
      totalReviews: 3,
      ratingBreakdown: { "5": 1, "4": 1, "3": 1, "2": 0, "1": 0 },
    });
    const { container } = renderReviewsSection();

    expect(await screen.findByText("4.0")).toBeInTheDocument();
    const starRow = summaryRatingRow(container);
    expect(starRow).not.toBeNull();
    const overlay = starRow!.querySelector<HTMLElement>("span.absolute");
    expect(overlay).not.toBeNull();
    expect(overlay!.style.width).toBe("80%");
  });

  it("review [5,2] → trung bình 3.5: hiện '3.5', sao thứ 4 tô đúng 50% (nửa sao, khớp RatingStars)", async () => {
    stubReviewsResponse({
      avgRating: 3.5,
      totalReviews: 2,
      ratingBreakdown: { "5": 1, "4": 0, "3": 0, "2": 1, "1": 0 },
    });
    const { container } = renderReviewsSection();

    await waitFor(() => expect(avgScoreText(container)).toBe("3.5"));
    const starRow = summaryRatingRow(container);
    expect(starRow).not.toBeNull();
    const overlay = starRow!.querySelector<HTMLElement>("span.absolute");
    expect(overlay).not.toBeNull();
    expect(overlay!.style.width).toBe("70%");
  });
});
