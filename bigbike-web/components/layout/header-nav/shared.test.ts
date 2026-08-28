import { describe, expect, it } from "vitest";

import {
  isNodeActive,
  isNodeCurrent,
  type HeaderNavNode,
} from "@/components/layout/header-nav/shared";

const productChild: HeaderNavNode = {
  id: "helmets",
  parentId: "products",
  label: "Mũ bảo hiểm",
  url: "/sp/mu-bao-hiem/",
  sortOrder: 1,
  openInNewTab: false,
  cssClass: null,
  children: [],
};

const products: HeaderNavNode = {
  id: "products",
  parentId: null,
  label: "Tất cả sản phẩm",
  url: "/sp/",
  sortOrder: 1,
  openInNewTab: false,
  cssClass: null,
  children: [productChild],
};

describe("header navigation active state", () => {
  it("keeps a parent visually active on a descendant without marking it as the current page", () => {
    expect(isNodeActive("/sp/mu-bao-hiem/", products, "vi")).toBe(true);
    expect(isNodeCurrent("/sp/mu-bao-hiem/", products, "vi")).toBe(false);
    expect(isNodeCurrent("/sp/mu-bao-hiem/", productChild, "vi")).toBe(true);
  });

  it("treats equivalent trailing-slash forms as the exact current page", () => {
    expect(isNodeCurrent("/sp", products, "vi")).toBe(true);
  });
});
