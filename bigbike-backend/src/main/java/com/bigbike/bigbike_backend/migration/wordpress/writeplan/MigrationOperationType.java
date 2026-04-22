package com.bigbike.bigbike_backend.migration.wordpress.writeplan;

public enum MigrationOperationType {
    INSERT,
    UPSERT,
    SKIP,
    DEFER
}
