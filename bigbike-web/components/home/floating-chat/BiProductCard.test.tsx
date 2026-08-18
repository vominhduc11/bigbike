import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Product } from "@/lib/contracts/public";
import { BiProductCard } from "./BiProductCard";

const mocks = vi.hoisted(() => ({
  fetchPublicProduct: vi.fn(),
  addToCart: vi.fn(),
}));

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("@/lib/api/client-api", () => ({ fetchPublicProduct: mocks.fetchPublicProduct }));
vi.mock("@/lib/cart-context", () => ({ useCart: () => ({ addToCart: mocks.addToCart }) }));
vi.mock("@/components/ui/MediaImage", () => ({ MediaImage: () => <div data-testid="image" /> }));
vi.mock("@/i18n/StorefrontLink", () => ({ default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a> }));
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

describe("BiProductCard", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.fetchPublicProduct.mockResolvedValue(detail);
    mocks.addToCart.mockResolvedValue(undefined);
  });

  it("requires every variant choice and attributes the cart line to the conversation", async () => {
    const user = userEvent.setup();
    render(<BiProductCard
      product={{ slug: "mu-test", name: "Mũ test", retailPrice: 1_590_000, currency: "VND", stockState: "IN_STOCK" }}
      locale="vi"
      conversationId="conversation-1"
    />);

    await user.click(screen.getByRole("button", { name: "addToCart" }));
    expect(await screen.findByText("selectVariantRequired")).toBeInTheDocument();
    expect(mocks.addToCart).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Màu đỏ" }));
    await user.click(screen.getByRole("button", { name: "Size M" }));
    await user.click(screen.getByRole("button", { name: "addToCart" }));

    await waitFor(() => expect(mocks.addToCart).toHaveBeenCalledWith(
      "product-1", 1, "variant-red-m", "conversation-1",
    ));
    expect(await screen.findByText("addedToCart")).toBeInTheDocument();
  });
});
