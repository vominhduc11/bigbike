package com.bigbike.bigbike_backend.migration.wordpress.model;

/** One row from kd_woocommerce_order_itemmeta. */
public record WpOrderItemMeta(long metaId, long orderItemId, String metaKey, String metaValue) {}
