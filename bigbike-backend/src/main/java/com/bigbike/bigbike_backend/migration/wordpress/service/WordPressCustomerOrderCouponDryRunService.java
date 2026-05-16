package com.bigbike.bigbike_backend.migration.wordpress.service;

import com.bigbike.bigbike_backend.migration.wordpress.mapper.WordPressCouponMapper;
import com.bigbike.bigbike_backend.migration.wordpress.mapper.WordPressCustomerMapper;
import com.bigbike.bigbike_backend.migration.wordpress.mapper.WordPressOrderMapper;
import com.bigbike.bigbike_backend.migration.wordpress.model.WpOrderItem;
import com.bigbike.bigbike_backend.migration.wordpress.model.WpOrderItemMeta;
import com.bigbike.bigbike_backend.migration.wordpress.model.WpPost;
import com.bigbike.bigbike_backend.migration.wordpress.model.WpPostMeta;
import com.bigbike.bigbike_backend.migration.wordpress.model.WpUser;
import com.bigbike.bigbike_backend.migration.wordpress.model.WpUserMeta;
import com.bigbike.bigbike_backend.migration.wordpress.parser.WordPressSqlDumpRowReader;
import com.bigbike.bigbike_backend.migration.wordpress.parser.WordPressTableRow;
import com.bigbike.bigbike_backend.migration.wordpress.report.CustomerOrderCouponDryRunResult;
import java.io.IOException;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * Phase 2C — Customer / Order / Coupon dry-run import.
 *
 * Safety guarantees:
 *   - NEVER writes to the application database.
 *   - Only reads the SQL dump file via streaming.
 *   - Not wired to any application startup event.
 */
@Service
@RequiredArgsConstructor
public class WordPressCustomerOrderCouponDryRunService {

    private static final Set<String> TARGET_TABLES = Set.of(
            "kd_users", "kd_usermeta",
            "kd_posts", "kd_postmeta",
            "kd_woocommerce_order_items", "kd_woocommerce_order_itemmeta"
    );

    private static final DateTimeFormatter WP_DATETIME =
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private static final String TABLE_PREFIX = "kd_";

    private final WordPressSqlDumpRowReader rowReader;
    private final WordPressCustomerMapper customerMapper;
    private final WordPressOrderMapper orderMapper;
    private final WordPressCouponMapper couponMapper;

