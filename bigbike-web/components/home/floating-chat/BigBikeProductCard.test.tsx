import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Product } from "@/lib/contracts/public";
import { BigBikeProductCard } from "./BigBikeProductCard";

const mocks = vi.hoisted(() => ({
  fetchPublicProduct: vi.fn(),
  addToCart: vi.fn(),
}));

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("@/lib/api/client-api", () => ({ fetchPublicProduct: mocks.fetchPublicProduct }));
vi.mock("@/lib/cart-context", () => ({ useCart: () => ({ addToCart: mocks.addToCart }) }));
vi.mock("@/components/ui/MediaImage", () => ({ MediaImage: () => <div data-testid="image" /> }));
vi.mock("@/i18n/StorefrontLink", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));
vi.mock("@/components/catalog/purchase/VariantPicker", () => ({
  VariantPicker: ({ onPick }: { onPick: (name: string, value: string) => void }) => (
    <div>
      <button type="button" onClick={() => onPick("Màu", "Đỏ")}>Màu đỏ</button>
      <button type="button" onClick={() => onPick("Size", "M")}>Size M</button>
    </div>
  ),
}));

const detail = {
  id: "product-1",
  slug: "mu-test",
  name: "Mũ test",
  category: { id: "category-1", slug: "mu-bao-hiem", name: "Mũ bảo hiểm" },
  price: { retailPrice: 1_590_000, currency: "VND" },
  stockState: "IN_STOCK",
  publishStatus: "PUBLISHED",
  homepageBlock: "NONE",
  variants: [{
    id: "variant-red-m",
    name: "Đỏ / M",
    options: [{ name: "Màu", value: "Đỏ" }, { name: "Size", value: "M" }],
    stockState: "IN_STOCK",
    isAvailable: true,
  }],
  createdAt: "",
  updatedAt: "",
} as Product;

describe("BigBikeProductCard", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.fetchPublicProduct.mockResolvedValue(detail);
    mocks.addToCart.mockResolvedValue({ items: [{ quantity: 2 }] });
  });

  it("requires the available variant and adds it to the cart", async () => {
    const user = userEvent.setup();
    render(<BigBikeProductCard product={{ slug: "mu-test", name: "Mũ test", retailPrice: 1_590_000, currency: "VND", stockState: "IN_STOCK" }} locale="vi" />);

    await user.click(screen.getByRole("button", { name: "chooseBuy" }));
    await user.click(screen.getByRole("button", { name: "chooseBuy" }));
    expect(await screen.findByText("selectVariantRequired")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Màu đỏ" }));
    await user.click(screen.getByRole("button", { name: "Size M" }));
    await user.click(screen.getByRole("button", { name: "chooseBuy" }));

    await waitFor(() => expect(mocks.addToCart).toHaveBeenCalledWith("product-1", 1, "variant-red-m", true));
    expect(await screen.findByText("addedToCartDetailWithVariant")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "checkout" })).toBeInTheDocument();
  });
});
