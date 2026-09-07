import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  GA_CURRENCY,
  GA_SHIPPING_TIER,
  toGa4ItemFromProduct,
  toGa4ItemsFromCart,
  toGa4ItemsFromOrder,
  trackAddPaymentInfo,
  trackAddShippingInfo,
  trackAddToCart,
  trackBeginCheckout,
  trackPurchase,
  trackRemoveFromCart,
  trackSelectItem,
  trackViewCart,
  trackViewItem,
  trackViewItemList,
} from "@/lib/analytics";
import type { Cart, CartItem, OrderDetail, OrderLineItem } from "@/lib/contracts/commerce";
import type { Product } from "@/lib/contracts/public";
import { buildMerchantFeed } from "@/lib/merchant/feed";
import { merchantVariants } from "@/__tests__/merchant/fixtures";

/** Every event GA4 receives, as [eventName, params]. */
function sentEvents(): Array<[string, Record<string, unknown>]> {
  const gtag = window.gtag as unknown as { mock: { calls: unknown[][] } };
  return gtag.mock.calls
    .filter((call) => call[0] === "event")
    .map((call) => [call[1] as string, call[2] as Record<string, unknown>]);
}

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: "11111111-2222-3333-4444-555555555555",
    sku: "AGV-K6-RED-L",
    slug: "mu-bao-hiem-agv-k6",
    name: "Mũ bảo hiểm AGV K6",
    brand: { id: "b1", slug: "agv", name: "AGV" },
    category: { id: "c1", slug: "mu-bao-hiem", name: "Mũ bảo hiểm" },
    price: { retailPrice: 2500000, salePrice: null, currency: "VND" },
    stockState: "IN_STOCK",
    ...overrides,
  } as Product;
}

function cartItem(overrides: Partial<CartItem> = {}): CartItem {
  return {
    id: "line-1",
    productId: "11111111-2222-3333-4444-555555555555",
    productVariantId: null,
    sku: "AGV-K6-RED-L",
    productName: "Mũ bảo hiểm AGV K6",
    variantName: null,
    quantity: 2,
    unitPrice: 2500000,
    lineSubtotal: 5000000,
    lineDiscount: 0,
    lineTotal: 5000000,
    available: true,
    ...overrides,
  };
}

function cart(overrides: Partial<Cart> = {}): Cart {
  return {
    id: "cart-1",
    status: "ACTIVE",
    currency: "VND",
    items: [cartItem()],
    totals: {
      subtotalAmount: 5000000,
      discountAmount: 0,
      shippingAmount: 0,
      feeAmount: 0,
      totalAmount: 5000000,
    },
    ...overrides,
  };
}

function orderLine(overrides: Partial<OrderLineItem> = {}): OrderLineItem {
  return {
    id: "oline-1",
    productId: "11111111-2222-3333-4444-555555555555",
    productVariantId: null,
    sku: "AGV-K6-RED-L",
    productName: "Mũ bảo hiểm AGV K6",
    variantName: null,
    quantity: 2,
    unitPrice: 2500000,
    lineSubtotal: 5000000,
    lineDiscount: 0,
    lineTotal: 5000000,
    productThumbnailUrl: null,
    ...overrides,
  };
}

function order(overrides: Partial<OrderDetail> = {}): OrderDetail {
  return {
    id: "order-uuid-1",
    orderNumber: "BB2609060001",
    orderKey: "secret",
    status: "PENDING",
    currency: "VND",
    subtotalAmount: 5000000,
    discountAmount: 0,
    shippingAmount: 0,
    feeAmount: 0,
    taxAmount: 0,
    totalAmount: 5000000,
    paidAmount: 0,
    placedAt: "2026-09-06T00:00:00Z",
    lineItems: [orderLine()],
    ...overrides,
  } as OrderDetail;
}

beforeEach(() => {
  window.gtag = vi.fn();
});

afterEach(() => {
  delete window.gtag;
});

