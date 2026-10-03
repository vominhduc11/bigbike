import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  GA_CURRENCY,
  GA_PAYMENT_TYPE,
  GA_SHIPPING_TIER,
  clearPendingAuthentication,
  consumePendingAuthentication,
  getAnalyticsClientId,
  markPendingAuthentication,
  setAnalyticsUserId,
  toGa4ItemFromProduct,
  toGa4ItemsFromCart,
  toGa4ItemsFromOrder,
  trackAddPaymentInfo,
  trackAddShippingInfo,
  trackAddToCart,
  trackAuthentication,
  trackBeginCheckout,
  trackCatalogFilter,
  trackContactClick,
  trackContentSection,
  trackPurchase,
  trackRemoveFromCart,
  trackReviewSubmit,
  trackScrollDepth,
  trackSearch,
  trackSelectItem,
  trackSelectPromotion,
  trackSizeGuideUse,
  trackVideoOpen,
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

/** Every standard Meta event, as [eventName, params, optional options]. */
function sentMetaEvents(): Array<[string, Record<string, unknown>, Record<string, unknown>?]> {
  const fbq = window.fbq as unknown as { mock: { calls: unknown[][] } };
  return fbq.mock.calls
    .filter((call) => call[0] === "track")
    .map((call) => [
      call[1] as string,
      call[2] as Record<string, unknown>,
      call[3] as Record<string, unknown> | undefined,
    ]);
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
  window.fbq = vi.fn();
});

