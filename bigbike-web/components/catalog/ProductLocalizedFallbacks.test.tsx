import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { FeaturedSpecsBar } from "./FeaturedSpecsBar";
import {
  ProductDescriptionTab,
  ProductFaqs,
  ProductProsCons,
  ProductSpecsTable,
} from "./ProductLocalizedParts";
import {
  ProductDescriptionBlocks,
  ProductSizeGuideSection,
  ProductSuitabilitySection,
} from "./ProductDescriptionBlocks";

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key,
}));

describe("PDP localized fields — fallback VI while English data is unavailable", () => {
  it("keeps product content visible when the localized provider has no data", () => {
    render(
      <>
        <FeaturedSpecsBar viStatsHtml="<p>Số liệu nổi bật VI</p>" />
        <ProductProsCons
          positiveNotes={[{ content: "Ưu điểm VI" }]}
          negativeNotes={[{ content: "Nhược điểm VI" }]}
        />
        <ProductSpecsTable viSpecsHtml="<p>Thông số VI</p>" />
        <ProductFaqs viFaqs={[{ question: "Câu hỏi VI", answer: "Trả lời VI" }]} />
        <ProductDescriptionTab viHtml="<p>Mô tả VI</p>" />
        <ProductDescriptionBlocks
          blocks={[{ type: "feature", heading: "Khối mô tả VI" }]}
          fallback={null}
        />
        <ProductSuitabilitySection section={{ title: "Phù hợp VI", html: "<p>Người đi phố</p>" }} />
        <ProductSizeGuideSection section={{ title: "Bảng size VI", html: "<p>Size M</p>" }} />
      </>,
    );

    expect(screen.getByText("Số liệu nổi bật VI")).toBeInTheDocument();
    expect(screen.getByText("Ưu điểm VI")).toBeInTheDocument();
    expect(screen.getByText("Nhược điểm VI")).toBeInTheDocument();
    expect(screen.getByText("Thông số VI")).toBeInTheDocument();
    expect(screen.getByText("Câu hỏi VI")).toBeInTheDocument();
    expect(screen.getByText("Mô tả VI")).toBeInTheDocument();
    expect(screen.getByText("Khối mô tả VI")).toBeInTheDocument();
    expect(screen.getByText("Người đi phố")).toBeInTheDocument();
    expect(screen.getByText("Size M")).toBeInTheDocument();
  });
});
