import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/image", () => ({
  default: ({ src, alt, fill, preload, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) => {
    void fill;
    void preload;
    return (
      // eslint-disable-next-line @next/next/no-img-element -- test double for next/image.
      <img src={String(src)} alt={alt ?? ""} data-next-image="true" {...props} />
    );
  },
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
        fill
        className="object-contain"
      />,
    );

    const image = screen.getByRole("img", { name: "Ảnh legacy" });
    expect(image).not.toHaveAttribute("data-next-image");
    expect(image).toHaveClass("absolute", "inset-0", "h-full", "w-full", "object-contain");
  });

  it("applies fill positioning to optimized images", () => {
    render(
      <MediaImage
        image={{ url: "/media/products/helmet.webp", width: 800, height: 800, alt: "Mũ bảo hiểm" }}
        altFallback="Mũ bảo hiểm"
        fill
        sizes="160px"
        className="object-contain"
      />,
    );

    const image = screen.getByRole("img", { name: "Mũ bảo hiểm" });
    expect(image).toHaveAttribute("data-next-image", "true");
    expect(image).toHaveClass("absolute", "inset-0", "h-full", "w-full", "object-contain");
    expect(image).toHaveAttribute("sizes", "160px");
  });

  it("keeps a missing-image placeholder inside the fill frame", () => {
    render(<MediaImage image={null} altFallback="Không có ảnh" fill className="object-contain" />);

    const placeholder = screen.getByLabelText("Không có ảnh");
    expect(placeholder).toHaveClass("absolute", "inset-0", "h-full", "w-full", "object-contain");
  });
});
