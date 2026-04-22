package com.bigbike.bigbike_backend.migration.wordpress.model;

/**
 * One row from kd_usermeta.
 * Relevant keys: billing_first_name, billing_last_name, billing_email,
 * billing_phone, billing_address_1, billing_city, billing_state,
 * shipping_first_name, shipping_last_name, shipping_address_1,
 * shipping_city, shipping_state.
 */
public record WpUserMeta(long umetaId, long userId, String metaKey, String metaValue) {}
