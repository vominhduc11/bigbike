package com.bigbike.bigbike_backend.migration.wordpress.model;

import java.time.LocalDateTime;

public record WpComment(
        long commentId,
        long commentPostId,
        String commentAuthor,
        String commentAuthorEmail,
        String commentContent,
        LocalDateTime commentDateGmt,
        String commentApproved,   // "1"=approved, "0"=pending, "spam", "trash"
        String commentType,       // "review" for WooCommerce product reviews
        long userId               // 0 if guest
) {}
