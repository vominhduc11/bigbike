package com.bigbike.bigbike_backend.migration.wordpress.importer;

import com.bigbike.bigbike_backend.migration.wordpress.mapper.WordPressArticleMapper;
import com.bigbike.bigbike_backend.migration.wordpress.mapper.WordPressBrandMapper;
import com.bigbike.bigbike_backend.migration.wordpress.mapper.WordPressCategoryMapper;
import com.bigbike.bigbike_backend.migration.wordpress.mapper.WordPressCouponMapper;
import com.bigbike.bigbike_backend.migration.wordpress.mapper.WordPressCustomerMapper;
import com.bigbike.bigbike_backend.migration.wordpress.mapper.WordPressMediaMapper;
import com.bigbike.bigbike_backend.migration.wordpress.mapper.WordPressMenuMapper;
import com.bigbike.bigbike_backend.migration.wordpress.mapper.WordPressOrderMapper;
import com.bigbike.bigbike_backend.migration.wordpress.mapper.WordPressPageMapper;
import com.bigbike.bigbike_backend.migration.wordpress.mapper.WordPressProductMapper;
import com.bigbike.bigbike_backend.migration.wordpress.mapper.WordPressRedirectMapper;
import com.bigbike.bigbike_backend.migration.wordpress.mapper.WordPressVariationMapper;
import com.bigbike.bigbike_backend.migration.wordpress.model.WpAttachmentMeta;
import com.bigbike.bigbike_backend.migration.wordpress.model.WpFgRedirect;
import com.bigbike.bigbike_backend.migration.wordpress.model.WpOrderItem;
import com.bigbike.bigbike_backend.migration.wordpress.model.WpOrderItemMeta;
import com.bigbike.bigbike_backend.migration.wordpress.model.WpPost;
import com.bigbike.bigbike_backend.migration.wordpress.model.WpPostMeta;
import com.bigbike.bigbike_backend.migration.wordpress.model.WpRedirectRow;
import com.bigbike.bigbike_backend.migration.wordpress.model.WpTerm;
import com.bigbike.bigbike_backend.migration.wordpress.model.WpTermRelationship;
import com.bigbike.bigbike_backend.migration.wordpress.model.WpTermTaxonomy;
import com.bigbike.bigbike_backend.migration.wordpress.model.WpUser;
import com.bigbike.bigbike_backend.migration.wordpress.model.WpUserMeta;
import com.bigbike.bigbike_backend.migration.wordpress.parser.WordPressSqlDumpRowReader;
import com.bigbike.bigbike_backend.migration.wordpress.parser.WordPressTableRow;
import com.bigbike.bigbike_backend.migration.wordpress.writeplan.MigrationDomain;
import java.io.IOException;
import java.nio.file.Path;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Orchestrates the Phase 2D idempotent real import.
 *
 * Safety guarantees:
 *   - Only writes to the DB when options.dryRun() == false.
 *   - Never auto-runs on startup.
 *   - Requires explicit confirmation flags in the runner.
 *   - All writes are idempotent: re-running produces the same result.
 */
@Service
public class WordPressMigrationImportService {

    private static final Logger log = LoggerFactory.getLogger(WordPressMigrationImportService.class);

    private static final Set<String> CATALOG_TABLES = Set.of(
            "kd_posts", "kd_postmeta",
            "kd_terms", "kd_term_taxonomy", "kd_term_relationships",
            "kd_rank_math_redirections", "kd_fg_redirect"
    );
    private static final Set<String> COMMERCE_TABLES = Set.of(
            "kd_users", "kd_usermeta",
            "kd_posts", "kd_postmeta",
            "kd_woocommerce_order_items", "kd_woocommerce_order_itemmeta"
    );
    private static final Set<String> ALL_TABLES;
    static {
        Set<String> all = new LinkedHashSet<>(CATALOG_TABLES);
        all.addAll(COMMERCE_TABLES);
        ALL_TABLES = Set.copyOf(all);
    }

    private static final DateTimeFormatter WP_DATETIME =
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private static final String TABLE_PREFIX = "kd_";

