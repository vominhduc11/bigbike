package com.bigbike.bigbike_backend.migration.wordpress.model;

/** One row from kd_woocommerce_order_items. */
public record WpOrderItem(
        long orderItemId,
        String orderItemName,
        String orderItemType,  // line_item, shipping, fee, coupon, tax
        long orderId
) {}
