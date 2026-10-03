import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { Article } from "@/lib/contracts/public";
import { ArticleCard } from "./ArticleCard";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) =>
    ({ articleExcerptFallback: "Xem chi tiết bài viết từ BigBike.", articleReadMore: "Đọc tiếp" })[
      key
    ] ?? key,
}));

vi.mock("@/components/i18n/LocalDate", () => ({
  useLocalDate: () => () => "20/09/2026",
}));

vi.mock("@/components/i18n/LocalizedLink", () => ({
  LocalizedLink: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));

vi.mock("@/components/ui/MediaImage", () => ({
  MediaImage: () => null,
}));

const article = (body: string): Article =>
  ({
    id: "article-1",
    slug: "bai-viet-1",
    title: "Bài viết thử nghiệm",
    body,
    publishStatus: "PUBLISHED",
    createdAt: "2026-09-20T00:00:00Z",
    updatedAt: "2026-09-20T00:00:00Z",
  }) as Article;

describe("ArticleCard", () => {
  it("lấy đoạn giới thiệu từ đầu nội dung bài viết", () => {
    render(<ArticleCard article={article("<p>Đoạn mở đầu của bài viết.</p>")} />);

    expect(screen.getByText("Đoạn mở đầu của bài viết.")).toBeInTheDocument();
  });

  it("vẫn hiển thị câu dự phòng khi nội dung trống", () => {
    render(<ArticleCard article={article("")} />);

    expect(screen.getByText("Xem chi tiết bài viết từ BigBike.")).toBeInTheDocument();
  });
});
