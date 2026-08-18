import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SafeChatMarkdown } from "./SafeChatMarkdown";

describe("SafeChatMarkdown", () => {
  it("renders only the approved paragraph, bold, list and table elements", () => {
    const { container } = render(
      <SafeChatMarkdown content={[
        "Mẫu **phù hợp**:",
        "",
        "- Đi phố",
        "- Đi xa",
        "",
        "| Size | Vòng đầu |",
        "| --- | --- |",
        "| M | 57–58 cm |",
      ].join("\n")} />,
    );

    expect(screen.getByText("phù hợp").tagName).toBe("STRONG");
    expect(screen.getByRole("list")).toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(container.querySelector("a, img, code, pre")).toBeNull();
    expect(screen.getByRole("table").parentElement).toHaveClass("overflow-x-auto");
  });
});
