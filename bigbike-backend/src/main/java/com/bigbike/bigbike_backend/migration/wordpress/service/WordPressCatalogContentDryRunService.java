package com.bigbike.bigbike_backend.migration.wordpress.service;

import com.bigbike.bigbike_backend.migration.wordpress.mapper.WordPressArticleMapper;
import com.bigbike.bigbike_backend.migration.wordpress.mapper.WordPressBrandMapper;
import com.bigbike.bigbike_backend.migration.wordpress.mapper.WordPressCategoryMapper;
import com.bigbike.bigbike_backend.migration.wordpress.mapper.WordPressMediaMapper;
import com.bigbike.bigbike_backend.migration.wordpress.mapper.WordPressMenuMapper;
import com.bigbike.bigbike_backend.migration.wordpress.mapper.WordPressPageMapper;
import com.bigbike.bigbike_backend.migration.wordpress.mapper.WordPressPermalinkManagerMapper;
import com.bigbike.bigbike_backend.migration.wordpress.mapper.WordPressProductMapper;
import com.bigbike.bigbike_backend.migration.wordpress.mapper.WordPressRedirectMapper;
import com.bigbike.bigbike_backend.migration.wordpress.mapper.WordPressVariationMapper;
import com.bigbike.bigbike_backend.migration.wordpress.model.WpAttachmentMeta;
import com.bigbike.bigbike_backend.migration.wordpress.model.WpFgRedirect;
import com.bigbike.bigbike_backend.migration.wordpress.model.WpOption;
import com.bigbike.bigbike_backend.migration.wordpress.model.WpPost;
import com.bigbike.bigbike_backend.migration.wordpress.model.WpPostMeta;
import com.bigbike.bigbike_backend.migration.wordpress.model.WpRedirectRow;
import com.bigbike.bigbike_backend.migration.wordpress.model.WpTerm;
import com.bigbike.bigbike_backend.migration.wordpress.model.WpTermRelationship;
import com.bigbike.bigbike_backend.migration.wordpress.model.WpTermTaxonomy;
import com.bigbike.bigbike_backend.migration.wordpress.parser.WordPressSqlDumpRowReader;
import com.bigbike.bigbike_backend.migration.wordpress.parser.WordPressTableRow;
import com.bigbike.bigbike_backend.migration.wordpress.report.CatalogContentDryRunResult;
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
import org.springframework.stereotype.Service;

/**
 * Orchestrates the Phase 2B catalog/content/media/redirect dry-run import.
 *
 * Safety guarantees:
 *   - NEVER writes to the application database.
 *   - Only reads the SQL dump file.
 *   - Only active when bigbike.migration.wordpress.enabled=true and dry-run=true.
 *   - Not wired to any application startup event.
 */
@Service
public class WordPressCatalogContentDryRunService {

    private static final Set<String> TARGET_TABLES = Set.of(
            "kd_posts", "kd_postmeta",
            "kd_terms", "kd_term_taxonomy", "kd_term_relationships",
            "kd_rank_math_redirections", "kd_fg_redirect", "kd_options"
    );

    private static final DateTimeFormatter WP_DATETIME =
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

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
    private final WordPressPermalinkManagerMapper permalinkMapper;

    public WordPressCatalogContentDryRunService(
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
            WordPressPermalinkManagerMapper permalinkMapper) {
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
        this.permalinkMapper = permalinkMapper;
    }

