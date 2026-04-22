package com.bigbike.bigbike_backend.migration.wordpress.model;

/**
 * One row from kd_fg_redirect (FG Redirect plugin).
 *
 * Actual schema from dump CREATE TABLE:
 *   old_url varchar(191) NOT NULL  — source slug/path (e.g. "some-product.html")
 *   id      bigint       NOT NULL  — WordPress post ID of the redirect target
 *   type    varchar(20)  NOT NULL  — always "product" in this dataset
 *   activated tinyint(1) NOT NULL  — 1 = enabled
 *
 * There is NO stored target URL — it is derived at import time by looking up the
 * product with legacyId=id and building "/product/{slug}".
 */
public record WpFgRedirect(String oldUrl, long targetPostId, String type, boolean activated) {}