    private final WordPressSqlDumpRowReader rowReader;
    private final WordPressProductMapper productMapper;
    private final WordPressVariationMapper variationMapper;
    private final WordPressCategoryMapper categoryMapper;
    private final WordPressBrandMapper brandMapper;
    private final WordPressMediaMapper mediaMapper;
    private final WordPressPageMapper pageMapper;
    private final WordPressArticleMapper articleMapper;
    private final WordPressMenuMapper menuMapper;
    private final WordPressRedirectMapper redirectMapper;
    private final WordPressCustomerMapper customerMapper;
    private final WordPressOrderMapper orderMapper;
    private final WordPressCouponMapper couponMapper;

    private final CategoryImporter categoryImporter;
    private final BrandImporter brandImporter;
    private final MediaImporter mediaImporter;
    private final PageImporter pageImporter;
    private final ArticleImporter articleImporter;
    private final RedirectImporter redirectImporter;
    private final MenuImporter menuImporter;
    private final ProductImporter productImporter;
    private final CustomerImporter customerImporter;
    private final CouponImporter couponImporter;
    private final OrderImporter orderImporter;

    public WordPressMigrationImportService(
            WordPressSqlDumpRowReader rowReader,
            WordPressProductMapper productMapper,
            WordPressVariationMapper variationMapper,
            WordPressCategoryMapper categoryMapper,
            WordPressBrandMapper brandMapper,
            WordPressMediaMapper mediaMapper,
            WordPressPageMapper pageMapper,
            WordPressArticleMapper articleMapper,
            WordPressMenuMapper menuMapper,
            WordPressRedirectMapper redirectMapper,
            WordPressCustomerMapper customerMapper,
            WordPressOrderMapper orderMapper,
            WordPressCouponMapper couponMapper,
            CategoryImporter categoryImporter,
            BrandImporter brandImporter,
            MediaImporter mediaImporter,
            PageImporter pageImporter,
            ArticleImporter articleImporter,
            RedirectImporter redirectImporter,
            MenuImporter menuImporter,
            ProductImporter productImporter,
            CustomerImporter customerImporter,
            CouponImporter couponImporter,
            OrderImporter orderImporter) {
        this.rowReader = rowReader;
        this.productMapper = productMapper;
        this.variationMapper = variationMapper;
        this.categoryMapper = categoryMapper;
        this.brandMapper = brandMapper;
        this.mediaMapper = mediaMapper;
        this.pageMapper = pageMapper;
        this.articleMapper = articleMapper;
        this.menuMapper = menuMapper;
        this.redirectMapper = redirectMapper;
        this.customerMapper = customerMapper;
        this.orderMapper = orderMapper;
        this.couponMapper = couponMapper;
        this.categoryImporter = categoryImporter;
        this.brandImporter = brandImporter;
        this.mediaImporter = mediaImporter;
        this.pageImporter = pageImporter;
        this.articleImporter = articleImporter;
        this.redirectImporter = redirectImporter;
        this.menuImporter = menuImporter;
        this.productImporter = productImporter;
        this.customerImporter = customerImporter;
        this.couponImporter = couponImporter;
        this.orderImporter = orderImporter;
    }