    /**
     * Run the dry-run import against the given dump path.
     * Streams the file once; never writes to the application database.
     *
     * @throws IOException if the dump file cannot be read
     */
    public CatalogContentDryRunResult run(Path dumpPath) throws IOException {
        // ── 1. Stream dump, accumulate raw rows ──────────────────────────────
        List<WpPost> allPosts = new ArrayList<>();
        Map<Long, List<WpPostMeta>> metaByPost = new HashMap<>();
        Map<Long, WpTerm> termsById = new LinkedHashMap<>();
        Map<Long, WpTermTaxonomy> termTaxById = new LinkedHashMap<>();
        List<WpTermRelationship> termRelationships = new ArrayList<>();
        List<WpRedirectRow> rankMathRedirects = new ArrayList<>();
        List<WpFgRedirect> fgRedirects = new ArrayList<>();
        Map<String, String> optionsMap = new HashMap<>();

        List<String> streamingWarnings = rowReader.stream(dumpPath, TARGET_TABLES,
                (tableName, row) -> {
                    switch (tableName) {
                        case "kd_posts" -> {
                            WpPost post = toWpPost(row);
                            if (post != null) allPosts.add(post);
                        }
                        case "kd_postmeta" -> {
                            WpPostMeta meta = toWpPostMeta(row);
                            if (meta != null) {
                                metaByPost.computeIfAbsent(meta.postId(), k -> new ArrayList<>())
                                        .add(meta);
                            }
                        }
                        case "kd_terms" -> {
                            WpTerm term = toWpTerm(row);
                            if (term != null) termsById.put(term.termId(), term);
                        }
                        case "kd_term_taxonomy" -> {
                            WpTermTaxonomy tt = toWpTermTaxonomy(row);
                            if (tt != null) termTaxById.put(tt.termTaxonomyId(), tt);
                        }
                        case "kd_term_relationships" -> {
                            WpTermRelationship rel = toWpTermRelationship(row);
                            if (rel != null) termRelationships.add(rel);
                        }
                        case "kd_rank_math_redirections" -> {
                            WpRedirectRow r = toRankMathRedirect(row);
                            if (r != null) rankMathRedirects.add(r);
                        }
                        case "kd_fg_redirect" -> {
                            WpFgRedirect fg = toFgRedirect(row);
                            if (fg != null) fgRedirects.add(fg);
                        }
                        case "kd_options" -> {
                            WpOption opt = toWpOption(row);
                            if (opt != null && opt.optionName() != null) {
                                optionsMap.put(opt.optionName(), opt.optionValue());
                            }
                        }
                    }
                });

        // ── 2. Build taxonomy lookup maps ────────────────────────────────────
        // objectId → Set<termTaxonomyId>
        Map<Long, Set<Long>> relsByObject = new HashMap<>();
        for (WpTermRelationship rel : termRelationships) {
            relsByObject.computeIfAbsent(rel.objectId(), k -> new HashSet<>())
                    .add(rel.termTaxonomyId());
        }
        // termId → List<WpTermTaxonomy> (grouped by taxonomy)
        Map<Long, WpTermTaxonomy> productCatByTermId = new HashMap<>();
        Map<Long, WpTermTaxonomy> brandByTermId = new HashMap<>();
        Map<Long, WpTermTaxonomy> navMenuByTermId = new HashMap<>();
        Map<Long, WpTermTaxonomy> productTagByTermId = new HashMap<>();
        for (WpTermTaxonomy tt : termTaxById.values()) {
            switch (tt.taxonomy()) {
                case "product_cat" -> productCatByTermId.put(tt.termId(), tt);
                case "pwb-brand"   -> brandByTermId.put(tt.termId(), tt);
                case "nav_menu"    -> navMenuByTermId.put(tt.termId(), tt);
                case "product_tag" -> productTagByTermId.put(tt.termId(), tt);
            }
        }

        // ── 3. Partition posts by post_type ───────────────────────────────────
        List<WpPost> productPosts = new ArrayList<>();
        List<WpPost> variationPosts = new ArrayList<>();
        List<WpPost> attachmentPosts = new ArrayList<>();
        List<WpPost> pagePosts = new ArrayList<>();
        List<WpPost> articlePosts = new ArrayList<>();
        List<WpPost> navMenuItemPosts = new ArrayList<>();
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

        // ── 4. Map products ───────────────────────────────────────────────────
        List<String> productWarnings = new ArrayList<>();
        Set<String> seenSkus = new HashSet<>();
        int productsMapped = 0, productsSkipped = 0;

        for (WpPost post : productPosts) {
            List<WpPostMeta> metas = metaByPost.getOrDefault(post.id(), List.of());
            WordPressProductMapper.MappedProduct mp = productMapper.map(post, metas);
            productWarnings.addAll(mp.warnings());

            if (mp.sku() != null && !mp.sku().isBlank()) {
                if (!seenSkus.add(mp.sku())) {
                    productWarnings.add("Duplicate SKU: " + mp.sku() + " (product id=" + post.id() + ")");
                }
            }
            boolean valid = mp.slug() != null && !mp.slug().isBlank()
                    && mp.name() != null && !mp.name().isBlank();
            if (valid) productsMapped++;
            else productsSkipped++;
        }

        // ── 5. Map variations ─────────────────────────────────────────────────
        List<String> variationWarnings = new ArrayList<>();
        int variationsMapped = 0, variationsDeferred = 0;
        for (WpPost post : variationPosts) {
            List<WpPostMeta> metas = metaByPost.getOrDefault(post.id(), List.of());
            WordPressVariationMapper.MappedVariation mv = variationMapper.map(post, metas);
            variationWarnings.addAll(mv.warnings());
            variationsMapped++;
        }

        // ── 6. Map categories ─────────────────────────────────────────────────
        List<String> categoryWarnings = new ArrayList<>();
        Set<String> seenCatSlugs = new HashSet<>();
        int categoriesMapped = 0, categoriesSkipped = 0;
        for (Map.Entry<Long, WpTermTaxonomy> entry : productCatByTermId.entrySet()) {
            WpTerm term = termsById.get(entry.getKey());
            if (term == null) { categoryWarnings.add("Term not found for term_id=" + entry.getKey()); categoriesSkipped++; continue; }
            WordPressCategoryMapper.MappedCategory mc = categoryMapper.map(term, entry.getValue());
            categoryWarnings.addAll(mc.warnings());
            if (mc.slug() != null && !seenCatSlugs.add(mc.slug())) {
                categoryWarnings.add("Duplicate category slug: " + mc.slug());
            }
            if (mc.warnings().isEmpty()) categoriesMapped++;
            else categoriesMapped++;
        }

        // ── 7. Map brands ─────────────────────────────────────────────────────
        List<String> brandWarnings = new ArrayList<>();
        Set<String> seenBrandSlugs = new HashSet<>();
        int brandsMapped = 0, brandsSkipped = 0;
        for (Map.Entry<Long, WpTermTaxonomy> entry : brandByTermId.entrySet()) {
            WpTerm term = termsById.get(entry.getKey());
            if (term == null) { brandWarnings.add("Term not found for brand term_id=" + entry.getKey()); brandsSkipped++; continue; }
            WordPressBrandMapper.MappedBrand mb = brandMapper.map(term, entry.getValue());
            brandWarnings.addAll(mb.warnings());
            if (mb.slug() != null && !seenBrandSlugs.add(mb.slug())) {
                brandWarnings.add("Duplicate brand slug: " + mb.slug());
            }
            brandsMapped++;
        }

        // ── 8. Map tags ───────────────────────────────────────────────────────
        int tagsSource = productTagByTermId.size();
        int tagsMapped = 0, tagsDeferred = 0;
        // Tags are deferred if target schema doesn't expose a product_tags table
        // For now, count them but report as deferred
        tagsDeferred = tagsSource;

        // ── 9. Map media ──────────────────────────────────────────────────────
        List<String> mediaWarnings = new ArrayList<>();
        int mediaMapped = 0, mediaSkipped = 0;
        for (WpPost post : attachmentPosts) {
            List<WpPostMeta> metas = metaByPost.getOrDefault(post.id(), List.of());
            String attachedFile = null;
            String serializedMeta = null;
            String altText = null;
            for (WpPostMeta m : metas) {
                switch (m.metaKey()) {
                    case "_wp_attached_file"       -> attachedFile = m.metaValue();
                    case "_wp_attachment_metadata" -> serializedMeta = m.metaValue();
                    case "_wp_attachment_image_alt" -> altText = m.metaValue();
                }
            }
            if (attachedFile == null || attachedFile.isBlank()) {
                mediaWarnings.add("Missing _wp_attached_file for attachment id=" + post.id());
                mediaSkipped++;
                continue;
            }
            WpAttachmentMeta att = new WpAttachmentMeta(
                    post.id(), attachedFile, post.postMimeType(),
                    altText, post.postTitle(), serializedMeta);
            WordPressMediaMapper.MappedMedia mm = mediaMapper.map(att);
            mediaWarnings.addAll(mm.warnings());
            mediaMapped++;
        }

        // ── 10. Map pages ─────────────────────────────────────────────────────
        List<String> pageWarnings = new ArrayList<>();
        Set<String> seenPageSlugs = new HashSet<>();
        int pagesMapped = 0, pagesSkipped = 0;
        for (WpPost post : pagePosts) {
            List<WpPostMeta> metas = metaByPost.getOrDefault(post.id(), List.of());
            WordPressPageMapper.MappedPage mp = pageMapper.map(post, metas);
            pageWarnings.addAll(mp.warnings());
            if (mp.slug() != null && !seenPageSlugs.add(mp.slug())) {
                pageWarnings.add("Duplicate page slug: " + mp.slug());
            }
            pagesMapped++;
        }

        // ── 11. Map articles ──────────────────────────────────────────────────
        List<String> articleWarnings = new ArrayList<>();
        Set<String> seenArticleSlugs = new HashSet<>();
        int articlesMapped = 0, articlesSkipped = 0;
        for (WpPost post : articlePosts) {
            List<WpPostMeta> metas = metaByPost.getOrDefault(post.id(), List.of());
            WordPressArticleMapper.MappedArticle ma = articleMapper.map(post, metas);
            articleWarnings.addAll(ma.warnings());
            if (ma.slug() != null && !seenArticleSlugs.add(ma.slug())) {
                articleWarnings.add("Duplicate article slug: " + ma.slug());
            }
            articlesMapped++;
        }

        // ── 12. Map menus ─────────────────────────────────────────────────────
        List<String> menuWarnings = new ArrayList<>();
        int menusSource = 0, menusMapped = 0, menusSkipped = 0;
        int menuItemsSource = navMenuItemPosts.size();
        int menuItemsMapped = 0, menuItemsSkipped = 0;

        // nav_menu terms
        List<WpTerm> navMenuTerms = navMenuByTermId.keySet().stream()
                .map(termsById::get)
                .filter(t -> t != null)
                .toList();
        menusSource = navMenuTerms.size();

        // Group nav_menu_item posts by their associated nav_menu term
        // (Each nav_menu_item post is related to a nav_menu term via kd_term_relationships)
        Map<Long, List<WpPost>> itemsByMenuTermId = new HashMap<>();
        for (WpPost item : navMenuItemPosts) {
            Set<Long> ttIds = relsByObject.getOrDefault(item.id(), Set.of());
            for (long ttId : ttIds) {
                WpTermTaxonomy tt = termTaxById.get(ttId);
                if (tt != null && "nav_menu".equals(tt.taxonomy())) {
                    itemsByMenuTermId.computeIfAbsent(tt.termId(), k -> new ArrayList<>()).add(item);
                }
            }
        }

        // All postmeta for nav_menu_items (flatten for menu mapper)
        List<WpPostMeta> allMenuItemMetas = new ArrayList<>();
        for (WpPost item : navMenuItemPosts) {
            allMenuItemMetas.addAll(metaByPost.getOrDefault(item.id(), List.of()));
        }

        for (WpTerm navTerm : navMenuTerms) {
            List<WpPost> items = itemsByMenuTermId.getOrDefault(navTerm.termId(), List.of());
            if (items.isEmpty()) { menusSkipped++; continue; }
            WordPressMenuMapper.MappedMenu mm = menuMapper.mapMenu(navTerm, items, allMenuItemMetas);
            for (WordPressMenuMapper.MappedMenuItem mi : mm.items()) {
                menuWarnings.addAll(mi.warnings());
                menuItemsMapped++;
            }
            // Detect parent cycle
            Set<Long> parentIds = new HashSet<>();
            for (WordPressMenuMapper.MappedMenuItem mi : mm.items()) {
                if (mi.parentSourceId() != null && !parentIds.add(mi.parentSourceId())) {
                    menuWarnings.add("Possible menu cycle for parent id=" + mi.parentSourceId()
                            + " in menu=" + navTerm.name());
                }
            }
            menusMapped++;
        }
        menuItemsSkipped = menuItemsSource - menuItemsMapped;

        // ── 13. Map RankMath redirects ────────────────────────────────────────
        List<String> rankMathWarnings = new ArrayList<>();
        Set<String> seenRedirectSources = new HashSet<>();
        int rankMathMapped = 0, rankMathSkipped = 0;
        for (WpRedirectRow row : rankMathRedirects) {
            WordPressRedirectMapper.MappedRedirect mr = redirectMapper.map(row);
            rankMathWarnings.addAll(mr.warnings());
            if (mr.sourcePattern() != null && mr.targetPattern() != null) {
                // Self-loop check
                if (mr.sourcePattern().equals(mr.targetPattern())) {
                    rankMathWarnings.add("Self-loop redirect: " + mr.sourcePattern());
                    rankMathSkipped++;
                    continue;
                }
                // Duplicate check
                if (!seenRedirectSources.add(mr.sourcePattern())) {
                    rankMathWarnings.add("Duplicate enabled redirect source: " + mr.sourcePattern());
                }
                rankMathMapped++;
            } else {
                rankMathSkipped++;
            }
        }

        // ── 14. Map fg_redirect rows ──────────────────────────────────────────
        List<String> fgWarnings = new ArrayList<>();
        int fgMapped = 0, fgSkipped = 0;
        for (WpFgRedirect fg : fgRedirects) {
            if (fg.oldUrl() == null || fg.oldUrl().isBlank()) {
                fgWarnings.add("Missing source for fg_redirect targetPostId=" + fg.targetPostId());
                fgSkipped++;
                continue;
            }
            if (!fg.activated()) {
                fgSkipped++;
                continue;
            }
            fgMapped++;
        }

        // ── 15. Parse permalink-manager_uris ──────────────────────────────────
        String permalinkSerialized = optionsMap.get("permalink-manager_uris");
        WordPressPermalinkManagerMapper.ParsedPermalinkMap pm =
                permalinkMapper.parse(permalinkSerialized);

        // ── 16. Assemble result ───────────────────────────────────────────────
        return CatalogContentDryRunResult.builder(dumpPath)
                .products(productPosts.size(), productsMapped, productsSkipped, productWarnings)
                .variations(variationPosts.size(), variationsMapped, variationsDeferred, variationWarnings)
                .categories(productCatByTermId.size(), categoriesMapped, categoriesSkipped, categoryWarnings)
                .brands(brandByTermId.size(), brandsMapped, brandsSkipped, brandWarnings)
                .tags(tagsSource, tagsMapped, tagsDeferred)
                .media(attachmentPosts.size(), mediaMapped, mediaSkipped, mediaWarnings)
                .pages(pagePosts.size(), pagesMapped, pagesSkipped, pageWarnings)
                .articles(articlePosts.size(), articlesMapped, articlesSkipped, articleWarnings)
                .menus(menusSource, menusMapped, menusSkipped,
                        menuItemsSource, menuItemsMapped, menuItemsSkipped, menuWarnings)
                .rankMathRedirects(rankMathRedirects.size(), rankMathMapped, rankMathSkipped, rankMathWarnings)
                .fgRedirects(fgRedirects.size(), fgMapped, fgSkipped, fgWarnings)
                .permalinkManager(pm.entries().size(), pm.entries().size(),
                        pm.warnings(), pm.conflicts())
                .streamingWarnings(streamingWarnings)
                .build();
    }

