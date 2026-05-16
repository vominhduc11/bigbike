package com.bigbike.bigbike_backend.migration.wordpress.redirect;

import com.bigbike.bigbike_backend.migration.wordpress.mapper.WordPressRedirectMapper.MappedRedirect;
import com.bigbike.bigbike_backend.persistence.entity.catalog.BrandEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.CategoryEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.BrandJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.CategoryJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * Generates fallback 301 redirects from WordPress legacy URL patterns to new system URLs.
 *
 * Rules (applied in priority order — first match wins):
 *   Products  : /{slug}.html       → /product/{slug}/
 *   Brands    : /brand/{slug}      → /brands/{slug}
 *   Categories: /{slug}.html       → /danh-muc-san-pham/{slug}
 *
 * If a product and a category share the same slug, the product source pattern wins
 * and the category redirect is skipped (conflict counted).
 *
 * Self-loops (source == target) are always skipped.
 */
@Component
@Slf4j
@RequiredArgsConstructor
public class LegacyUrlMapper {

    static final String PRODUCT_HTML_SUFFIX = ".html";
    static final String PRODUCT_TARGET_PREFIX = "/product/";
    static final String PRODUCT_TARGET_SUFFIX = "/";
    static final String BRAND_SOURCE_PREFIX = "/brand/";
    static final String BRAND_TARGET_PREFIX = "/brands/";
    static final String CATEGORY_TARGET_PREFIX = "/danh-muc-san-pham/";

    private final ProductJpaRepository productRepo;
    private final BrandJpaRepository brandRepo;
    private final CategoryJpaRepository categoryRepo;

    public record MappingResult(
            List<MappedRedirect> redirects,
            int productCount,
            int brandCount,
            int categoryCount,
            int selfLoopSkipped,
            int conflictSkipped) {}

    /**
     * Generate fallback redirects from current DB state.
     * Idempotent — same DB state always produces the same output list.
     */
    public MappingResult generateFallbacks() {
        List<MappedRedirect> redirects = new ArrayList<>();
        Set<String> seenSources = new HashSet<>();
        int productCount = 0, brandCount = 0, categoryCount = 0;
        int selfLoops = 0, conflicts = 0;

        // 1. Products: /{slug}.html → /product/{slug}/
        for (ProductEntity product : productRepo.findAll()) {
            String slug = product.getSlug();
            if (slug == null || slug.isBlank()) continue;
            String source = "/" + slug + PRODUCT_HTML_SUFFIX;
            String target = PRODUCT_TARGET_PREFIX + slug + PRODUCT_TARGET_SUFFIX;
            if (source.equals(target)) { selfLoops++; continue; }
            if (seenSources.contains(source)) { conflicts++; continue; }
            seenSources.add(source);
            redirects.add(new MappedRedirect(0L, source, target, 301, true, List.of()));
            productCount++;
        }

        // 2. Brands: /brand/{slug} → /brands/{slug}
        for (BrandEntity brand : brandRepo.findAll()) {
            String slug = brand.getSlug();
            if (slug == null || slug.isBlank()) continue;
            String source = BRAND_SOURCE_PREFIX + slug;
            String target = BRAND_TARGET_PREFIX + slug;
            if (source.equals(target)) { selfLoops++; continue; }
            if (seenSources.contains(source)) { conflicts++; continue; }
            seenSources.add(source);
            redirects.add(new MappedRedirect(0L, source, target, 301, true, List.of()));
            brandCount++;
        }

        // 3. Categories: /{slug}.html → /danh-muc-san-pham/{slug}
        // Product slugs take priority — if source pattern already claimed by a product, skip.
        for (CategoryEntity cat : categoryRepo.findAll()) {
            String slug = cat.getSlug();
            if (slug == null || slug.isBlank()) continue;
            String source = "/" + slug + PRODUCT_HTML_SUFFIX;
            String target = CATEGORY_TARGET_PREFIX + slug;
            if (source.equals(target)) { selfLoops++; continue; }
            if (seenSources.contains(source)) { conflicts++; continue; }
            seenSources.add(source);
            redirects.add(new MappedRedirect(0L, source, target, 301, true, List.of()));
            categoryCount++;
        }

        log.info("LegacyUrlMapper: products={} brands={} categories={} selfLoops={} conflicts={}",
                productCount, brandCount, categoryCount, selfLoops, conflicts);

        return new MappingResult(redirects, productCount, brandCount, categoryCount, selfLoops, conflicts);
    }
}
