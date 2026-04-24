package com.bigbike.bigbike_backend.migration.wordpress.importer;

import com.bigbike.bigbike_backend.migration.wordpress.config.WordPressMigrationProperties;
import com.bigbike.bigbike_backend.migration.wordpress.mapper.WordPressArticleMapper;
import com.bigbike.bigbike_backend.migration.wordpress.mapper.WordPressBrandMapper;
import com.bigbike.bigbike_backend.migration.wordpress.normalizer.ProductNormalizationService;
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
import com.bigbike.bigbike_backend.migration.wordpress.importer.ProductTagImporter.MappedProductTag;
import com.bigbike.bigbike_backend.migration.wordpress.mapper.WordPressReviewMapper;
import com.bigbike.bigbike_backend.migration.wordpress.importer.AttributeImporter.MappedAttribute;
import com.bigbike.bigbike_backend.migration.wordpress.importer.AttributeImporter.MappedAttributeValue;
import com.bigbike.bigbike_backend.migration.wordpress.model.WpAttachmentMeta;
import com.bigbike.bigbike_backend.migration.wordpress.model.WpComment;
import com.bigbike.bigbike_backend.migration.wordpress.model.WpCommentMeta;
import com.bigbike.bigbike_backend.migration.wordpress.model.WpFgRedirect;
import com.bigbike.bigbike_backend.migration.wordpress.model.WpOrderItem;
import com.bigbike.bigbike_backend.migration.wordpress.model.WpOrderItemMeta;
import com.bigbike.bigbike_backend.migration.wordpress.model.WpPost;
import com.bigbike.bigbike_backend.migration.wordpress.model.WpPostMeta;
import com.bigbike.bigbike_backend.migration.wordpress.model.WpRedirectRow;
import com.bigbike.bigbike_backend.migration.wordpress.redirect.FgRedirectResolver;
import com.bigbike.bigbike_backend.migration.wordpress.model.WpTerm;
import com.bigbike.bigbike_backend.migration.wordpress.model.WpTermRelationship;
import com.bigbike.bigbike_backend.migration.wordpress.model.WpTermTaxonomy;
import com.bigbike.bigbike_backend.migration.wordpress.model.WpTermMeta;
import com.bigbike.bigbike_backend.migration.wordpress.model.WpUser;
import com.bigbike.bigbike_backend.migration.wordpress.model.WpUserMeta;
import com.bigbike.bigbike_backend.migration.wordpress.parser.WordPressSqlDumpRowReader;
import com.bigbike.bigbike_backend.migration.wordpress.parser.WordPressTableRow;
import com.bigbike.bigbike_backend.migration.wordpress.writeplan.MigrationDomain;
import java.io.IOException;
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
            "kd_terms", "kd_term_taxonomy", "kd_term_relationships", "kd_termmeta",
            "kd_rank_math_redirections", "kd_fg_redirect",
            "kd_comments", "kd_commentmeta"
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

    private final WordPressMigrationProperties migrationProperties;
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
    private final WordPressReviewMapper reviewMapper;

    private final CategoryImporter categoryImporter;
    private final BrandImporter brandImporter;
    private final MediaImporter mediaImporter;
    private final PageImporter pageImporter;
    private final ArticleImporter articleImporter;
    private final RedirectImporter redirectImporter;
    private final MenuImporter menuImporter;
    private final FgRedirectResolver fgRedirectResolver;
    private final ProductNormalizationService productNormalizationService;
    private final ProductImporter productImporter;
    private final ProductVariationImporter productVariationImporter;
    private final CustomerImporter customerImporter;
    private final CouponImporter couponImporter;
    private final OrderImporter orderImporter;
    private final ProductTagImporter productTagImporter;
    private final ReviewImporter reviewImporter;
    private final AttributeImporter attributeImporter;

    public WordPressMigrationImportService(
            WordPressMigrationProperties migrationProperties,
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
            FgRedirectResolver fgRedirectResolver,
            ProductNormalizationService productNormalizationService,
            ProductImporter productImporter,
            ProductVariationImporter productVariationImporter,
            CustomerImporter customerImporter,
            CouponImporter couponImporter,
            OrderImporter orderImporter,
            WordPressReviewMapper reviewMapper,
            ProductTagImporter productTagImporter,
            ReviewImporter reviewImporter,
            AttributeImporter attributeImporter) {
        this.migrationProperties = migrationProperties;
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
        this.reviewMapper = reviewMapper;
        this.categoryImporter = categoryImporter;
        this.brandImporter = brandImporter;
        this.mediaImporter = mediaImporter;
        this.pageImporter = pageImporter;
        this.articleImporter = articleImporter;
        this.redirectImporter = redirectImporter;
        this.menuImporter = menuImporter;
        this.fgRedirectResolver = fgRedirectResolver;
        this.productNormalizationService = productNormalizationService;
        this.productImporter = productImporter;
        this.productVariationImporter = productVariationImporter;
        this.customerImporter = customerImporter;
        this.couponImporter = couponImporter;
        this.orderImporter = orderImporter;
        this.productTagImporter = productTagImporter;
        this.reviewImporter = reviewImporter;
        this.attributeImporter = attributeImporter;
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
            Map<Long, List<WpTermMeta>> metaByTerm = new HashMap<>();
            List<WpTermRelationship> termRels = new ArrayList<>();
            List<WpRedirectRow> rankMathRedirects = new ArrayList<>();
            List<WpFgRedirect> fgRedirects = new ArrayList<>();
            List<WpComment> reviewComments = new ArrayList<>();
            Map<Long, List<WpCommentMeta>> metaByComment = new HashMap<>();

            List<WpUser> allUsers = new ArrayList<>();
            Map<Long, WpUser> usersById = new HashMap<>();
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
                    case "kd_termmeta" -> {
                        WpTermMeta m = toWpTermMeta(row);
                        if (m != null) metaByTerm.computeIfAbsent(m.termId(), k -> new ArrayList<>()).add(m);
                    }
                    case "kd_term_relationships" -> {
                        WpTermRelationship rel = toWpTermRelationship(row);
                        if (rel != null) termRels.add(rel);
                    }
                    case "kd_rank_math_redirections" -> {
                        WpRedirectRow r = toRankMathRedirect(row);
                        if (r != null) rankMathRedirects.add(r);
                    }
                    case "kd_fg_redirect" -> {
                        WpFgRedirect fg = toFgRedirect(row);
                        if (fg != null) fgRedirects.add(fg);
                    }
                    case "kd_users" -> {
                        WpUser u = toWpUser(row);
                        if (u != null) {
                            allUsers.add(u);
                            usersById.put(u.id(), u);
                        }
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
                    case "kd_comments" -> {
                        WpComment c = toWpComment(row);
                        if (c != null && "review".equals(c.commentType())) reviewComments.add(c);
                    }
                    case "kd_commentmeta" -> {
                        WpCommentMeta m = toWpCommentMeta(row);
                        if (m != null) metaByComment.computeIfAbsent(m.commentId(), k -> new ArrayList<>()).add(m);
                    }
                }
            });

            // ── 2. Build taxonomy maps ────────────────────────────────────────
            Map<Long, Set<Long>> relsByObject = new HashMap<>();
            for (WpTermRelationship rel : termRels) {
                relsByObject.computeIfAbsent(rel.objectId(), k -> new LinkedHashSet<>()).add(rel.termTaxonomyId());
            }
            Map<Long, WpTermTaxonomy> productCatByTermId = new HashMap<>();
            Map<Long, WpTermTaxonomy> brandByTermId = new HashMap<>();
            Map<Long, WpTermTaxonomy> navMenuByTermId = new HashMap<>();
            Map<Long, WpTermTaxonomy> productTagByTermId = new HashMap<>();
            Map<Long, WpTermTaxonomy> blogCategoryByTermId = new HashMap<>();
            Map<Long, WpTermTaxonomy> blogTagByTermId = new HashMap<>();
            Map<Long, WpTermTaxonomy> attributeTaxonomyByTermId = new HashMap<>();
            for (WpTermTaxonomy tt : termTaxById.values()) {
                switch (tt.taxonomy()) {
                    case "product_cat"  -> productCatByTermId.put(tt.termId(), tt);
                    case "pwb-brand"    -> brandByTermId.put(tt.termId(), tt);
                    case "nav_menu"     -> navMenuByTermId.put(tt.termId(), tt);
                    case "product_tag"  -> productTagByTermId.put(tt.termId(), tt);
                    case "category"     -> blogCategoryByTermId.put(tt.termId(), tt);
                    case "post_tag"     -> blogTagByTermId.put(tt.termId(), tt);
                    default -> {
                        if (tt.taxonomy() != null && tt.taxonomy().startsWith("pa_")) {
                            attributeTaxonomyByTermId.put(tt.termId(), tt);
                        }
                    }
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
            List<WordPressMediaMapper.MappedMedia> media = new ArrayList<>();
            if (options.includesDomain(MigrationDomain.MEDIA)) {
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
            // Build attachment-id → MappedMedia lookup for thumbnail resolution during product import
            Map<Long, WordPressMediaMapper.MappedMedia> mediaByLegacyId = new HashMap<>();
            for (WordPressMediaMapper.MappedMedia mm : media) {
                if (mm.storagePath() != null && !mm.storagePath().isBlank()) {
                    mediaByLegacyId.put(mm.sourceId(), mm);
                }
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
                    WordPressArticleMapper.MappedArticle mapped =
                            articleMapper.map(post, metaByPost.getOrDefault(post.id(), List.of()));
                    articles.add(new WordPressArticleMapper.MappedArticle(
                            mapped.sourceId(),
                            mapped.authorSourceId(),
                            resolveUserDisplayName(usersById.get(mapped.authorSourceId())),
                            mapped.slug(),
                            mapped.title(),
                            mapped.excerpt(),
                            mapped.content(),
                            mapped.publishedAt(),
                            mapped.status(),
                            mapped.seoTitle(),
                            mapped.seoDescription(),
                            articleCategoryRefs(post, relsByObject, ttIdToTermId, termsById, blogCategoryByTermId),
                            articleTagRefs(post, relsByObject, ttIdToTermId, termsById, blogTagByTermId),
                            mapped.expectedUrl(),
                            mapped.warnings()));
                }
                results.put(MigrationDomain.ARTICLES, articleImporter.importBatch(articles, options));
            }

            // ── 9. Redirects (RankMath + FG) ─────────────────────────────────
            // FG redirect resolution MUST run after products are imported (step 11)
            // so it is deferred — we collect FG rows here but resolve them after step 11b.
            // RankMath redirects (40 rows, self-contained target URL) are imported now.
            List<WordPressRedirectMapper.MappedRedirect> rankMathMapped = new ArrayList<>();
            if (options.includesDomain(MigrationDomain.REDIRECTS)) {
                for (WpRedirectRow row : rankMathRedirects) {
                    WordPressRedirectMapper.MappedRedirect mr = redirectMapper.map(row);
                    if (mr.sourcePattern() != null && mr.targetPattern() != null
                            && !mr.sourcePattern().equals(mr.targetPattern())) {
                        rankMathMapped.add(mr);
                    }
                }
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
            if (options.includesDomain(MigrationDomain.PRODUCTS) || options.includesDomain(MigrationDomain.PRODUCT_VARIATIONS)) {
                // Import attribute taxonomies and values before variations run.
                List<MappedAttribute> attributes = buildAttributeMappings(attributeTaxonomyByTermId, termsById, metaByTerm);
                attributeImporter.importBatch(attributes, options);
            }

            if (options.includesDomain(MigrationDomain.PRODUCTS)) {
                // Build productId → category slug mapping
                Map<Long, String> productToCategorySlug = new HashMap<>();
                Map<Long, List<String>> productToCategorySlugs = new HashMap<>();
                Map<Long, String> productToBrandSlug = new HashMap<>();
                for (WpPost product : productPosts) {
                    for (long ttId : relsByObject.getOrDefault(product.id(), Set.of())) {
                        Long termId = ttIdToTermId.get(ttId);
                        if (termId == null) continue;
                        if (productCatByTermId.containsKey(termId)) {
                            WpTerm term = termsById.get(termId);
                            if (term != null) {
                                productToCategorySlugs.computeIfAbsent(product.id(), k -> new ArrayList<>()).add(term.slug());
                                if (!productToCategorySlug.containsKey(product.id())) {
                                    productToCategorySlug.put(product.id(), term.slug());
                                }
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
                            productToCategorySlugs.getOrDefault(post.id(), List.of()),
                            productToBrandSlug.get(post.id())));
                }
                ProductNormalizationService.NormalizationResult norm =
                        productNormalizationService.normalize(products);
                log.info("ProductNormalization: recoveredSlug={} recoveredCategory={}",
                        norm.recoveredSlugCount(), norm.recoveredCategoryCount());
                results.put(MigrationDomain.PRODUCTS, productImporter.importBatch(
                        norm.products(), options, mediaByLegacyId,
                        migrationProperties.getLegacyUploadsBaseUrl()));
            }

            // ── 11b. Product Variations ───────────────────────────────────────
            if (options.includesDomain(MigrationDomain.PRODUCT_VARIATIONS)) {
                List<WordPressVariationMapper.MappedVariation> variations = new ArrayList<>();
                for (WpPost post : variationPosts) {
                    variations.add(variationMapper.map(post, metaByPost.getOrDefault(post.id(), List.of())));
                }
                results.put(MigrationDomain.PRODUCT_VARIATIONS,
                        productVariationImporter.importBatch(variations, options));
            }

            // ── 11c. Redirects — FG resolution (requires products in DB) ─────
            if (options.includesDomain(MigrationDomain.REDIRECTS)) {
                FgRedirectResolver.ResolutionResult fg = fgRedirectResolver.resolve(fgRedirects);
                log.info("FgRedirect: resolved={} deferred={} selfLoops={}",
                        fg.resolved().size(), fg.deferredCount(), fg.selfLoopCount());
                List<WordPressRedirectMapper.MappedRedirect> allRedirects = new ArrayList<>(rankMathMapped);
                allRedirects.addAll(fg.resolved());
                results.put(MigrationDomain.REDIRECTS, redirectImporter.importBatch(allRedirects, options));
            }

            // ── 12. Customers ─────────────────────────────────────────────────
            if (options.includesDomain(MigrationDomain.CUSTOMERS)) {
                List<WordPressCustomerMapper.MappedCustomer> customers = new ArrayList<>();
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

            // ── 15. Product Tags ──────────────────────────────────────────────
            if (options.includesDomain(MigrationDomain.PRODUCT_TAGS)) {
                List<MappedProductTag> tags = new ArrayList<>();
                for (WpPost product : productPosts) {
                    String dbProductId = "wp-prod-" + product.id();
                    for (long ttId : relsByObject.getOrDefault(product.id(), Set.of())) {
                        Long termId = ttIdToTermId.get(ttId);
                        if (termId == null) continue;
                        if (productTagByTermId.containsKey(termId)) {
                            WpTerm term = termsById.get(termId);
                            if (term != null && !term.name().isBlank()) {
                                tags.add(new MappedProductTag(
                                        term.termId(),
                                        term.slug(),
                                        term.name(),
                                        dbProductId));
                            }
                        }
                    }
                }
                log.info("Product tags collected: {}", tags.size());
                results.put(MigrationDomain.PRODUCT_TAGS, productTagImporter.importBatch(tags, options));
            }

            // ── 16. Product Reviews ───────────────────────────────────────────
            if (options.includesDomain(MigrationDomain.PRODUCT_REVIEWS)) {
                List<WordPressReviewMapper.MappedReview> reviews = new ArrayList<>();
                for (WpComment comment : reviewComments) {
                    reviews.add(reviewMapper.map(comment,
                            metaByComment.getOrDefault(comment.commentId(), List.of())));
                }
                log.info("Product reviews collected: {}", reviews.size());
                results.put(MigrationDomain.PRODUCT_REVIEWS, reviewImporter.importBatch(reviews, options));
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

    private String resolveUserDisplayName(WpUser user) {
        if (user == null) {
            return null;
        }
        if (user.displayName() != null && !user.displayName().isBlank()) {
            return user.displayName();
        }
        if (user.userNicename() != null && !user.userNicename().isBlank()) {
            return user.userNicename();
        }
        return user.userLogin();
    }

    private List<TaxonomyRef> articleCategoryRefs(
            WpPost post,
            Map<Long, Set<Long>> relsByObject,
            Map<Long, Long> ttIdToTermId,
            Map<Long, WpTerm> termsById,
            Map<Long, WpTermTaxonomy> taxonomyByTermId) {
        return collectTaxonomyRefs(post, relsByObject, ttIdToTermId, termsById, taxonomyByTermId);
    }

    private List<TaxonomyRef> articleTagRefs(
            WpPost post,
            Map<Long, Set<Long>> relsByObject,
            Map<Long, Long> ttIdToTermId,
            Map<Long, WpTerm> termsById,
            Map<Long, WpTermTaxonomy> taxonomyByTermId) {
        return collectTaxonomyRefs(post, relsByObject, ttIdToTermId, termsById, taxonomyByTermId);
    }

    private List<TaxonomyRef> toTaxonomyRefs(List<TaxonomyRef> refs) {
        return refs == null ? List.of() : refs;
    }

    private List<TaxonomyRef> collectTaxonomyRefs(
            WpPost post,
            Map<Long, Set<Long>> relsByObject,
            Map<Long, Long> ttIdToTermId,
            Map<Long, WpTerm> termsById,
            Map<Long, WpTermTaxonomy> taxonomyByTermId) {
        List<TaxonomyRef> refs = new ArrayList<>();
        for (long ttId : relsByObject.getOrDefault(post.id(), Set.of())) {
            Long termId = ttIdToTermId.get(ttId);
            if (termId == null || !taxonomyByTermId.containsKey(termId)) {
                continue;
            }
            WpTerm term = termsById.get(termId);
            if (term == null) {
                continue;
            }
            refs.add(new TaxonomyRef(term.termId(), term.slug(), term.name()));
        }
        return refs;
    }

    private List<MappedAttribute> buildAttributeMappings(
            Map<Long, WpTermTaxonomy> attributeTaxonomyByTermId,
            Map<Long, WpTerm> termsById,
            Map<Long, List<WpTermMeta>> metaByTerm) {
        Map<String, List<MappedAttributeValue>> valuesByCode = new LinkedHashMap<>();
        Map<String, Long> taxonomyIdByCode = new LinkedHashMap<>();
        Map<String, String> nameByCode = new LinkedHashMap<>();

        for (Map.Entry<Long, WpTermTaxonomy> entry : attributeTaxonomyByTermId.entrySet()) {
            WpTermTaxonomy taxonomy = entry.getValue();
            WpTerm term = termsById.get(entry.getKey());
            if (taxonomy == null || term == null || taxonomy.taxonomy() == null) {
                continue;
            }
            String code = taxonomy.taxonomy().startsWith("pa_")
                    ? taxonomy.taxonomy().substring(3)
                    : taxonomy.taxonomy();
            taxonomyIdByCode.putIfAbsent(code, taxonomy.termTaxonomyId());
            nameByCode.putIfAbsent(code, humanize(code));

            String colorHex = readFirstTermMeta(metaByTerm.get(entry.getKey()), "color", "_color", "swatch_color", "swatch_hex");
            String swatchImageId = readFirstTermMeta(metaByTerm.get(entry.getKey()), "image", "_image", "swatch_image");
            if (swatchImageId != null && swatchImageId.isBlank()) {
                swatchImageId = null;
            }

            valuesByCode.computeIfAbsent(code, k -> new ArrayList<>())
                    .add(new MappedAttributeValue(
                            term.termId(),
                            term.slug(),
                            term.name(),
                            colorHex,
                            swatchImageId,
                            valuesByCode.getOrDefault(code, List.of()).size()));
        }

        List<MappedAttribute> attributes = new ArrayList<>();
        for (Map.Entry<String, List<MappedAttributeValue>> entry : valuesByCode.entrySet()) {
            String code = entry.getKey();
            attributes.add(new MappedAttribute(
                    taxonomyIdByCode.getOrDefault(code, 0L),
                    taxonomyIdByCode.getOrDefault(code, 0L),
                    code,
                    nameByCode.getOrDefault(code, humanize(code)),
                    "select",
                    true,
                    entry.getValue(),
                    List.of()));
        }
        return attributes;
    }

    private String readTermMeta(List<WpTermMeta> metas, String key) {
        if (metas == null || key == null) {
            return null;
        }
        for (WpTermMeta meta : metas) {
            if (meta.metaKey() != null && meta.metaKey().equals(key)) {
                return meta.metaValue();
            }
        }
        return null;
    }

    private String readFirstTermMeta(List<WpTermMeta> metas, String... keys) {
        if (keys == null) {
            return null;
        }
        for (String key : keys) {
            String value = readTermMeta(metas, key);
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return null;
    }

    private String humanize(String value) {
        if (value == null || value.isBlank()) {
            return value;
        }
        String normalized = value.replace('-', ' ').replace('_', ' ');
        return Character.toUpperCase(normalized.charAt(0)) + normalized.substring(1);
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

    private WpTermMeta toWpTermMeta(WordPressTableRow row) {
        try {
            return new WpTermMeta(
                    row.getLong("meta_id", 0),
                    row.getLong("term_id", 0),
                    row.get("meta_key"),
                    row.get("meta_value"));
        } catch (Exception e) {
            return null;
        }
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

    private WpFgRedirect toFgRedirect(WordPressTableRow row) {
        try { return new WpFgRedirect(nvl(row.get("old_url")), row.getLong("id", 0),
                nvl(row.get("type")), row.getInt("activated", 0) == 1); }
        catch (Exception e) { return null; }
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

    private WpComment toWpComment(WordPressTableRow row) {
        try { return new WpComment(
                row.getLong("comment_ID", 0), row.getLong("comment_post_ID", 0),
                nvl(row.get("comment_author")), nvl(row.get("comment_author_email")),
                nvl(row.get("comment_content")), parseDateTime(row.get("comment_date_gmt")),
                nvl(row.get("comment_approved")), nvl(row.get("comment_type")),
                row.getLong("user_id", 0)); }
        catch (Exception e) { return null; }
    }

    private WpCommentMeta toWpCommentMeta(WordPressTableRow row) {
        try { return new WpCommentMeta(row.getLong("meta_id", 0),
                row.getLong("comment_id", 0), row.get("meta_key"), row.get("meta_value")); }
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
