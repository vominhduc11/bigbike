import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/messages/en.json";
import viMessages from "@/messages/vi.json";
import { ReviewCard } from "./ReviewCard";
import { WriteReviewForm } from "./WriteReviewForm";
import { ReviewRequestError, uploadReviewPhoto } from "./api";

vi.mock("@/lib/auth/auth-store", () => ({ useAuth: () => ({ status: "guest" }) }));
vi.mock("./api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./api")>()),
  uploadReviewPhoto: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(uploadReviewPhoto).mockReset();
  vi.stubGlobal(
    "URL",
    class extends URL {
      static createObjectURL() {
        return "blob:e2e-review-photo";
      }
      static revokeObjectURL() {}
    },
  );
});
afterEach(() => vi.unstubAllGlobals());

function localized(ui: ReactNode, locale: "vi" | "en") {
  return (
    <NextIntlClientProvider
      locale={locale}
      messages={locale === "vi" ? viMessages : en}
      timeZone="Asia/Ho_Chi_Minh"
    >
      {ui}
    </NextIntlClientProvider>
  );
}

describe.each(["vi", "en"] as const)("review labels in %s", (locale) => {
  it("renders a translated photo description, including author and position", () => {
    render(
      localized(
        <ReviewCard
          review={{
            id: "E2E_REVIEW_I18N",
            authorName: "E2E Reviewer",
            rating: 5,
            createdAt: "2026-09-14T00:00:00Z",
            photos: ["/media/reviews/e2e/photo.webp"],
          }}
        />,
        locale,
      ),
    );
    expect(
      screen.getByRole("img", {
        name:
          locale === "vi"
            ? "Ảnh 1 trong đánh giá của E2E Reviewer"
            : "Photo 1 in the review by E2E Reviewer",
      }),
    ).toBeInTheDocument();
  });

  it("shows the translated photo-count limit instead of a missing message key", async () => {
    vi.mocked(uploadReviewPhoto).mockResolvedValue("/media/reviews/e2e/photo.webp");
    const { container } = render(
      localized(<WriteReviewForm productId="E2E_REVIEW_I18N" onSuccess={vi.fn()} />, locale),
    );
    fireEvent.change(container.querySelector('input[type="file"]')!, {
      target: {
        files: Array.from(
          { length: 11 },
          (_, index) => new File(["image"], `${index}.webp`, { type: "image/webp" }),
        ),
      },
    });
    expect(
      await screen.findByText(
        locale === "vi"
          ? "Bạn chỉ có thể đính kèm tối đa 10 ảnh."
          : "You can attach up to 10 photos.",
      ),
    ).toBeInTheDocument();
    expect(uploadReviewPhoto).toHaveBeenCalledTimes(10);
  });

  it.each([400, 429, 500])(
    "localizes upload failure %i without showing the backend message",
    async (status) => {
      const rawMessage = "RAW_BACKEND_MESSAGE";
      vi.mocked(uploadReviewPhoto).mockRejectedValue(new ReviewRequestError(status, rawMessage));
      const { container } = render(
        localized(<WriteReviewForm productId="E2E_REVIEW_I18N" onSuccess={vi.fn()} />, locale),
      );
      fireEvent.change(container.querySelector('input[type="file"]')!, {
        target: {
          files: [new File(["image"], "photo.webp", { type: "image/webp" })],
        },
      });
      const messages = (locale === "vi" ? viMessages : en).Product.reviews;
      expect(
        await screen.findByText(
          status === 429 ? messages.errorPhotoRateLimit : messages.errorPhotoUpload,
        ),
      ).toBeInTheDocument();
      expect(screen.queryByText(rawMessage)).not.toBeInTheDocument();
    },
  );
});