afterEach(() => {
  clearPendingAuthentication();
  document.querySelectorAll("[data-analytics-product-id]").forEach((node) => node.remove());
  delete window.gtag;
  delete window.clarity;
  delete window.fbq;
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

  it.each(["vi", "en"])(
    "keeps variant SKU and metadata through all ten commerce events (%s)",
    (locale) => {
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
      trackAddPaymentInfo(basket);
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
    },
  );

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
  it("reads GA4's own browser id for a later server-side cancellation", async () => {
    window.gtag = vi.fn((...args: unknown[]) => {
      if (args[0] === "get") (args[3] as (value: string) => void)("123456789.987654321");
    });

    await expect(getAnalyticsClientId("G-TEST1234", 50)).resolves.toBe("123456789.987654321");
    expect(window.gtag).toHaveBeenCalledWith(
      "get",
      "G-TEST1234",
      "client_id",
      expect.any(Function),
    );
  });

  it("drops missing or malformed browser ids without blocking checkout", async () => {
    await expect(getAnalyticsClientId(undefined, 0)).resolves.toBeUndefined();
    window.gtag = vi.fn((...args: unknown[]) => {
      if (args[0] === "get") (args[3] as (value: string) => void)("not-a-client-id");
    });
    await expect(getAnalyticsClientId("G-TEST1234", 50)).resolves.toBeUndefined();
  });

  it("stays silent when GA4 is not configured instead of throwing", () => {
    delete window.gtag;
    delete window.fbq;
    expect(() => trackViewItem(product())).not.toThrow();
    expect(() => trackPurchase(order())).not.toThrow();
  });

  it("maps only Meta's supported commerce events from the same GA4 item source", () => {
    const catalog = product();
    const line = cartItem({ brandName: "AGV", categoryName: "Mũ bảo hiểm" });
    const basket = cart({ items: [line] });

    trackViewItemList([catalog], { id: "helmets", name: "Mũ bảo hiểm" });
    trackSelectItem(catalog, { id: "helmets", name: "Mũ bảo hiểm" });
    trackViewItem(catalog);
    trackAddToCart(line, 1);
    trackRemoveFromCart(line);
    trackViewCart(basket);
    trackBeginCheckout(basket);
    trackAddShippingInfo(basket);
    trackAddPaymentInfo(basket);
    trackPurchase(order({ lineItems: [{ ...line, productThumbnailUrl: null }] }));

    expect(sentMetaEvents().map(([name]) => name)).toEqual([
      "ViewContent",
      "AddToCart",
      "InitiateCheckout",
      "AddPaymentInfo",
      "Purchase",
    ]);
    const [viewName, viewPayload] = sentMetaEvents()[0];
    expect(viewName).toBe("ViewContent");
    expect(viewPayload).toMatchObject({
      content_ids: ["AGV-K6-RED-L"],
      content_type: "product",
      currency: "VND",
      value: 2500000,
      num_items: 1,
      contents: [{ id: "AGV-K6-RED-L", quantity: 1, item_price: 2500000 }],
    });
    const [, purchasePayload, purchaseOptions] = sentMetaEvents()[sentMetaEvents().length - 1];
    expect(purchasePayload).toMatchObject({
      content_ids: ["AGV-K6-RED-L"],
      currency: "VND",
      value: 5000000,
      contents: [{ id: "AGV-K6-RED-L", quantity: 2, item_price: 2500000 }],
    });
    expect(purchaseOptions).toEqual({ eventID: "purchase_BB2609060001" });
    expect(typeof purchasePayload.value).toBe("number");
    expect(Number.isInteger(purchasePayload.value as number)).toBe(true);
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

  it("reports normalized search terms, result counts and their separate surfaces", () => {
    trackSearch("  mũ   bảo hiểm  ", 5.9, "header_quick");
    trackSearch("mũ bảo hiểm", 27, "results_page");

    expect(sentEvents()).toEqual([
      [
        "search",
        {
          search_term: "mũ bảo hiểm",
          result_count: 5,
          search_surface: "header_quick",
        },
      ],
      [
        "search",
        {
          search_term: "mũ bảo hiểm",
          result_count: 27,
          search_surface: "results_page",
        },
      ],
    ]);
    expect(sentMetaEvents()).toEqual([
      ["Search", { search_string: "mũ bảo hiểm" }, undefined],
      ["Search", { search_string: "mũ bảo hiểm" }, undefined],
    ]);
  });

  it.each([
    "khach@example.com",
    "0906 902 404",
    "550e8400-e29b-41d4-a716-446655440000",
    "eyJhbGciOiJIUzI1NiJ9abcdefghijk",
  ])("redacts a private-looking search term instead of leaking it: %s", (term) => {
    trackSearch(term, -3, "header_quick");
    expect(sentEvents()[0]).toEqual([
      "search",
      {
        search_term: "[redacted]",
        result_count: 0,
        search_surface: "header_quick",
      },
    ]);
    expect(sentMetaEvents()[0]).toEqual(["Search", { search_string: "[redacted]" }, undefined]);
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

  it("reports payment information only as the confirmed COD method", () => {
    trackAddPaymentInfo(cart());
    const [name, params] = sentEvents()[0];
    expect(name).toBe("add_payment_info");
    expect(params.payment_type).toBe(GA_PAYMENT_TYPE);
    expect(params.payment_type).not.toMatch(/bank|transfer/i);
    expect(params.value).toBe(5000000);
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

  it("adds only public product context to direct contact actions", () => {
    const root = document.createElement("main");
    root.dataset.analyticsProductId = "product-1";
    root.dataset.analyticsProductName = "Mũ bảo hiểm";
    root.dataset.analyticsProductBrand = "AGV";
    root.dataset.analyticsProductCategory = "Mũ";
    document.body.append(root);

    trackContactClick("phone", "mobile_purchase_bar");

    expect(sentEvents()).toEqual([
      [
        "contact_click",
        expect.objectContaining({
          contact_channel: "phone",
          placement: "mobile_purchase_bar",
          item_brand: "AGV",
        }),
      ],
    ]);
    expect(JSON.stringify(sentEvents())).not.toMatch(/090|tel:|zalo\.me|email/i);
    expect(sentMetaEvents()).toEqual([["Contact", { content_name: "phone" }, undefined]]);
  });

  it("uses recommended names where GA4 defines them and bounded custom parameters elsewhere", () => {
    trackSelectPromotion({ id: "hero-1", name: "Banner LS2", placement: "homepage_hero" });
    trackAuthentication("login", "google");
    trackCatalogFilter("size", "M, L", 12);
    trackSizeGuideUse("M");
    trackReviewSubmit({ productId: "p1", rating: 5, photoCount: 2 });
    trackVideoOpen({ id: "v1", title: "Giới thiệu", provider: "youtube", placement: "pdp" });
    trackScrollDepth(50, "/product/test/");
    trackContentSection("reviews", "/product/test/");

    expect(sentEvents().map(([name]) => name)).toEqual([
      "select_promotion",
      "login",
      "catalog_filter",
      "size_guide_use",
      "review_submit",
      "video_open",
      "scroll_depth",
      "view_content_section",
    ]);
    expect(sentEvents()[0][1]).toMatchObject({
      promotion_id: "hero-1",
      promotion_name: "Banner LS2",
      creative_slot: "homepage_hero",
    });
    expect(sentEvents()[2][1]).toMatchObject({
      filter_type: "size",
      filter_value: "M, L",
      result_count: 12,
    });
  });

  it("sends internal identity only and consumes a pending social success once", () => {
    window.clarity = vi.fn();
    setAnalyticsUserId("internal-customer-42");
    expect(window.gtag).toHaveBeenCalledWith("set", { user_id: "internal-customer-42" });
    expect(window.clarity).toHaveBeenCalledWith("identify", "internal-customer-42");

    markPendingAuthentication("sign_up", "facebook");
    expect(consumePendingAuthentication()).toMatchObject({
      event: "sign_up",
      method: "facebook",
    });
    expect(consumePendingAuthentication()).toBeNull();

    setAnalyticsUserId();
    expect(window.gtag).toHaveBeenLastCalledWith("set", { user_id: null });
  });
});
