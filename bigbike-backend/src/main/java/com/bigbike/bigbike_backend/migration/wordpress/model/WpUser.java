package com.bigbike.bigbike_backend.migration.wordpress.model;

import java.time.LocalDateTime;

/** One row from kd_users. */
public record WpUser(
        long id,
        String userLogin,
        String userPass,         // phpass hash — NOT migrated as-is; stored as legacyPasswordHash
        String userNicename,
        String userEmail,
        String userUrl,
        LocalDateTime userRegistered,
        String userStatus,
        String displayName
) {}