    /**
     * Streams the dump once and produces a dry-run count report.
     * Never writes to the application database.
     */
    public CustomerOrderCouponDryRunResult run(Path dumpPath) throws IOException {

        // ── 1. Stream dump, accumulate raw rows ──────────────────────────────
        List<WpUser>    allUsers    = new ArrayList<>();
        Map<Long, List<WpUserMeta>> metaByUser = new HashMap<>();
        List<WpPost>    orderPosts  = new ArrayList<>();
        List<WpPost>    couponPosts = new ArrayList<>();
        Map<Long, List<WpPostMeta>> metaByPost = new HashMap<>();
        Map<Long, List<WpOrderItem>>     itemsByOrder = new HashMap<>();
        Map<Long, List<WpOrderItemMeta>> metaByItem   = new HashMap<>();

        List<String> streamingWarnings = rowReader.stream(dumpPath, TARGET_TABLES,
                (tableName, row) -> {
                    switch (tableName) {
                        case "kd_users" -> {
                            WpUser u = toWpUser(row);
                            if (u != null) allUsers.add(u);
                        }
                        case "kd_usermeta" -> {
                            WpUserMeta m = toWpUserMeta(row);
                            if (m != null) metaByUser.computeIfAbsent(m.userId(), k -> new ArrayList<>()).add(m);
                        }
                        case "kd_posts" -> {
                            String type = row.get("post_type");
                            if ("shop_order".equals(type) || "shop_coupon".equals(type)) {
                                WpPost p = toWpPost(row);
                                if (p != null) {
                                    if ("shop_order".equals(type)) orderPosts.add(p);
                                    else couponPosts.add(p);
                                }
                            }
                        }
                        case "kd_postmeta" -> {
                            WpPostMeta m = toWpPostMeta(row);
                            if (m != null) metaByPost.computeIfAbsent(m.postId(), k -> new ArrayList<>()).add(m);
                        }
                        case "kd_woocommerce_order_items" -> {
                            WpOrderItem i = toWpOrderItem(row);
                            if (i != null) itemsByOrder.computeIfAbsent(i.orderId(), k -> new ArrayList<>()).add(i);
                        }
                        case "kd_woocommerce_order_itemmeta" -> {
                            WpOrderItemMeta m = toWpOrderItemMeta(row);
                            if (m != null) metaByItem.computeIfAbsent(m.orderItemId(), k -> new ArrayList<>()).add(m);
                        }
                    }
                });

        // ── 2. Map customers ─────────────────────────────────────────────────
        List<String> customerWarnings = new ArrayList<>();
        int wpExcluded = 0, wpMapped = 0, wpSkipped = 0;
        int customerAddresses = 0;
        Map<String, Long> seenEmails  = new LinkedHashMap<>();
        Map<String, Long> seenPhones  = new LinkedHashMap<>();
        List<WordPressCustomerMapper.MappedCustomer> mappedCustomers = new ArrayList<>();

        for (WpUser user : allUsers) {
            List<WpUserMeta> userMetas = metaByUser.getOrDefault(user.id(), List.of());
            WordPressCustomerMapper.MappedCustomer mc =
                    customerMapper.map(user, userMetas, TABLE_PREFIX);
            if (mc == null) {
                wpExcluded++;
                continue;
            }
            // Email dedup
            if (mc.email() != null && !mc.email().isBlank()) {
                String normalEmail = mc.email().toLowerCase().trim();
                if (seenEmails.containsKey(normalEmail)) {
                    customerWarnings.add("Duplicate email " + mc.email()
                            + " for user id=" + user.id()
                            + " (first seen for id=" + seenEmails.get(normalEmail) + ")");
                } else {
                    seenEmails.put(normalEmail, user.id());
                }
            }
            // Phone dedup
            if (mc.phone() != null && !mc.phone().isBlank()) {
                String normalPhone = mc.phone().replaceAll("[^0-9]", "");
                if (!normalPhone.isEmpty()) {
                    if (seenPhones.containsKey(normalPhone)) {
                        customerWarnings.add("Duplicate phone " + mc.phone()
                                + " for user id=" + user.id()
                                + " (first seen for id=" + seenPhones.get(normalPhone) + ")");
                    } else {
                        seenPhones.put(normalPhone, user.id());
                    }
                }
            }
            customerWarnings.addAll(mc.warnings());
            mappedCustomers.add(mc);
            wpMapped++;

            // Count addresses (billing and/or shipping)
            boolean hasBilling  = mc.billingAddress1() != null && !mc.billingAddress1().isBlank();
            boolean hasShipping = mc.shippingAddress1() != null && !mc.shippingAddress1().isBlank();
            if (hasBilling)  customerAddresses++;
            if (hasShipping) customerAddresses++;
        }
        wpSkipped = allUsers.size() - wpExcluded - wpMapped;
        if (wpSkipped < 0) wpSkipped = 0;

        // ── 3. Map orders + synthetic customers ──────────────────────────────
        List<String> orderWarnings    = new ArrayList<>();
        List<String> orderItemWarnings = new ArrayList<>();
        List<String> paymentWarnings  = new ArrayList<>();
        int ordersMapped = 0, ordersSkipped = 0;
        int liSource = 0, liMapped = 0, liSkipped = 0;
        int siSource = 0, siMapped = 0;
        int fiSource = 0, fiMapped = 0;
        int ciSource = 0, ciMapped = 0;
        int taxSource = 0, taxDeferred = 0;
        int paymentsMapped = 0;

        Map<String, String> seenOrderNumbers = new LinkedHashMap<>();
        Map<String, WordPressCustomerMapper.MappedCustomer> syntheticsByKey = new LinkedHashMap<>();
        int syntheticSkipped = 0;

        for (WpPost orderPost : orderPosts) {
            List<WpPostMeta>  postMetas = metaByPost.getOrDefault(orderPost.id(), List.of());
            List<WpOrderItem> orderItems = itemsByOrder.getOrDefault(orderPost.id(), List.of());

            WordPressOrderMapper.MappedOrder mo =
                    orderMapper.map(orderPost, postMetas, orderItems, metaByItem);

            orderWarnings.addAll(mo.warnings());

            // Duplicate order number check
            if (seenOrderNumbers.containsKey(mo.orderNumber())) {
                orderWarnings.add("Duplicate order number " + mo.orderNumber()
                        + " for order id=" + orderPost.id()
                        + " (first seen for id=" + seenOrderNumbers.get(mo.orderNumber()) + ")");
            } else {
                seenOrderNumbers.put(mo.orderNumber(), String.valueOf(orderPost.id()));
            }

            ordersMapped++;

            // Synthetic guest customers
            if (mo.customerWpUserId() == null && mo.syntheticCustomerKey() != null) {
                if (!syntheticsByKey.containsKey(mo.syntheticCustomerKey())) {
                    WordPressCustomerMapper.MappedCustomer synth =
                            customerMapper.mapSynthetic(orderPost.id(),
                                    postMetas.stream()
                                            .filter(m -> m.metaKey() != null)
                                            .collect(java.util.stream.Collectors.toMap(
                                                    WpPostMeta::metaKey,
                                                    m -> m.metaValue() != null ? m.metaValue() : "",
                                                    (a, b) -> a)));
                    syntheticsByKey.put(mo.syntheticCustomerKey(), synth);
                }
            } else if (mo.customerWpUserId() == null && mo.syntheticCustomerKey() == null) {
                customerWarnings.add("Guest order id=" + orderPost.id()
                        + " has no billing email or phone — cannot create synthetic customer");
                syntheticSkipped++;
            }

            // Item counts
            liSource += mo.lineItemsDetailed().size();
            liMapped += mo.lineItemsDetailed().size();
            for (var li : mo.lineItemsDetailed()) orderItemWarnings.addAll(li.warnings());

            siSource += mo.shippingItems().size();
            siMapped += mo.shippingItems().size();
            for (var si : mo.shippingItems()) orderItemWarnings.addAll(si.warnings());

            fiSource += mo.feeItems().size();
            fiMapped += mo.feeItems().size();
            for (var fi : mo.feeItems()) orderItemWarnings.addAll(fi.warnings());

            ciSource += mo.couponItems().size();
            ciMapped += mo.couponItems().size();
            for (var ci : mo.couponItems()) orderItemWarnings.addAll(ci.warnings());

            taxSource += mo.taxItemsDeferred();
            taxDeferred += mo.taxItemsDeferred();

            paymentsMapped++;
        }

        // ── 4. Map coupons ────────────────────────────────────────────────────
        List<String> couponWarnings = new ArrayList<>();
        int couponsMapped = 0, couponsSkipped = 0;
        Set<String> seenCouponCodes = new HashSet<>();

        for (WpPost couponPost : couponPosts) {
            List<WpPostMeta> postMetas = metaByPost.getOrDefault(couponPost.id(), List.of());
            WordPressCouponMapper.MappedCoupon mc = couponMapper.map(couponPost, postMetas);

            couponWarnings.addAll(mc.warnings());

            if (!mc.code().isEmpty() && !seenCouponCodes.add(mc.code())) {
                couponWarnings.add("Duplicate coupon code: " + mc.code()
                        + " for id=" + couponPost.id());
            }

            if (!mc.warnings().stream().anyMatch(w -> w.contains("Unknown discount_type"))) {
                couponsMapped++;
            } else {
                couponsSkipped++;
            }
        }

        // ── 5. Assemble result ────────────────────────────────────────────────
        int syntheticMapped = syntheticsByKey.size();
        int syntheticSource = syntheticMapped + syntheticSkipped;

        return CustomerOrderCouponDryRunResult.builder(dumpPath)
                .wpUsers(allUsers.size(), wpExcluded, wpMapped, wpSkipped)
                .customers(wpMapped, customerAddresses)
                .syntheticCustomers(syntheticSource, syntheticMapped, syntheticSkipped)
                .orders(orderPosts.size(), ordersMapped, ordersSkipped)
                .lineItems(liSource, liMapped, liSkipped)
                .shippingItems(siSource, siMapped, 0)
                .feeItems(fiSource, fiMapped, 0)
                .couponItems(ciSource, ciMapped, 0)
                .taxItems(taxSource, taxDeferred)
                .payments(paymentsMapped)
                .coupons(couponPosts.size(), couponsMapped, couponsSkipped)
                .customerWarnings(customerWarnings)
                .orderWarnings(orderWarnings)
                .orderItemWarnings(orderItemWarnings)
                .paymentWarnings(paymentWarnings)
                .couponWarnings(couponWarnings)
                .streamingWarnings(streamingWarnings)
                .build();
    }