    /**
     * Runs the full import against the dump file.
     * When options.dryRun() == true, maps and validates without writing to DB.
     * When options.dryRun() == false, persists all domains in dependency order.
     */
    public MigrationExecutionReport run(MigrationExecutionOptions options) throws IOException {
        Instant start = Instant.now();
        Map<MigrationDomain, MigrationExecutionReport.DomainResult> results = new LinkedHashMap<>();
        List<String> globalErrors = new ArrayList<>();

        log.info("Phase2D import starting: dryRun={} domains={}",
                options.dryRun(), options.domains());

        try {
            // ── 1. Stream dump and accumulate all rows ────────────────────────
            List<WpPost> allPosts = new ArrayList<>();
            Map<Long, List<WpPostMeta>> metaByPost = new HashMap<>();
            Map<Long, WpTerm> termsById = new LinkedHashMap<>();
            Map<Long, WpTermTaxonomy> termTaxById = new LinkedHashMap<>();
            List<WpTermRelationship> termRels = new ArrayList<>();
            List<WpRedirectRow> rankMathRedirects = new ArrayList<>();

            List<WpUser> allUsers = new ArrayList<>();
            Map<Long, List<WpUserMeta>> metaByUser = new HashMap<>();
            List<WpPost> orderPosts = new ArrayList<>();
            List<WpPost> couponPosts = new ArrayList<>();
            Map<Long, List<WpOrderItem>> itemsByOrder = new HashMap<>();
            Map<Long, List<WpOrderItemMeta>> metaByItem = new HashMap<>();

            rowReader.stream(options.dumpPath(), ALL_TABLES, (table, row) -> {
                switch (table) {
                    case "kd_posts" -> {
                        String type = row.get("post_type");
                        WpPost p = toWpPost(row);
                        if (p == null) return;
                        if ("shop_order".equals(type)) orderPosts.add(p);
                        else if ("shop_coupon".equals(type)) couponPosts.add(p);
                        else allPosts.add(p);
                    }
                    case "kd_postmeta" -> {
                        WpPostMeta m = toWpPostMeta(row);
                        if (m != null) metaByPost.computeIfAbsent(m.postId(), k -> new ArrayList<>()).add(m);
                    }
                    case "kd_terms" -> {
                        WpTerm t = toWpTerm(row);
                        if (t != null) termsById.put(t.termId(), t);
                    }
                    case "kd_term_taxonomy" -> {
                        WpTermTaxonomy tt = toWpTermTaxonomy(row);
                        if (tt != null) termTaxById.put(tt.termTaxonomyId(), tt);
                    }
                    case "kd_term_relationships" -> {
                        WpTermRelationship rel = toWpTermRelationship(row);
                        if (rel != null) termRels.add(rel);
                    }
                    case "kd_rank_math_redirections" -> {
                        WpRedirectRow r = toRankMathRedirect(row);
                        if (r != null) rankMathRedirects.add(r);
                    }
                    case "kd_users" -> {
                        WpUser u = toWpUser(row);
                        if (u != null) allUsers.add(u);
                    }
                    case "kd_usermeta" -> {
                        WpUserMeta m = toWpUserMeta(row);
                        if (m != null) metaByUser.computeIfAbsent(m.userId(), k -> new ArrayList<>()).add(m);
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

            // ── 2. Build taxonomy maps ────────────────────────────────────────
            Map<Long, Set<Long>> relsByObject = new HashMap<>();
            for (WpTermRelationship rel : termRels) {
                relsByObject.computeIfAbsent(rel.objectId(), k -> new HashSet<>()).add(rel.termTaxonomyId());
            }
            Map<Long, WpTermTaxonomy> productCatByTermId = new HashMap<>();
            Map<Long, WpTermTaxonomy> brandByTermId = new HashMap<>();
            Map<Long, WpTermTaxonomy> navMenuByTermId = new HashMap<>();
            for (WpTermTaxonomy tt : termTaxById.values()) {
                switch (tt.taxonomy()) {
                    case "product_cat" -> productCatByTermId.put(tt.termId(), tt);
                    case "pwb-brand"   -> brandByTermId.put(tt.termId(), tt);
                    case "nav_menu"    -> navMenuByTermId.put(tt.termId(), tt);
                }
            }
            // Build termTaxonomyId → termId map for reverse lookup
            Map<Long, Long> ttIdToTermId = new HashMap<>();
            for (WpTermTaxonomy tt : termTaxById.values()) ttIdToTermId.put(tt.termTaxonomyId(), tt.termId());

            // ── 3. Partition posts ────────────────────────────────────────────
            List<WpPost> productPosts = new ArrayList<>(), variationPosts = new ArrayList<>(),
                    attachmentPosts = new ArrayList<>(), pagePosts = new ArrayList<>(),
                    articlePosts = new ArrayList<>(), navMenuItemPosts = new ArrayList<>();
            for (WpPost post : allPosts) {
                switch (post.postType()) {
                    case "product"           -> productPosts.add(post);
                    case "product_variation" -> variationPosts.add(post);
                    case "attachment"        -> attachmentPosts.add(post);
                    case "page"              -> pagePosts.add(post);
                    case "post"              -> articlePosts.add(post);
                    case "nav_menu_item"     -> navMenuItemPosts.add(post);
                }
            }

            // ── 4. Categories ─────────────────────────────────────────────────
            if (options.includesDomain(MigrationDomain.CATEGORIES)) {
                List<WordPressCategoryMapper.MappedCategory> cats = new ArrayList<>();
                for (Map.Entry<Long, WpTermTaxonomy> e : productCatByTermId.entrySet()) {
                    WpTerm term = termsById.get(e.getKey());
                    if (term != null) cats.add(categoryMapper.map(term, e.getValue()));
                }
                results.put(MigrationDomain.CATEGORIES, categoryImporter.importBatch(cats, options));
            }

            // ── 5. Brands ─────────────────────────────────────────────────────
            if (options.includesDomain(MigrationDomain.BRANDS)) {
                List<WordPressBrandMapper.MappedBrand> brands = new ArrayList<>();
                for (Map.Entry<Long, WpTermTaxonomy> e : brandByTermId.entrySet()) {
                    WpTerm term = termsById.get(e.getKey());
                    if (term != null) brands.add(brandMapper.map(term, e.getValue()));
                }
                results.put(MigrationDomain.BRANDS, brandImporter.importBatch(brands, options));
            }

            // ── 6. Media (metadata only) ──────────────────────────────────────
            if (options.includesDomain(MigrationDomain.MEDIA)) {
                List<WordPressMediaMapper.MappedMedia> media = new ArrayList<>();
                for (WpPost post : attachmentPosts) {
                    List<WpPostMeta> metas = metaByPost.getOrDefault(post.id(), List.of());
                    String attachedFile = null, serializedMeta = null, altText = null;
                    for (WpPostMeta m : metas) {
                        switch (m.metaKey()) {
                            case "_wp_attached_file"        -> attachedFile = m.metaValue();
                            case "_wp_attachment_metadata"  -> serializedMeta = m.metaValue();
                            case "_wp_attachment_image_alt" -> altText = m.metaValue();
                        }
                    }
                    if (attachedFile != null && !attachedFile.isBlank()) {
                        WpAttachmentMeta att = new WpAttachmentMeta(
                                post.id(), attachedFile, post.postMimeType(),
                                altText, post.postTitle(), serializedMeta);
                        media.add(mediaMapper.map(att));
                    }
                }
                results.put(MigrationDomain.MEDIA, mediaImporter.importBatch(media, options));
            }

            // ── 7. Pages ──────────────────────────────────────────────────────
            if (options.includesDomain(MigrationDomain.PAGES)) {
                List<WordPressPageMapper.MappedPage> pages = new ArrayList<>();
                for (WpPost post : pagePosts) {
                    pages.add(pageMapper.map(post, metaByPost.getOrDefault(post.id(), List.of())));
                }
                results.put(MigrationDomain.PAGES, pageImporter.importBatch(pages, options));
            }

            // ── 8. Articles ───────────────────────────────────────────────────
            if (options.includesDomain(MigrationDomain.ARTICLES)) {
                List<WordPressArticleMapper.MappedArticle> articles = new ArrayList<>();
                for (WpPost post : articlePosts) {
                    articles.add(articleMapper.map(post, metaByPost.getOrDefault(post.id(), List.of())));
                }
                results.put(MigrationDomain.ARTICLES, articleImporter.importBatch(articles, options));
            }

            // ── 9. Redirects (RankMath only) ──────────────────────────────────
            if (options.includesDomain(MigrationDomain.REDIRECTS)) {
                List<WordPressRedirectMapper.MappedRedirect> redirects = new ArrayList<>();
                for (WpRedirectRow row : rankMathRedirects) {
                    WordPressRedirectMapper.MappedRedirect mr = redirectMapper.map(row);
                    if (mr.sourcePattern() != null && mr.targetPattern() != null
                            && !mr.sourcePattern().equals(mr.targetPattern())) {
                        redirects.add(mr);
                    }
                }
                results.put(MigrationDomain.REDIRECTS, redirectImporter.importBatch(redirects, options));
            }

            // ── 10. Menus ─────────────────────────────────────────────────────
            if (options.includesDomain(MigrationDomain.MENUS)) {
                List<WpTerm> navMenuTerms = navMenuByTermId.keySet().stream()
                        .map(termsById::get).filter(t -> t != null).toList();
                Map<Long, List<WpPost>> itemsByMenuTermId = new HashMap<>();
                for (WpPost item : navMenuItemPosts) {
                    for (long ttId : relsByObject.getOrDefault(item.id(), Set.of())) {
                        WpTermTaxonomy tt = termTaxById.get(ttId);
                        if (tt != null && "nav_menu".equals(tt.taxonomy())) {
                            itemsByMenuTermId.computeIfAbsent(tt.termId(), k -> new ArrayList<>()).add(item);
                        }
                    }
                }
                List<WpPostMeta> allMenuMetas = new ArrayList<>();
                for (WpPost item : navMenuItemPosts) {
                    allMenuMetas.addAll(metaByPost.getOrDefault(item.id(), List.of()));
                }
                List<WordPressMenuMapper.MappedMenu> menus = new ArrayList<>();
                for (WpTerm navTerm : navMenuTerms) {
                    List<WpPost> items = itemsByMenuTermId.getOrDefault(navTerm.termId(), List.of());
                    if (!items.isEmpty()) menus.add(menuMapper.mapMenu(navTerm, items, allMenuMetas));
                }
                results.put(MigrationDomain.MENUS, menuImporter.importBatch(menus, options));
            }

            // ── 11. Products (with category/brand resolution) ─────────────────
            if (options.includesDomain(MigrationDomain.PRODUCTS)) {
                // Build productId → primary category slug mapping
                Map<Long, String> productToCategorySlug = new HashMap<>();
                Map<Long, String> productToBrandSlug = new HashMap<>();
                for (WpPost product : productPosts) {
                    for (long ttId : relsByObject.getOrDefault(product.id(), Set.of())) {
                        Long termId = ttIdToTermId.get(ttId);
                        if (termId == null) continue;
                        if (productCatByTermId.containsKey(termId)) {
                            WpTerm term = termsById.get(termId);
                            if (term != null && !productToCategorySlug.containsKey(product.id())) {
                                productToCategorySlug.put(product.id(), term.slug());
                            }
                        }
                        if (brandByTermId.containsKey(termId)) {
                            WpTerm term = termsById.get(termId);
                            if (term != null) productToBrandSlug.put(product.id(), term.slug());
                        }
                    }
                }
                List<ProductImporter.ResolvedProduct> products = new ArrayList<>();
                for (WpPost post : productPosts) {
                    WordPressProductMapper.MappedProduct mp =
                            productMapper.map(post, metaByPost.getOrDefault(post.id(), List.of()));
                    products.add(new ProductImporter.ResolvedProduct(
                            mp,
                            productToCategorySlug.get(post.id()),
                            productToBrandSlug.get(post.id())));
                }
                results.put(MigrationDomain.PRODUCTS, productImporter.importBatch(products, options));
            }

            // ── 12. Customers ─────────────────────────────────────────────────
            if (options.includesDomain(MigrationDomain.CUSTOMERS)) {
                List<WordPressCustomerMapper.MappedCustomer> customers = new ArrayList<>();
                List<WordPressCustomerMapper.MappedCustomer> synthetics = new ArrayList<>();

                for (WpUser user : allUsers) {
                    WordPressCustomerMapper.MappedCustomer mc =
                            customerMapper.map(user, metaByUser.getOrDefault(user.id(), List.of()),
                                    TABLE_PREFIX);
                    if (mc != null) customers.add(mc);
                }
                results.put(MigrationDomain.CUSTOMERS, customerImporter.importBatch(customers, options));
            }

            // ── 13. Coupons ───────────────────────────────────────────────────
            if (options.includesDomain(MigrationDomain.COUPONS)) {
                List<WordPressCouponMapper.MappedCoupon> coupons = new ArrayList<>();
                for (WpPost post : couponPosts) {
                    coupons.add(couponMapper.map(post, metaByPost.getOrDefault(post.id(), List.of())));
                }
                results.put(MigrationDomain.COUPONS, couponImporter.importBatch(coupons, options));
            }

            // ── 14. Orders ────────────────────────────────────────────────────
            if (options.includesDomain(MigrationDomain.ORDERS)) {
                List<WordPressOrderMapper.MappedOrder> orders = new ArrayList<>();
                for (WpPost post : orderPosts) {
                    List<WpOrderItem> items = itemsByOrder.getOrDefault(post.id(), List.of());
                    orders.add(orderMapper.map(
                            post,
                            metaByPost.getOrDefault(post.id(), List.of()),
                            items,
                            metaByItem));
                }
                results.put(MigrationDomain.ORDERS, orderImporter.importBatch(orders, options));
            }

        } catch (Exception e) {
            globalErrors.add("Fatal error during import: " + e.getMessage());
            log.error("Phase2D import failed", e);
            if (options.failFast()) {
                if (e instanceof IOException ioe) throw ioe;
                throw new RuntimeException(e);
            }
        }

        Duration duration = Duration.between(start, Instant.now());
        log.info("Phase2D import completed in {}ms: dryRun={}", duration.toMillis(), options.dryRun());
        return new MigrationExecutionReport(options.dryRun(), results, globalErrors, duration);
    }

    // ── Row converters (same as dry-run services) ─────────────────────────────

    private WpPost toWpPost(WordPressTableRow row) {
        try {
            return new WpPost(row.getLong("ID", 0), row.getLong("post_author", 0),
                    parseDateTime(row.get("post_date")), parseDateTime(row.get("post_date_gmt")),
                    nvl(row.get("post_content")), nvl(row.get("post_title")),
                    nvl(row.get("post_excerpt")), nvl(row.get("post_status")),
                    nvl(row.get("comment_status")), nvl(row.get("post_name")),
                    nvl(row.get("post_type")), row.getLong("post_parent", 0),
                    row.getInt("menu_order", 0), nvl(row.get("guid")),
                    nvl(row.get("post_mime_type")), row.getLong("comment_count", 0));
        } catch (Exception e) { return null; }
    }

    private WpPostMeta toWpPostMeta(WordPressTableRow row) {
        try { return new WpPostMeta(row.getLong("meta_id", 0), row.getLong("post_id", 0),
                row.get("meta_key"), row.get("meta_value")); }
        catch (Exception e) { return null; }
    }

    private WpTerm toWpTerm(WordPressTableRow row) {
        try { return new WpTerm(row.getLong("term_id", 0), nvl(row.get("name")),
                nvl(row.get("slug")), row.getLong("term_group", 0)); }
        catch (Exception e) { return null; }
    }

    private WpTermTaxonomy toWpTermTaxonomy(WordPressTableRow row) {
        try { return new WpTermTaxonomy(row.getLong("term_taxonomy_id", 0),
                row.getLong("term_id", 0), nvl(row.get("taxonomy")),
                nvl(row.get("description")), row.getLong("parent", 0), row.getLong("count", 0)); }
        catch (Exception e) { return null; }
    }

    private WpTermRelationship toWpTermRelationship(WordPressTableRow row) {
        try { return new WpTermRelationship(row.getLong("object_id", 0),
                row.getLong("term_taxonomy_id", 0), row.getInt("term_order", 0)); }
        catch (Exception e) { return null; }
    }

    private WpRedirectRow toRankMathRedirect(WordPressTableRow row) {
        try {
            String sources = row.get("sources");
            return new WpRedirectRow(row.getLong("id", 0), sources, nvl(row.get("url_to")),
                    row.getInt("header_code", 301), nvl(row.get("status")),
                    WordPressRedirectMapper.parseFirstSourcePattern(sources));
        } catch (Exception e) { return null; }
    }

    private WpUser toWpUser(WordPressTableRow row) {
        try { return new WpUser(row.getLong("ID", 0), nvl(row.get("user_login")),
                nvl(row.get("user_pass")), nvl(row.get("user_nicename")),
                nvl(row.get("user_email")), nvl(row.get("user_url")),
                parseDateTime(row.get("user_registered")), nvl(row.get("user_status")),
                nvl(row.get("display_name"))); }
        catch (Exception e) { return null; }
    }

    private WpUserMeta toWpUserMeta(WordPressTableRow row) {
        try { return new WpUserMeta(row.getLong("umeta_id", 0), row.getLong("user_id", 0),
                row.get("meta_key"), row.get("meta_value")); }
        catch (Exception e) { return null; }
    }

    private WpOrderItem toWpOrderItem(WordPressTableRow row) {
        try { return new WpOrderItem(row.getLong("order_item_id", 0),
                nvl(row.get("order_item_name")), nvl(row.get("order_item_type")),
                row.getLong("order_id", 0)); }
        catch (Exception e) { return null; }
    }

    private WpOrderItemMeta toWpOrderItemMeta(WordPressTableRow row) {
        try { return new WpOrderItemMeta(row.getLong("meta_id", 0),
                row.getLong("order_item_id", 0), row.get("meta_key"), row.get("meta_value")); }
        catch (Exception e) { return null; }
    }

    private LocalDateTime parseDateTime(String value) {
        if (value == null || value.isBlank() || value.startsWith("0000"))
            return LocalDateTime.of(1970, 1, 1, 0, 0);
        try { return LocalDateTime.parse(value, WP_DATETIME); }
        catch (DateTimeParseException e) { return LocalDateTime.of(1970, 1, 1, 0, 0); }
    }

    private String nvl(String v) { return v != null ? v : ""; }
}
