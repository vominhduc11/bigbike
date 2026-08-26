import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Product } from "@/lib/contracts/public";
import { BigBikeProductCard } from "./BigBikeProductCard";

const mocks = vi.hoisted(() => ({
  fetchPublicProduct: vi.fn(),
  recordChatInteraction: vi.fn(),
  attachCartAssistantAttribution: vi.fn(),
  addToCart: vi.fn(),
}));

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("@/lib/api/client-api", () => ({
  fetchPublicProduct: mocks.fetchPublicProduct,
  recordChatInteraction: mocks.recordChatInteraction,
  attachCartAssistantAttribution: mocks.attachCartAssistantAttribution,
}));
vi.mock("@/lib/cart-context", () => ({ useCart: () => ({ addToCart: mocks.addToCart }) }));
vi.mock("@/components/ui/MediaImage", () => ({ MediaImage: () => <div data-testid="image" /> }));
vi.mock("@/i18n/StorefrontLink", () => ({ default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a> }));
vi.mock("@/components/catalog/purchase/VariantPicker", () => ({
  VariantPicker: ({
    onPick,
    disableUnavailableOptions,
  }: {
    onPick: (name: string, value: string) => void;
    disableUnavailableOptions?: boolean;
  }) => (
    <div data-disable-unavailable={String(Boolean(disableUnavailableOptions))}>
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
    mocks.recordChatInteraction.mockResolvedValue({
      interactionId: "view-1",
      attributionToken: "signed-proof",
      attributionExpiresAt: "2026-08-31T00:00:00Z",
    });
    mocks.attachCartAssistantAttribution.mockResolvedValue({});
    mocks.addToCart.mockResolvedValue({ items: [{ quantity: 2 }] });
  });

  it("requires every variant choice and attributes the cart line to the conversation", async () => {
    const user = userEvent.setup();
    render(<BigBikeProductCard
      product={{ slug: "mu-test", name: "Mũ test", retailPrice: 1_590_000, currency: "VND", stockState: "IN_STOCK" }}
      locale="vi"
      conversationId="conversation-1"
    />);

    await user.click(screen.getByRole("button", { name: "chooseBuy" }));
    await user.click(screen.getByRole("button", { name: "chooseBuy" }));
    expect(await screen.findByText("selectVariantRequired")).toBeInTheDocument();
    expect(mocks.addToCart).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Màu đỏ" }));
    await user.click(screen.getByRole("button", { name: "Size M" }));
    await user.click(screen.getByRole("button", { name: "chooseBuy" }));

    await waitFor(() => expect(mocks.addToCart).toHaveBeenCalledWith(
      "product-1", 1, "variant-red-m", "conversation-1", undefined, true, "mu-test", undefined,
    ));
    expect(await screen.findByText("addedToCartDetailWithVariant")).toBeInTheDocument();
    expect(screen.getByText("cartItemCount")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "viewCart" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "checkout" })).toBeInTheDocument();
  });

  it("keeps the verified assistant action source on the cart line without an automatic lead invitation", async () => {
    const user = userEvent.setup();
    render(<BigBikeProductCard
      product={{ slug: "mu-test", name: "Mũ test", retailPrice: 1_590_000, currency: "VND", stockState: "IN_STOCK" }}
      locale="vi"
      conversationId="conversation-1"
      assistantMessageId="message-1"
      visitorToken="visitor-token"
    />);

    await user.click(screen.getByRole("button", { name: "chooseBuy" }));
    await user.click(screen.getByRole("button", { name: "Màu đỏ" }));
    await user.click(screen.getByRole("button", { name: "Size M" }));
    await user.click(screen.getByRole("button", { name: "chooseBuy" }));

    await waitFor(() => expect(mocks.addToCart).toHaveBeenCalledWith(
      "product-1", 1, "variant-red-m", "conversation-1", undefined, true, "mu-test", "signed-proof",
    ));
    expect(mocks.recordChatInteraction).toHaveBeenCalledWith(expect.objectContaining({
      conversationId: "conversation-1",
      assistantMessageId: "message-1",
      type: "PRODUCT_VIEWED",
      productSlug: "mu-test",
      visitorToken: "visitor-token",
    }));
  });

  it("contains the expanded variant picker and purchase controls inside the product card", async () => {
    const user = userEvent.setup();
    const { container } = render(<BigBikeProductCard
      product={{ slug: "mu-test", name: "Mũ test", retailPrice: 1_590_000, currency: "VND", stockState: "IN_STOCK" }}
      locale="vi"
    />);

    const card = container.querySelector("[data-bigbike-product-card]");
    expect(card).toHaveClass("w-full", "min-w-0", "max-w-full", "overflow-hidden");

    await user.click(screen.getByRole("button", { name: "chooseBuy" }));
    expect(container.querySelector("[data-disable-unavailable='true']")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Màu đỏ" }).closest("div.min-w-0"))
      .toHaveClass("max-w-full", "overflow-hidden");
    expect(screen.getByRole("button", { name: "chooseBuy" })).toHaveClass("w-full");
  });

  it("AC24/26: confirms the selected variant and links straight to checkout with the same cart", async () => {
    const user = userEvent.setup();
    render(<BigBikeProductCard
      product={{ slug: "mu-test", name: "Mũ test", retailPrice: 1_590_000, currency: "VND", stockState: "IN_STOCK" }}
      locale="en"
      conversationId="conversation-1"
    />);

    await user.click(screen.getByRole("button", { name: "chooseBuy" }));
    await user.click(screen.getByRole("button", { name: "Màu đỏ" }));
    await user.click(screen.getByRole("button", { name: "Size M" }));
    await user.click(screen.getByRole("button", { name: "chooseBuy" }));

    expect(await screen.findByText("addedToCartDetailWithVariant")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "checkout" })).toHaveAttribute("href", "/en/order/");
    expect(mocks.addToCart).toHaveBeenCalledWith(
      "product-1", 1, "variant-red-m", "conversation-1", undefined, true, "mu-test", undefined,
    );
  });
});