    // ── Row converters ────────────────────────────────────────────────────────

    private WpUser toWpUser(WordPressTableRow row) {
        try {
            return new WpUser(
                    row.getLong("ID", 0),
                    nvl(row.get("user_login")),
                    nvl(row.get("user_pass")),
                    nvl(row.get("user_nicename")),
                    nvl(row.get("user_email")),
                    nvl(row.get("user_url")),
                    parseDateTime(row.get("user_registered")),
                    nvl(row.get("user_status")),
                    nvl(row.get("display_name"))
            );
        } catch (Exception e) { return null; }
    }

    private WpUserMeta toWpUserMeta(WordPressTableRow row) {
        try {
            return new WpUserMeta(
                    row.getLong("umeta_id", 0),
                    row.getLong("user_id", 0),
                    row.get("meta_key"),
                    row.get("meta_value")
            );
        } catch (Exception e) { return null; }
    }

    private WpPost toWpPost(WordPressTableRow row) {
        try {
            return new WpPost(
                    row.getLong("ID", 0),
                    row.getLong("post_author", 0),
                    parseDateTime(row.get("post_date")),
                    parseDateTime(row.get("post_date_gmt")),
                    nvl(row.get("post_content")),
                    nvl(row.get("post_title")),
                    nvl(row.get("post_excerpt")),
                    nvl(row.get("post_status")),
                    nvl(row.get("comment_status")),
                    nvl(row.get("post_name")),
                    nvl(row.get("post_type")),
                    row.getLong("post_parent", 0),
                    row.getInt("menu_order", 0),
                    nvl(row.get("guid")),
                    nvl(row.get("post_mime_type")),
                    row.getLong("comment_count", 0)
            );
        } catch (Exception e) { return null; }
    }

