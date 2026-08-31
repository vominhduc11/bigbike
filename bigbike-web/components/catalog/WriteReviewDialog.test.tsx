import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WriteReviewDialog } from "./WriteReviewDialog";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock("@/components/ui/dialog", () => ({
  dialogMobileBottomSheet: "",
  Dialog: ({ open, children }: { open: boolean; children: ReactNode }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  DialogGrabber: () => null,
  DialogHeader: ({ children }: { children: ReactNode }) => <header>{children}</header>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));

vi.mock("@/components/catalog/ReviewsSection", () => ({
  WriteReviewForm: ({ inviteToken }: { inviteToken?: string }) => (
    <div data-testid="review-form" data-invite-token={inviteToken ?? ""} />
  ),
}));

afterEach(() => {
  window.history.replaceState(null, "", "/");
});

describe("WriteReviewDialog email invitation", () => {
  it("opens the existing anonymous review form from the product-specific email fragment", async () => {
    window.history.replaceState(
      null,
      "",
      "/product/mu-bao-hiem/#write-review=anonymous-review-token",
    );

    render(<WriteReviewDialog productId="helmet-1" />);

    const form = await screen.findByTestId("review-form");
    expect(form).toHaveAttribute("data-invite-token", "anonymous-review-token");
    expect(screen.getByTestId("dialog")).toBeInTheDocument();
    await waitFor(() => expect(window.location.hash).toBe(""));
    expect(window.location.pathname).toBe("/product/mu-bao-hiem/");
  });
});
