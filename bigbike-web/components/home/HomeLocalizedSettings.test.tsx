import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { HomeAboutSection } from "./HomeLocalizedSettings";

describe("HomeAboutSection heading semantics", () => {
  it("uses the existing introduction title as the homepage's only main heading", () => {
    render(<HomeAboutSection subtitle="BIGBIKE" title="SHOP BẢO HỘ MOTO UY TÍN" html="" />);

    const heading = screen.getByRole("heading", {
      level: 1,
      name: "SHOP BẢO HỘ MOTO UY TÍN",
    });

    expect(heading).toHaveClass("text-a1-title", "font-body", "font-semibold", "leading-title");
    expect(heading.parentElement).toHaveClass("text-center");
    expect(screen.queryByRole("heading", { level: 2 })).not.toBeInTheDocument();
  });
});
