package com.bigbike.bigbike_backend.migration.wordpress.writeplan;

public enum MigrationDomain {
    CATEGORIES,
    BRANDS,
    MEDIA,
    PAGES,
    ARTICLES,
    REDIRECTS,
    MENUS,
    MENU_ITEMS,
    PRODUCTS,
    PRODUCT_VARIATIONS,
    CUSTOMERS,
    ADMIN_USERS,
    CUSTOMER_ADDRESSES,
    SYNTHETIC_CUSTOMERS,
    COUPONS,
    ORDERS,
    ORDER_LINE_ITEMS,
    ORDER_SHIPPING_ITEMS,
    ORDER_FEE_ITEMS,
    ORDER_APPLIED_COUPONS,
    ORDER_ADDRESSES,
    PAYMENTS,
    // Deferred — no target schema in Phase 2D
    PRODUCT_TAGS,
    FG_REDIRECTS
}
