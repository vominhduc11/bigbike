package com.bigbike.bigbike_backend.migration.wordpress.model;

public record WpCommentMeta(
        long metaId,
        long commentId,
        String metaKey,
        String metaValue
) {}