describe("item mapping", () => {
  it("matches the existing Merchant feed SKU and price, including a selected non-default variant", () => {
    const catalog = merchantVariants();
    const xml = new DOMParser().parseFromString(
      buildMerchantFeed([catalog]).xml,
      "application/xml",
    );
    const ids = Array.from(xml.getElementsByTagName("g:id")).map((node) => node.textContent);
    for (const variant of catalog.variants!) {
      const item = toGa4ItemFromProduct(catalog, { variant });
      expect(ids).toContain(item.item_id);
      expect(item.item_id).toBe(variant.sku);
      expect(item.item_id).not.toBe(catalog.sku);
      expect(item.item_variant).toBe(variant.name);
    }
    // The generic card displays the lowest price, which belongs to the red variant here.
    expect(toGa4ItemFromProduct(catalog)).toMatchObject({
      item_id: "E2E_GMC_RED_L",
      price: 800000,
    });
    expect(toGa4ItemFromProduct(catalog, { variant: catalog.variants![0] })).toMatchObject({
      item_id: "E2E_GMC_BLUE_M",
      price: 1100000,
    });
  });

  it.each(["vi", "en"])("keeps variant SKU and metadata through all ten events (%s)", (locale) => {
    const catalog = merchantVariants();
    const variant = catalog.variants![0];
    catalog.price = variant.price!;
    if (locale === "en") catalog.name = "Protective jacket";
    const line = cartItem({
      sku: variant.sku!,
      productId: catalog.id,
      productVariantId: variant.id,
      productName: catalog.name,
      variantName: variant.name,
      unitPrice: 1100000,
      brandName: catalog.brand!.name,
      categoryName: catalog.category!.name,
    });
    const basket = cart({ items: [line] });
    const list = { id: "jackets", name: "Áo bảo hộ" };
    trackViewItemList([catalog], list);
    trackSelectItem(catalog, list, 0);
    trackViewItem(catalog, variant);
    trackAddToCart(line, 1);
    trackRemoveFromCart(line);
    trackViewCart(basket);
    trackBeginCheckout(basket);
    trackAddShippingInfo(basket);
    trackAddPaymentInfo(basket, "COD");
    trackPurchase(order({ lineItems: [{ ...line, productThumbnailUrl: null }] }));
    expect(sentEvents().map(([name]) => name)).toEqual([
      "view_item_list",
      "select_item",
      "view_item",
      "add_to_cart",
      "remove_from_cart",
      "view_cart",
      "begin_checkout",
      "add_shipping_info",
      "add_payment_info",
      "purchase",
    ]);
    for (const [, params] of sentEvents()) {
      expect(params.items).toEqual([
        expect.objectContaining({
          item_id: variant.sku,
          item_brand: catalog.brand!.name,
          item_category: catalog.category!.name,
          item_variant: variant.name,
          price: 1100000,
          currency: "VND",
        }),
      ]);
    }
  });

  it("omits unknown catalog metadata without guessing or breaking older commerce responses", () => {
    for (const item of [
      toGa4ItemsFromCart([cartItem({ brandName: "  ", categoryName: null, variantName: " " })])[0],
      toGa4ItemsFromOrder([orderLine()])[0],
    ]) {
      expect(item.item_brand).toBeUndefined();
      expect(item.item_category).toBeUndefined();
      expect(item.item_variant).toBeUndefined();
      expect(item.item_id).toBe("AGV-K6-RED-L");
    }
  });

  it("sends the real SKU as item_id so Merchant Center and Ads can match the product", () => {
    expect(toGa4ItemFromProduct(product()).item_id).toBe("AGV-K6-RED-L");
    expect(toGa4ItemsFromCart([cartItem()])[0].item_id).toBe("AGV-K6-RED-L");
    expect(toGa4ItemsFromOrder([orderLine()])[0].item_id).toBe("AGV-K6-RED-L");
  });

  it("falls back to a stable identifier only when the line has no SKU", () => {
    expect(toGa4ItemFromProduct(product({ sku: undefined })).item_id).toBe("mu-bao-hiem-agv-k6");
    expect(toGa4ItemsFromCart([cartItem({ sku: null })])[0].item_id).toBe(
      "11111111-2222-3333-4444-555555555555",
    );
    expect(toGa4ItemsFromOrder([orderLine({ sku: null, productId: null })])[0].item_id).toBe(
      "oline-1",
    );
  });

  it("prices are integers — VND has no minor unit and backend decimals must not leak through", () => {
    const item = toGa4ItemsFromCart([cartItem({ unitPrice: 2500000.4 })])[0];
    expect(item.price).toBe(2500000);
    expect(Number.isInteger(item.price)).toBe(true);
    expect(typeof item.price).toBe("number");
  });

  it("uses the sale price, not the list price, when a product is discounted", () => {
    const discounted = product({
      price: { retailPrice: 2500000, salePrice: 1990000, currency: "VND" },
    });
    expect(toGa4ItemFromProduct(discounted).price).toBe(1990000);
  });

  it("carries brand and category on catalog items and VND on every item", () => {
    const item = toGa4ItemFromProduct(product());
    expect(item.item_brand).toBe("AGV");
    expect(item.item_category).toBe("Mũ bảo hiểm");
    expect(item.currency).toBe(GA_CURRENCY);
    expect(toGa4ItemsFromCart([cartItem()])[0].currency).toBe("VND");
  });
});

