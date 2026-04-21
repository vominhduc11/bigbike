package com.bigbike.bigbike_backend.migration.wordpress.service;

import java.util.List;
import java.util.Map;
import java.util.LinkedHashMap;
import org.springframework.stereotype.Service;

/**
 * Returns the BigBike ↔ WordPress mapping plan for each domain.
 * Phase 2A: read-only plan. No DB writes.
 */
@Service
public class WordPressMappingPlanService {

    public record DomainMapping(
            String domain,
            String sourceTable,
            String targetTable,
            List<FieldMapping> fieldMappings,
            List<String> notes
    ) {}

    public record FieldMapping(
            String sourceField,
            String targetField,
            String transform,   // e.g. "DIRECT", "CAST_DECIMAL", "PHPASS_HASH_PRESERVE", "SERIALIZE_PHP_PARSE"
            boolean required
    ) {}

    public record MappingPlan(Map<String, DomainMapping> domains) {}

    public MappingPlan buildPlan() {
        Map<String, DomainMapping> domains = new LinkedHashMap<>();

        domains.put("products", new DomainMapping(
                "products",
                "kd_posts (post_type=product) + kd_postmeta",
                "products + product_variants + product_specifications + product_gallery_images",
                List.of(
                        new FieldMapping("post_name", "slug", "DIRECT", true),
                        new FieldMapping("post_title", "name", "DIRECT", true),
                        new FieldMapping("post_content", "description", "DIRECT", false),
                        new FieldMapping("post_excerpt", "shortDescription", "DIRECT", false),
                        new FieldMapping("post_status=publish", "status=ACTIVE", "STATUS_MAP", true),
                        new FieldMapping("postmeta._sku", "sku", "DIRECT", false),
                        new FieldMapping("postmeta._price", "price", "CAST_DECIMAL", true),
                        new FieldMapping("postmeta._regular_price", "regularPrice", "CAST_DECIMAL", false),
                        new FieldMapping("postmeta._sale_price", "salePrice", "CAST_DECIMAL", false),
                        new FieldMapping("postmeta._stock", "stockQuantity", "CAST_INT", false),
                        new FieldMapping("postmeta._stock_status", "stockStatus", "STOCK_STATUS_MAP", false),
                        new FieldMapping("postmeta._thumbnail_id", "thumbnailMediaId", "LEGACY_ID_REF", false),
                        new FieldMapping("postmeta._product_image_gallery", "galleryMediaIds", "CSV_LEGACY_IDS", false)
                ),
                List.of(
                        "URL pattern: sp/{post_name}.html (via Permalink Manager Pro)",
                        "product_cat taxonomy → categories join",
                        "pwb-brand taxonomy → brand join (Perfect WooCommerce Brands plugin)",
                        "product_tag taxonomy → tags join",
                        "postmeta rank_math_title / _yoast_wpseo_title → seoTitle",
                        "postmeta rank_math_description / _yoast_wpseo_metadesc → seoDescription",
                        "_yoast_wpseo_primary_product_cat → primaryCategoryId"
                )
        ));

        domains.put("categories", new DomainMapping(
                "categories",
                "kd_terms + kd_term_taxonomy (taxonomy=product_cat)",
                "categories",
                List.of(
                        new FieldMapping("slug", "slug", "DIRECT", true),
                        new FieldMapping("name", "name", "DIRECT", true),
                        new FieldMapping("description", "description", "DIRECT", false),
                        new FieldMapping("parent (termTaxonomyId)", "parentId", "LEGACY_ID_REF", false)
                ),
                List.of("Hierarchical: {slug}.html", "termmeta thumbnail_id → category image")
        ));

        domains.put("brands", new DomainMapping(
                "brands",
                "kd_terms + kd_term_taxonomy (taxonomy=pwb-brand)",
                "brands",
                List.of(
                        new FieldMapping("slug", "slug", "DIRECT", true),
                        new FieldMapping("name", "name", "DIRECT", true),
                        new FieldMapping("description", "description", "DIRECT", false)
                ),
                List.of("Plugin: Perfect WooCommerce Brands (pwb-brand taxonomy)", "URL: brand/{slug}.html")
        ));

        domains.put("media", new DomainMapping(
                "media",
                "kd_posts (post_type=attachment) + kd_postmeta",
                "media",
                List.of(
                        new FieldMapping("postmeta._wp_attached_file", "storagePath", "DIRECT", true),
                        new FieldMapping("postmeta._wp_attachment_image_alt", "altText", "DIRECT", false),
                        new FieldMapping("post_title", "title", "DIRECT", false),
                        new FieldMapping("post_mime_type", "mimeType", "DIRECT", true),
                        new FieldMapping("postmeta._wp_attachment_metadata", "metadata", "SERIALIZE_PHP_PARSE", false)
                ),
                List.of(
                        "wp-content/uploads/{attached_file} → new CDN/storage path",
                        "Phase 2A: no physical file copy; record paths only",
                        "Phase 2E: media copy/sync strategy"
                )
        ));

        domains.put("pages", new DomainMapping(
                "pages",
                "kd_posts (post_type=page)",
                "pages",
                List.of(
                        new FieldMapping("post_name", "slug", "DIRECT", true),
                        new FieldMapping("post_title", "title", "DIRECT", true),
                        new FieldMapping("post_content", "content", "DIRECT", false),
                        new FieldMapping("post_status=publish", "status=PUBLISHED", "STATUS_MAP", true),
                        new FieldMapping("post_date_gmt", "publishedAt", "UTC_DATETIME", false)
                ),
                List.of("URL pattern: {post_name}.html", "Permalink Manager Pro prefix override applies")
        ));

        domains.put("articles", new DomainMapping(
                "articles",
                "kd_posts (post_type=post)",
                "articles",
                List.of(
                        new FieldMapping("post_name", "slug", "DIRECT", true),
                        new FieldMapping("post_title", "title", "DIRECT", true),
                        new FieldMapping("post_content", "content", "DIRECT", false),
                        new FieldMapping("post_excerpt", "excerpt", "DIRECT", false),
                        new FieldMapping("post_status=publish", "status=PUBLISHED", "STATUS_MAP", true),
                        new FieldMapping("post_date_gmt", "publishedAt", "UTC_DATETIME", false)
                ),
                List.of("URL pattern: tin-tuc/{post_name}.html", "Taxonomy category → contentCategory")
        ));

        domains.put("redirects", new DomainMapping(
                "redirects",
                "kd_rank_math_redirections (40 rows, status=active) + docs/legacy/SEO_REDIRECT_MAP.csv",
                "redirects",
                List.of(
                        new FieldMapping("sources[0].pattern", "sourcePattern", "RANKMATH_JSON_PARSE", true),
                        new FieldMapping("url_to", "targetPattern", "DIRECT", true),
                        new FieldMapping("header_code", "redirectType", "CAST_INT", true),
                        new FieldMapping("status=active", "enabled=true", "STATUS_MAP", true)
                ),
                List.of(
                        "RankMath sources field is serialized JSON array",
                        "kd_fg_redirect: legacy plugin table, lower priority",
                        "docs/legacy/SEO_REDIRECT_MAP.csv: currently empty (header only)",
                        "Polylang vi/ and en/ prefixes already redirect to canonical"
                )
        ));

        domains.put("menus", new DomainMapping(
                "menus",
                "kd_terms (taxonomy=nav_menu) + kd_posts (post_type=nav_menu_item) + kd_postmeta",
                "menus + menu_items",
                List.of(
                        new FieldMapping("term.name", "menu.name", "DIRECT", true),
                        new FieldMapping("term.slug", "menu.location", "DIRECT", true),
                        new FieldMapping("postmeta._menu_item_url", "item.url", "DIRECT", true),
                        new FieldMapping("postmeta._menu_item_title", "item.label", "FALLBACK_POST_TITLE", true),
                        new FieldMapping("menu_order", "item.sortOrder", "DIRECT", true),
                        new FieldMapping("postmeta._menu_item_menu_item_parent", "item.parentId", "LEGACY_ID_REF", false),
                        new FieldMapping("postmeta._menu_item_target", "item.openInNewTab", "TARGET_BLANK_MAP", false),
                        new FieldMapping("postmeta._menu_item_classes", "item.cssClass", "SERIALIZE_PHP_PARSE", false)
                ),
                List.of("nav_menu items linked via kd_term_relationships")
        ));

        domains.put("customers", new DomainMapping(
                "customers",
                "kd_users + kd_usermeta (billing_* / shipping_*)",
                "customers + customer_addresses",
                List.of(
                        new FieldMapping("user_email", "email", "DIRECT", true),
                        new FieldMapping("user_pass", "legacyPasswordHash", "PHPASS_HASH_PRESERVE", false),
                        new FieldMapping("display_name", "displayName", "DIRECT", false),
                        new FieldMapping("user_registered", "createdAt", "UTC_DATETIME", true),
                        new FieldMapping("usermeta.billing_first_name", "address.firstName", "DIRECT", false),
                        new FieldMapping("usermeta.billing_last_name", "address.lastName", "DIRECT", false),
                        new FieldMapping("usermeta.billing_phone", "phone", "DIRECT", false),
                        new FieldMapping("usermeta.billing_address_1", "address.line1", "DIRECT", false),
                        new FieldMapping("usermeta.billing_city", "address.city", "DIRECT", false)
                ),
                List.of(
                        "phpass hashes stored in legacyPasswordHash for backward-compat login",
                        "isSynthetic=true if order has billing data but no kd_users row (guest orders)",
                        "Exclude wp_capabilities=administrator/editor"
                )
        ));

        domains.put("orders", new DomainMapping(
                "orders",
                "kd_posts (post_type=shop_order) + kd_postmeta + kd_woocommerce_order_items + kd_woocommerce_order_itemmeta",
                "orders + order_line_items + order_addresses + order_shipping_items + order_applied_coupons",
                List.of(
                        new FieldMapping("post_name (order number)", "orderNumber", "WC_ORDER_NUMBER", true),
                        new FieldMapping("post_status", "status", "WC_STATUS_MAP", true),
                        new FieldMapping("postmeta._order_total", "totalAmount", "CAST_DECIMAL", true),
                        new FieldMapping("postmeta._order_currency", "currency", "DIRECT", false),
                        new FieldMapping("postmeta._payment_method", "paymentMethod", "DIRECT", false),
                        new FieldMapping("postmeta._billing_*", "orderAddress(BILLING)", "BILLING_MAP", false),
                        new FieldMapping("postmeta._shipping_*", "orderAddress(SHIPPING)", "SHIPPING_MAP", false),
                        new FieldMapping("postmeta._customer_user", "customerId", "LEGACY_ID_REF", false),
                        new FieldMapping("order_items (line_item)", "orderLineItems", "WC_LINE_ITEM_MAP", false),
                        new FieldMapping("order_items (shipping)", "orderShippingItems", "WC_SHIPPING_MAP", false),
                        new FieldMapping("order_items (coupon)", "orderAppliedCoupons", "WC_COUPON_MAP", false)
                ),
                List.of(
                        "HPOS is OFF — source of truth is kd_posts legacy mode",
                        "kd_wc_orders table exists but is empty (HPOS never enabled)",
                        "WC status map: wc-pending→PENDING_PAYMENT, wc-processing→PROCESSING, wc-completed→COMPLETED, wc-cancelled→CANCELLED, wc-refunded→REFUNDED",
                        "Order number = postmeta._order_number or post_id if not set"
                )
        ));

        domains.put("coupons", new DomainMapping(
                "coupons",
                "kd_posts (post_type=shop_coupon) + kd_postmeta",
                "coupons",
                List.of(
                        new FieldMapping("post_title", "code", "UPPERCASE", true),
                        new FieldMapping("post_excerpt", "description", "DIRECT", false),
                        new FieldMapping("postmeta.discount_type", "discountType", "WC_COUPON_TYPE_MAP", true),
                        new FieldMapping("postmeta.coupon_amount", "amount", "CAST_DECIMAL", true),
                        new FieldMapping("postmeta.minimum_amount", "minimumAmount", "CAST_DECIMAL", false),
                        new FieldMapping("postmeta.maximum_amount", "maximumAmount", "CAST_DECIMAL", false),
                        new FieldMapping("postmeta.usage_limit", "usageLimit", "CAST_INT", false),
                        new FieldMapping("postmeta.usage_count", "usageCount", "CAST_INT", false),
                        new FieldMapping("postmeta.date_expires", "expiresAt", "UNIX_TIMESTAMP", false),
                        new FieldMapping("post_status=publish", "status=ACTIVE", "STATUS_MAP", true)
                ),
                List.of(
                        "WC discount_type: percent→PERCENT, fixed_cart→FIXED, fixed_product→FIXED",
                        "post_status=trash → status=ARCHIVED"
                )
        ));

        domains.put("settings", new DomainMapping(
                "settings",
                "kd_options (safe keys only)",
                "site_settings",
                List.of(
                        new FieldMapping("blogname", "site.name", "DIRECT", false),
                        new FieldMapping("blogdescription", "site.description", "DIRECT", false),
                        new FieldMapping("admin_email", "site.adminEmail", "DIRECT", false),
                        new FieldMapping("woocommerce_currency", "commerce.currency", "DIRECT", false),
                        new FieldMapping("woocommerce_weight_unit", "commerce.weightUnit", "DIRECT", false)
                ),
                List.of(
                        "Exclude: DB credentials, secret keys, auth keys, salts",
                        "Exclude: any option_name containing secret/password/key/token/salt",
                        "Safe keys whitelist approach recommended"
                )
        ));

        return new MappingPlan(domains);
    }

    public boolean containsDomain(MappingPlan plan, String domain) {
        return plan.domains().containsKey(domain);
    }
}
