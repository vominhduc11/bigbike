import type { Product } from "@/lib/contracts/public";

export function merchantProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "product-1",
    sku: "E2E_GMC_ITEM",
    slug: "san-pham-kiem-thu",
    name: "Áo bảo hộ kiểm thử",
    description: "<p>Mô tả sản phẩm &amp; chất liệu.</p>",
    image: { url: "/media/uploads/kiem-thu.webp" },
    category: { id: "category-1", slug: "ao-bao-ho", name: "Áo bảo hộ" },
    brand: { id: "brand-1", slug: "kiem-thu", name: "Thương hiệu kiểm thử" },
    publishStatus: "PUBLISHED",
    stockState: "IN_STOCK",
    homepageBlock: "NONE",
    price: { retailPrice: 900000, salePrice: 800000, currency: "VND" },
    createdAt: "2026-09-07T00:00:00Z",
    updatedAt: "2026-09-07T00:00:00Z",
    ...overrides,
  };
}

export function merchantVariants(): Product {
  return merchantProduct({
    variants: [
      {
        id: "variant-blue",
        sku: "E2E_GMC_BLUE_M",
        name: "Xanh / M",
        isAvailable: true,
        stockState: "IN_STOCK",
        options: [
          { name: "Màu sắc", value: "Xanh" },
          { name: "Size", value: "M" },
        ],
        image: { url: "/media/uploads/xanh.webp" },
        price: { retailPrice: 1200000, salePrice: 1100000, currency: "VND" },
      },
      {
        id: "variant-red",
        sku: "E2E_GMC_RED_L",
        name: "Đỏ / L",
        isAvailable: false,
        stockState: "OUT_OF_STOCK",
        options: [
          { name: "Màu sắc", value: "Đỏ" },
          { name: "Size", value: "L" },
        ],
      },
    ],
  });
}
