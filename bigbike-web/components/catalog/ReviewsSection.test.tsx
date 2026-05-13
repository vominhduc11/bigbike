import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReviewsSection } from "./ReviewsSection";

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
  it("appends reviews when loading more pages", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(
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
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify(
            createReviewsPage(2, false, [
              {
                id: 3,
                authorName: "Reviewer Three",
                rating: 5,
                comment: "Third review",
                createdAt: "2026-05-03T10:00:00Z",
              },
            ]),
          ),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );

    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    renderReviewsSection();

    expect(await screen.findByText("Reviewer One")).toBeInTheDocument();
    expect(screen.getByText("Reviewer Two")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Xem thêm đánh giá" }));

    expect(await screen.findByText("Reviewer Three")).toBeInTheDocument();
    expect(screen.getByText("Reviewer One")).toBeInTheDocument();
    expect(screen.getByText("Reviewer Two")).toBeInTheDocument();

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/products/prod-test/reviews/?page=1&size=10");
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/products/prod-test/reviews/?page=2&size=10");
    expect(screen.queryByRole("button", { name: "Xem thêm đánh giá" })).not.toBeInTheDocument();
  });
});
