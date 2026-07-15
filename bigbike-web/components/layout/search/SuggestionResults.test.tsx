import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { SuggestionResults } from "./SuggestionResults";

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key,
}));

describe("SuggestionResults", () => {
  it("uses English slugs and routes for English suggestions", () => {
    render(
      <SuggestionResults
        suggestions={[{
          id: "product-1",
          slug: "mu-bao-hiem",
          slugEn: "motorcycle-helmet",
          name: "Motorcycle Helmet",
        }]}
        articleSuggestions={[{
          id: "article-1",
          slug: "cach-chon-mu",
          slugEn: "how-to-choose-a-helmet",
          title: "How to choose a helmet",
        }]}
        trimmedQuery="helmet"
        addSearch={vi.fn()}
        handleClose={vi.fn()}
      />,
    );

    expect(screen.getByRole("option", { name: /Motorcycle Helmet/i }))
      .toHaveAttribute("href", "/product/motorcycle-helmet");
    expect(screen.getByRole("option", { name: /How to choose a helmet/i }))
      .toHaveAttribute("href", "/news/how-to-choose-a-helmet");
  });
});
