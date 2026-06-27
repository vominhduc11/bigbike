package com.bigbike.bigbike_backend.repository.catalog;

import com.bigbike.bigbike_backend.domain.catalog.Brand;
import com.bigbike.bigbike_backend.domain.catalog.Category;
import com.bigbike.bigbike_backend.domain.catalog.Product;
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
     * Admin language-toggle brand list. When {@code strictEnglish} is true, only
     * brands with a non-blank {@code name_en} are returned (NO Vietnamese fallback)
     * — used by the admin VI/EN switch. Public/web keeps {@link #findAllBrands(String)}.
     */
    List<Brand> findAllBrands(String locale, boolean strictEnglish);

    List<Brand> findAllBrands();

    Optional<Brand> findBrandBySlug(String slug);

    /** Public locale-aware brand lookup. */
    Optional<Brand> findBrandBySlug(String slug, String locale);

    Optional<Brand> findBrandById(String id);
}
