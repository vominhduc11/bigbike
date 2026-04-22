package com.bigbike.bigbike_backend.migration.wordpress.normalizer;

import com.bigbike.bigbike_backend.persistence.entity.catalog.CategoryEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.CategoryJpaRepository;
import java.time.Instant;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Ensures the "uncategorized" fallback category exists and returns its slug.
 *
 * Products with no category mapping in WordPress are assigned to "uncategorized"
 * rather than being silently skipped. This is the only fallback category allowed —
 * never assign a random or incorrect category.
 */
@Component
public class ProductCategoryResolver {

    private static final Logger log = LoggerFactory.getLogger(ProductCategoryResolver.class);

    static final String UNCATEGORIZED_SLUG = "uncategorized";
    static final String UNCATEGORIZED_NAME = "Uncategorized";

    private final CategoryJpaRepository categoryRepo;

    public ProductCategoryResolver(CategoryJpaRepository categoryRepo) {
        this.categoryRepo = categoryRepo;
    }

    /**
     * Ensures the "uncategorized" category exists in the DB.
     * Idempotent — safe to call multiple times.
     * Returns the slug of the fallback category.
     */
    @Transactional
    public String ensureUncategorized() {
        categoryRepo.findBySlug(UNCATEGORIZED_SLUG).orElseGet(() -> {
            log.info("Creating fallback category slug='uncategorized'");
            CategoryEntity c = new CategoryEntity();
            c.setId(UNCATEGORIZED_SLUG);
            c.setSlug(UNCATEGORIZED_SLUG);
            c.setName(UNCATEGORIZED_NAME);
            c.setVisible(true);
            c.setCreatedAt(Instant.now());
            c.setUpdatedAt(Instant.now());
            return categoryRepo.save(c);
        });
        return UNCATEGORIZED_SLUG;
    }
}
