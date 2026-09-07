package com.bigbike.bigbike_backend.persistence.repository.catalog;

/** Read-only catalog columns needed by commerce analytics; no customer or order data. */
public interface ProductAnalyticsProjection {
    String getProductId();
    String getBrandName();
    String getCategoryName();
}