    // ── Row converters ────────────────────────────────────────────────────────

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
        } catch (Exception e) {
            return null;
        }
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

    private WpTerm toWpTerm(WordPressTableRow row) {
        try {
            return new WpTerm(
                    row.getLong("term_id", 0),
                    nvl(row.get("name")),
                    nvl(row.get("slug")),
                    row.getLong("term_group", 0)
            );
        } catch (Exception e) { return null; }
    }

    private WpTermTaxonomy toWpTermTaxonomy(WordPressTableRow row) {
        try {
            return new WpTermTaxonomy(
                    row.getLong("term_taxonomy_id", 0),
                    row.getLong("term_id", 0),
                    nvl(row.get("taxonomy")),
                    nvl(row.get("description")),
                    row.getLong("parent", 0),
                    row.getLong("count", 0)
            );
        } catch (Exception e) { return null; }
    }

    private com.bigbike.bigbike_backend.migration.wordpress.model.WpTermRelationship toWpTermRelationship(WordPressTableRow row) {
        try {
            return new com.bigbike.bigbike_backend.migration.wordpress.model.WpTermRelationship(
                    row.getLong("object_id", 0),
                    row.getLong("term_taxonomy_id", 0),
                    row.getInt("term_order", 0)
            );
        } catch (Exception e) { return null; }
    }

    private WpRedirectRow toRankMathRedirect(WordPressTableRow row) {
        try {
            String sources = row.get("sources");
            return new WpRedirectRow(
                    row.getLong("id", 0),
                    sources,
                    nvl(row.get("url_to")),
                    row.getInt("header_code", 301),
                    nvl(row.get("status")),
                    WordPressRedirectMapper.parseFirstSourcePattern(sources)
            );
        } catch (Exception e) { return null; }
    }

    private WpFgRedirect toFgRedirect(WordPressTableRow row) {
        try {
            // fg_redirect column names vary — try common names
            String oldUrl = firstNonNull(row.get("old_url"), row.get("redirect_url"),
                    row.get("source"), row.get("from_url"));
            String newUrl = firstNonNull(row.get("new_url"), row.get("redirect_to"),
                    row.get("target"), row.get("to_url"), row.get("url"));
            int code = row.getInt("redirect_type", 301);
            if (code != 301 && code != 302) code = 301;
            return new WpFgRedirect(row.getLong("ID", row.getLong("id", 0)), oldUrl, newUrl, code);
        } catch (Exception e) { return null; }
    }

    private WpOption toWpOption(WordPressTableRow row) {
        try {
            return new WpOption(
                    row.getLong("option_id", 0),
                    row.get("option_name"),
                    row.get("option_value"),
                    row.get("autoload")
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

    private String firstNonNull(String... candidates) {
        for (String s : candidates) if (s != null) return s;
        return null;
    }
}
