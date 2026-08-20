import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/image", () => ({
  default: ({ src, alt, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) => (
    // eslint-disable-next-line @next/next/no-img-element -- test double for next/image.
    <img src={String(src)} alt={alt ?? ""} data-next-image="true" {...props} />
  ),
}));

import { MediaImage } from "./MediaImage";

describe("MediaImage source safety", () => {
  it("uses the Next optimizer for same-origin media with metadata", () => {
    render(
      <MediaImage
        image={{ url: "/media/products/helmet.webp", width: 800, height: 800, alt: "Mũ bảo hiểm" }}
        altFallback="Mũ bảo hiểm"
        sizes="200px"
      />,
    );

    expect(screen.getByRole("img", { name: "Mũ bảo hiểm" })).toHaveAttribute("data-next-image", "true");
  });

  it("keeps an unallowlisted legacy URL as a native image instead of breaking optimization", () => {
    render(
      <MediaImage
        image={{ url: "https://legacy.example.invalid/photo.jpg", width: 800, height: 600 }}
        altFallback="Ảnh legacy"
      />,
    );

    expect(screen.getByRole("img", { name: "Ảnh legacy" })).not.toHaveAttribute("data-next-image");
  });
});
