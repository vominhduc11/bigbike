import { render } from "@testing-library/react";
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
vi.mock("next-intl", () => ({
  useLocale: () => "vi",
  useTranslations: () => (key: string) => key,
}));
vi.mock("next-intl/server", () => ({ getTranslations: async () => (key: string) => key }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }));
vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={String(href)} {...props}>{children}</a>
  ),
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({
    data: {
      data: [{ id: "agv", name: "AGV", slug: "agv", logo: { url: "/media/brands/agv.png" } }],
      pagination: null,
    },
    isLoading: false,
    isFetching: false,
    isError: false,
  }),
}));

import { BrandListClient } from "./BrandListClient";
import { BrandListDefault } from "./BrandListDefault";
import type { Brand } from "@/lib/contracts/public";

const brands = [{ id: "agv", name: "AGV", slug: "agv", logo: { url: "/media/brands/agv.png" } }] as Brand[];

function frame(container: HTMLElement) {
  const value = container.querySelector('[data-brand-list-grid] [data-brand-logo="true"]');
  expect(value).not.toBeNull();
  expect(value).toHaveClass("size-24", "aspect-square");
  expect(value?.querySelector("img")).toHaveClass("h-full", "w-full", "object-contain");
}

describe("BrandList logo frames", () => {
  it("uses the same fixed frame in the client and server variants", async () => {
    const serverView = await BrandListDefault({ brands, pagination: null, locale: "vi" });
    const server = render(serverView);
    frame(server.container);

    const client = render(<BrandListClient initialBrands={brands} initialPagination={null} />);
    frame(client.container);

    const serverSizes = server.container.querySelector("img")?.getAttribute("sizes");
    const clientSizes = client.container.querySelector("img")?.getAttribute("sizes");
    expect(serverSizes).toBe(clientSizes);
  });
});
