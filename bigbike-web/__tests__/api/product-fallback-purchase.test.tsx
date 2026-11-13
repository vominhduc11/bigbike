import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { PurchaseSection } from "@/components/catalog/PurchaseSection";
import { merchantProduct } from "../merchant/fixtures";

const state = vi.hoisted(() => ({
  query: {
    data: undefined as unknown,
    isError: false,
    isFetchedAfterMount: false,
    isFetching: false,
  },
}));
vi.mock("@tanstack/react-query", () => ({ useQuery: () => state.query }));
vi.mock("next-intl", () => ({
  useLocale: () => "vi",
  useTranslations: () => (key: string) => key,
}));
vi.mock("@/lib/cart-context", () => ({ useCart: () => ({ addToCart: vi.fn() }) }));
vi.mock("@/lib/analytics", () => ({
  getAnalyticsVariant: () => undefined,
  toGa4ItemFromProduct: () => ({}),
  trackViewItem: vi.fn(),
}));
vi.mock("@/components/i18n/LocalizedContent", () => ({
  useLocalizedField: () => undefined,
  LHtml: () => null,
}));
vi.mock("@/components/i18n/LocalizedLink", () => ({
  LocalizedLink: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));
vi.mock("@/components/catalog/ProductGallery", () => ({ ProductGallery: () => null }));
vi.mock("@/components/catalog/MobileStickyPurchaseBar", () => ({
  MobileStickyPurchaseBar: () => null,
}));
vi.mock("@/components/catalog/purchase/RatingBlock", () => ({ RatingBlock: () => null }));
vi.mock("@/components/catalog/purchase/CommitmentsList", () => ({ CommitmentsList: () => null }));
vi.mock("@/components/catalog/purchase/BuyButtons", () => ({
  BuyButtons: ({ canBuy }: { canBuy: boolean }) => <button disabled={!canBuy}>Buy</button>,
}));

it("locks fallback purchases until this mount verifies price/stock, and locks again after failure", () => {
  const product = merchantProduct();
  const props = { product, gallery: [], rating: null, ratingCount: null, fallback: true };
  const view = render(<PurchaseSection {...props} />);
  expect(screen.getByRole("button", { name: "Buy" })).toBeDisabled();
  state.query = {
    data: { pricing: product.price, stock: { stockState: "IN_STOCK" }, variants: [] },
    isError: false,
    isFetchedAfterMount: false,
    isFetching: false,
  };
  view.rerender(<PurchaseSection {...props} />);
  expect(screen.getByRole("button", { name: "Buy" })).toBeDisabled();
  state.query.isFetchedAfterMount = true;
  view.rerender(<PurchaseSection {...props} />);
  expect(screen.getByRole("button", { name: "Buy" })).toBeEnabled();
  state.query.isError = true;
  view.rerender(<PurchaseSection {...props} />);
  expect(screen.getByRole("button", { name: "Buy" })).toBeDisabled();
  view.unmount();
});
