package com.bigbike.bigbike_backend.migration.wordpress.model;

/**
 * One row from kd_postmeta.
 * Key examples for products: _sku, _price, _regular_price, _sale_price,
 * _stock, _stock_status, _thumbnail_id, _product_image_gallery.
 * Key examples for orders: _billing_first_name, _billing_email, _order_total,
 * _payment_method, _customer_user.
 */
public record WpPostMeta(long metaId, long postId, String metaKey, String metaValue) {}
