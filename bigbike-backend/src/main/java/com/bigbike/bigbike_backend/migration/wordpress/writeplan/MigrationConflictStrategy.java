package com.bigbike.bigbike_backend.migration.wordpress.writeplan;

public enum MigrationConflictStrategy {
    UPSERT_BY_LEGACY_ID,
    UPSERT_BY_SLUG,
    UPSERT_BY_CODE,
    UPSERT_BY_LOCATION,
    UPSERT_BY_SOURCE_PATTERN,
    UPSERT_BY_ORDER_NUMBER,
    SKIP_IF_EXISTS,
    DEFER_UNSUPPORTED,
    FAIL_ON_CONFLICT
}