describe("events", () => {
  it("stays silent when GA4 is not configured instead of throwing", () => {
    delete window.gtag;
    expect(() => trackViewItem(product())).not.toThrow();
    expect(() => trackPurchase(order())).not.toThrow();
  });

  it("reports a product list with its identity and positions", () => {
    trackViewItemList([product(), product({ id: "p2", sku: "SKU-2" })], {
      id: "category_mu-bao-hiem",
      name: "Mũ bảo hiểm",
    });
    const [name, params] = sentEvents()[0];
    expect(name).toBe("view_item_list");
    expect(params.item_list_id).toBe("category_mu-bao-hiem");
    expect((params.items as Array<{ index?: number }>).map((i) => i.index)).toEqual([0, 1]);
  });

  it("skips an empty list rather than reporting a phantom impression", () => {
    trackViewItemList([], { id: "search_results", name: "Kết quả tìm kiếm" });
    expect(sentEvents()).toHaveLength(0);
  });

  it("attributes a click back to the list it came from", () => {
    trackSelectItem(product(), { id: "related_products", name: "Sản phẩm tương tự" }, 3);
    const [name, params] = sentEvents()[0];
    expect(name).toBe("select_item");
    expect(params.item_list_id).toBe("related_products");
    expect((params.items as Array<{ index?: number }>)[0].index).toBe(3);
  });

  it("values add_to_cart by the quantity just added, not the running line total", () => {
    trackAddToCart(cartItem({ quantity: 5, unitPrice: 2500000 }), 2);
    const [name, params] = sentEvents()[0];
    expect(name).toBe("add_to_cart");
    expect(params.value).toBe(5000000);
    expect((params.items as Array<{ quantity?: number }>)[0].quantity).toBe(2);
  });

  it("reports the fixed shipping tier, since the storefront has no carrier chooser", () => {
    trackAddShippingInfo(cart());
    const [name, params] = sentEvents()[0];
    expect(name).toBe("add_shipping_info");
    expect(params.shipping_tier).toBe(GA_SHIPPING_TIER);
    expect(params.currency).toBe("VND");
  });

  it("passes the chosen payment method through", () => {
    trackAddPaymentInfo(cart(), "BANK_TRANSFER");
    const [name, params] = sentEvents()[0];
    expect(name).toBe("add_payment_info");
    expect(params.payment_type).toBe("BANK_TRANSFER");
  });

  it("uses the real order number as transaction_id, never a generated value", () => {
    trackPurchase(order());
    const [name, params] = sentEvents()[0];
    expect(name).toBe("purchase");
    expect(params.transaction_id).toBe("BB2609060001");
    expect(params.value).toBe(5000000);
    expect(params.currency).toBe("VND");
  });

  it("never leaks customer identity into the purchase payload", () => {
    trackPurchase(
      order({
        customerEmail: "khach@example.com",
        customerPhone: "0900000000",
        orderKey: "secret-lookup-key",
      } as Partial<OrderDetail>),
    );
    const serialized = JSON.stringify(sentEvents()[0][1]);
    expect(serialized).not.toContain("khach@example.com");
    expect(serialized).not.toContain("0900000000");
    expect(serialized).not.toContain("secret-lookup-key");
  });
});
