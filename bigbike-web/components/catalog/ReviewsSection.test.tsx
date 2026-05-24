import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReviewsSection } from "./ReviewsSection";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => {
    const messages: Record<string, string> = {
      errorLoad: "Không thể tải đánh giá.",
      formTitle: "Đánh giá của bạn",
      formStars: "Số sao",
      formName: "Tên của bạn",
      formComment: "Nhận xét",
      submit: "Gửi đánh giá",
      submitting: "Đang gửi...",
    };
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
    expect(screen.getByText("Đánh giá của bạn")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /xem thêm/i })).not.toBeInTheDocument();

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/products/prod-test/reviews/?page=1&size=10");
  });
});