    private WpPostMeta toWpPostMeta(WordPressTableRow row) {
        try {
            return new WpPostMeta(
                    row.getLong("meta_id", 0),
                    row.getLong("post_id", 0),
                    row.get("meta_key"),
                    row.get("meta_value")
            );
        } catch (Exception e) { return null; }
    }

    private WpOrderItem toWpOrderItem(WordPressTableRow row) {
        try {
            return new WpOrderItem(
                    row.getLong("order_item_id", 0),
                    nvl(row.get("order_item_name")),
                    nvl(row.get("order_item_type")),
                    row.getLong("order_id", 0)
            );
        } catch (Exception e) { return null; }
    }

    private WpOrderItemMeta toWpOrderItemMeta(WordPressTableRow row) {
        try {
            return new WpOrderItemMeta(
                    row.getLong("meta_id", 0),
                    row.getLong("order_item_id", 0),
                    row.get("meta_key"),
                    row.get("meta_value")
            );
        } catch (Exception e) { return null; }
    }

    private LocalDateTime parseDateTime(String value) {
        if (value == null || value.isBlank() || value.startsWith("0000")) {
            return LocalDateTime.of(1970, 1, 1, 0, 0);
        }
        try { return LocalDateTime.parse(value, WP_DATETIME); }
        catch (DateTimeParseException e) { return LocalDateTime.of(1970, 1, 1, 0, 0); }
    }

    private String nvl(String value) { return value != null ? value : ""; }
}
