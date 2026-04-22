package com.bigbike.bigbike_backend.migration.wordpress.model;

import java.time.LocalDateTime;

/**
 * Represents one row from the WordPress kd_posts table.
 * post_type values relevant to BigBike: product, shop_order, shop_coupon,
 * attachment, post, page, nav_menu_item.
 */
public record WpPost(
        long id,
        long authorId,
        LocalDateTime postDate,
        LocalDateTime postDateGmt,
        String postContent,
        String postTitle,
        String postExcerpt,
        String postStatus,       // publish, draft, trash, auto-draft, inherit
        String commentStatus,
        String postName,         // slug
        String postType,         // product, shop_order, attachment, post, page, nav_menu_item, shop_coupon
        long postParent,
        int menuOrder,
        String guid,
        String postMimeType,
        long commentCount
) {}
