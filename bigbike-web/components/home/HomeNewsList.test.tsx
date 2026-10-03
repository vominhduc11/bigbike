import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { Article } from "@/lib/contracts/public";
import { HomeNewsList } from "./HomeNewsList";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) =>
    ({ articleExcerptFallback: "Xem chi tiết bài viết từ BigBike." })[key] ?? key,
}));

vi.mock("@/components/i18n/LocalDate", () => ({
  LocalDate: () => <time>20/09/2026</time>,
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
    title: "Bài viết trang chủ",
    body,
    publishStatus: "PUBLISHED",
    createdAt: "2026-09-20T00:00:00Z",
    updatedAt: "2026-09-20T00:00:00Z",
  }) as Article;

describe("HomeNewsList", () => {
  it("lấy đoạn giới thiệu từ đầu nội dung bài viết", () => {
    render(<HomeNewsList initialArticles={[article("<p>Đoạn mở đầu trang chủ.</p>")]} />);

    expect(screen.getByText("Đoạn mở đầu trang chủ.")).toBeInTheDocument();
  });

  it("không để trống ô giới thiệu khi nội dung bài chưa có", () => {
    render(<HomeNewsList initialArticles={[article("")]} />);

    expect(screen.getByText("Xem chi tiết bài viết từ BigBike.")).toBeInTheDocument();
  });
});
