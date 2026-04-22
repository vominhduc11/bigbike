package com.bigbike.bigbike_backend.migration.wordpress.model;

/**
 * Represents one redirect from kd_rank_math_redirections.
 * sources is a JSON-serialized array of source patterns from RankMath.
 */
public record WpRedirectRow(
        long id,
        String sources,       // raw JSON/serialized from RankMath
        String urlTo,
        int headerCode,       // 301, 302, 307, 410, 451
        String status,        // active, inactive
        String sourcePattern  // parsed from sources for first entry
) {}
