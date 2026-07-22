package com.bigbike.bigbike_backend.repository.catalog;

import com.bigbike.bigbike_backend.domain.catalog.Brand;
import com.bigbike.bigbike_backend.domain.catalog.Category;
import com.bigbike.bigbike_backend.domain.catalog.HomepageBlock;
import com.bigbike.bigbike_backend.domain.catalog.Product;
import com.bigbike.bigbike_backend.service.common.SortSpec;
import java.util.List;
import java.util.Optional;

public interface CatalogReadRepository {

    List<Product> findAllProducts();

    /**
     * PUBLISHED products only, in public view. The public catalog endpoints
     * (listing, facets, global search) all discard non-PUBLISHED rows, so the
     * status filter is pushed to SQL here — the result is identical to
     * {@code findAllProducts()} filtered to PUBLISHED, but the deep entity
     * graph of DRAFT/TRASH products is never materialised.
     *
     * @param locale {@code "vi"} or {@code "en"}; English content falls back
     *               to Vietnamese field-by-field (see {@code PRODUCT_RULE_002}).
     */
    List<Product> findAllPublishedProducts(String locale);

    /**
     * Same rows as {@link #findAllPublishedProducts(String)} but hydrated with the
     * lighter "listing" projection: skips gallery, videos, specifications, faqs,
     * commitments, specStats, trustBadges, highlights, related/accessory products
     * and variant gallery — none of that survives {@code CatalogReadSupport.toListView()}
     * anyway, so loading it just to discard it wastes a lazy-collection batch fetch per
     * relation on every list/facets request. Keeps variant + options (needed for color
     * filter/facets) and every field the list/facets endpoints actually read.
     */
    List<Product> findAllPublishedProductsForListing(String locale);

    /**
     * Real SQL LIMIT/OFFSET pagination for the storefront product list — filter/sort
     * pushed to the database via {@link org.springframework.data.jpa.domain.Specification},
     * only the current page's rows are hydrated (via the listing projection). Covers every
     * {@code listProducts} filter except color: color matching needs per-variant-option
     * Vietnamese-diacritic-aware normalization ({@code CatalogReadSupport.colorBaseSlug})
     * that isn't SQL-pushable without a dedicated indexed/denormalized color column — callers
     * fall back to {@link #findAllPublishedProductsForListing(String)} + in-memory filtering
     * when a color filter is active. {@code sortField} "homepageOrder" also falls back (its
     * nulls-last-pin + reversed-only-inside-pinned-section tie-break isn't a plain column sort).
     */
    ProductListingPage findPublishedProductsPaged(
            String categorySlug,
            String brandSlug,
            String q,
            String gender,
            Long minPrice,
            Long maxPrice,
            HomepageBlock homepageBlock,
            SortSpec sortSpec,
            int page,
            int size,
            String locale
    );

    record ProductListingPage(List<Product> items, long totalItems) {}

    /**
     * DB-level token-AND search against name + shortDescription.
     * Each token must match at least one field — "ba lo" → ["ba","lo"] finds "balo".
     */
    List<Product> searchPublishedProducts(java.util.List<String> tokens, String locale, int limit);

    /**
     * Admin product list (all statuses). {@code locale} = {@code "vi"} or
     * {@code "en"}; the display {@code name} falls back to Vietnamese when
     * {@code name_en} is blank (see {@code PRODUCT_RULE_002}).
     */
    List<Product> findProductsFiltered(String query, String publishStatus, String stockState, String brandId, String categoryId, String locale);

    Optional<Product> findProductBySlug(String slug, String locale);

    Optional<Product> findProductById(String id);

    Optional<Product> findProductByIdPublicView(String id, String locale);

    /**
     * Same row as {@link #findProductBySlug(String, String)} but hydrated with the lighter
     * "listing" projection (see {@link #findAllPublishedProductsForListing(String)}) — used by
     * the pricing/stock snapshot endpoint, which only ever reads price/stock/variant+options
     * and has no business reading gallery/videos/specifications/faqs/commitments/specStats/
     * trustBadges/highlights/related/accessory.
     */
    Optional<Product> findProductBySlugForListing(String slug, String locale);

    /** Snapshot counterpart of {@link #findProductByIdPublicView(String, String)}. */
    Optional<Product> findProductByIdPublicViewForListing(String id, String locale);

    /** Batch public-view lookup by id. Order of the result is not guaranteed; callers re-order. */
    List<Product> findProductsByIdsPublicView(List<String> ids, String locale);

    /** Public locale-aware category list (localized name/description/seo, no translations object). */
    List<Category> findAllCategories(String locale);

    /**
     * Admin language-toggle category list. When {@code strictEnglish} is true,
     * only categories with a non-blank {@code name_en} are returned (NO Vietnamese
     * fallback) — used by the admin VI/EN switch so untranslated rows are hidden.
     * Public/web reads keep using {@link #findAllCategories(String)} (fallback).
     */
    List<Category> findAllCategories(String locale, boolean strictEnglish);

    List<Category> findAllCategories();

    /**
     * Paged + filtered category lookup. The filter/sort are pushed down to
     * SQL when a JPA backend is active, so admin list pages don't load the
     * full table into the JVM. The mock backend uses a stream-based fallback.
     *
     * @param query        case-insensitive substring matched against name/slug; null/blank = no filter
     * @param visibility   "VISIBLE", "HIDDEN", or null/blank = both
     * @param sortField    one of "name", "createdAt", "updatedAt", "sortOrder"
     * @param sortAsc      true = ASC, false = DESC
     * @param page         1-indexed
     * @param pageSize     items per page
     * @param locale       "vi" or "en"; display name falls back to Vietnamese
     *                     when name_en is blank (CATEGORY_RULE_002)
     */
    CategoryPage findCategoriesPaged(
            String query,
            String visibility,
            Boolean deleted,
            String sortField,
            boolean sortAsc,
            int page,
            int pageSize,
            String locale
    );

    record CategoryPage(List<Category> items, long totalItems) {}

    Optional<Category> findCategoryBySlug(String slug);

    /** Public locale-aware category lookup. */
    Optional<Category> findCategoryBySlug(String slug, String locale);

    Optional<Category> findCategoryById(String id);

    /** Public locale-aware brand list (localized name/description/seo, no translations object). */
    List<Brand> findAllBrands(String locale);

    /**
     * Admin language-toggle brand list. {@code strictEnglish} is retained for the
     * shared catalog interface, but brand names/slugs are shared across VI/EN
     * (BRAND_RULE_001/003), so brands are not filtered by {@code name_en}.
     */
    List<Brand> findAllBrands(String locale, boolean strictEnglish);

    List<Brand> findAllBrands();

    Optional<Brand> findBrandBySlug(String slug);

    /** Public locale-aware brand lookup; accepts legacy {@code slug_en}, but brand response uses shared {@code slug}. */
    Optional<Brand> findBrandBySlug(String slug, String locale);

    Optional<Brand> findBrandById(String id);
}
