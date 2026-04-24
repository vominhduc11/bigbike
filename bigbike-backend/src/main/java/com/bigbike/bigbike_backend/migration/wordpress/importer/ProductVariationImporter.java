package com.bigbike.bigbike_backend.migration.wordpress.importer;

import com.bigbike.bigbike_backend.domain.catalog.ProductStockState;
import com.bigbike.bigbike_backend.migration.wordpress.mapper.WordPressVariationMapper.MappedVariation;
import com.bigbike.bigbike_backend.migration.wordpress.writeplan.MigrationDomain;
import com.bigbike.bigbike_backend.persistence.entity.catalog.CategoryEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.AttributeEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.AttributeValueEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVariantEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVariantOptionEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.CategoryJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.AttributeJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.AttributeValueJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductVariantJpaRepository;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicInteger;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Idempotent product variation importer.
 * Variant ID is deterministic: "wp-var-{sourceId}" â€” no @GeneratedValue used.
 * Parent product is required; variations with missing parent get a placeholder parent so no source row is dropped.
 * Options are fully replaced on each run via orphanRemoval=true.
 */
@Component
public class ProductVariationImporter implements DomainImporter {

    private final ProductVariantJpaRepository variantRepo;
    private final ProductJpaRepository productRepo;
    private final CategoryJpaRepository categoryRepo;
    private final AttributeJpaRepository attributeRepo;
    private final AttributeValueJpaRepository attributeValueRepo;

    public ProductVariationImporter(
            ProductVariantJpaRepository variantRepo,
            ProductJpaRepository productRepo,
            CategoryJpaRepository categoryRepo,
            AttributeJpaRepository attributeRepo,
            AttributeValueJpaRepository attributeValueRepo) {
        this.variantRepo = variantRepo;
        this.productRepo = productRepo;
        this.categoryRepo = categoryRepo;
        this.attributeRepo = attributeRepo;
        this.attributeValueRepo = attributeValueRepo;
    }

    @Override
    public MigrationDomain domain() {
        return MigrationDomain.PRODUCT_VARIATIONS;
    }

    @Override
    public MigrationExecutionReport.DomainResult execute(MigrationExecutionOptions options) {
        throw new UnsupportedOperationException("Use importBatch()");
    }

    @Transactional
    public MigrationExecutionReport.DomainResult importBatch(
            List<MappedVariation> items, MigrationExecutionOptions options) {

        int inserted = 0, updated = 0, skipped = 0, failed = 0;
        List<String> warnings = new ArrayList<>();
        List<String> errors = new ArrayList<>();

        for (MappedVariation mv : items) {
            try {
                String variantId = "wp-var-" + mv.sourceId();
                String parentProductId = "wp-prod-" + mv.parentProductId();

                Optional<ProductEntity> parentOpt = productRepo.findById(parentProductId);
                if (parentOpt.isEmpty()) {
                    ProductEntity placeholder = createPlaceholderParent(mv.parentProductId(), options.dryRun());
                    if (!options.dryRun()) {
                        placeholder = productRepo.save(placeholder);
                    }
                    warnings.add("Created placeholder parent product for variation sourceId=" + mv.sourceId()
                            + " (parentProductId=" + mv.parentProductId() + ")");
                    parentOpt = Optional.of(placeholder);
                }
                ProductEntity parent = parentOpt.get();

                Optional<ProductVariantEntity> existing = variantRepo.findById(variantId);
                ProductVariantEntity entity = existing.orElseGet(ProductVariantEntity::new);
                boolean isNew = existing.isEmpty();
                if (isNew) {
                    entity.setId(variantId);
                }

                entity.setProduct(parent);
                entity.setSku(mv.sku());
                entity.setName(buildName(mv));

                BigDecimal retailPrice = mv.price() != null ? mv.price() : mv.regularPrice();
                BigDecimal compareAtPrice = mv.regularPrice();
                BigDecimal salePrice = mv.salePrice();
                entity.setRetailPrice(retailPrice != null && retailPrice.signum() > 0 ? retailPrice : null);
                entity.setCompareAtPrice(compareAtPrice != null && compareAtPrice.signum() > 0 ? compareAtPrice : null);
                entity.setSalePrice(salePrice != null && salePrice.signum() > 0 ? salePrice : null);
                entity.setCurrency("VND");

                ProductStockState stockState = resolveStockState(mv.stockStatus());
                entity.setStockState(stockState);
                entity.setAvailable("ACTIVE".equals(mv.status()) && stockState == ProductStockState.IN_STOCK);
                entity.setSortOrder(0);

                warnings.addAll(mv.warnings());

                if (!options.dryRun()) {
                    entity = variantRepo.save(entity);
                    List<ProductVariantOptionEntity> optionsList = buildOptions(entity, mv.attributes());
                    if (entity.getOptions() == null) {
                        entity.setOptions(new ArrayList<>());
                    } else {
                        entity.getOptions().clear();
                    }
                    entity.getOptions().addAll(optionsList);
                    variantRepo.save(entity);
                }

                if (isNew) inserted++; else updated++;
            } catch (Exception e) {
                failed++;
                errors.add("Variation sourceId=" + mv.sourceId() + ": " + e.getMessage());
                if (options.failFast()) {
                    throw new RuntimeException(errors.get(errors.size() - 1), e);
                }
            }
        }

        return new MigrationExecutionReport.DomainResult(
                MigrationDomain.PRODUCT_VARIATIONS, inserted, updated, skipped, failed, warnings, errors);
    }

    private ProductEntity createPlaceholderParent(long sourceParentId, boolean dryRun) {
        ProductEntity entity = new ProductEntity();
        entity.setId("wp-prod-" + sourceParentId);
        entity.setLegacyId(String.valueOf(sourceParentId));
        entity.setSlug("orphan-product-" + sourceParentId);
        entity.setName("Imported WP product " + sourceParentId);
        entity.setShortDescription("");
        entity.setDescription("");
        CategoryEntity category = categoryRepo.findBySlug("uncategorized").orElseGet(() -> {
            CategoryEntity fallback = new CategoryEntity();
            fallback.setId("wp-cat-uncategorized");
            fallback.setSlug("uncategorized");
            fallback.setName("Uncategorized");
            fallback.setVisible(true);
            fallback.setCreatedAt(Instant.now());
            fallback.setUpdatedAt(Instant.now());
            if (dryRun) {
                return fallback;
            }
            return categoryRepo.save(fallback);
        });
        entity.setCategory(category);
        entity.setCategories(new java.util.LinkedHashSet<>(java.util.Set.of(category)));
        entity.setRetailPrice(BigDecimal.ZERO);
        entity.setCurrency("VND");
        entity.setStockState(ProductStockState.IN_STOCK);
        entity.setPublishStatus(com.bigbike.bigbike_backend.domain.catalog.PublishStatus.DRAFT);
        entity.setFeatured(false);
        entity.setShowOnHomepage(false);
        entity.setCreatedAt(Instant.now());
        entity.setUpdatedAt(Instant.now());
        return entity;
    }

    private String buildName(MappedVariation mv) {
        if (mv.attributes() == null || mv.attributes().isEmpty()) {
            return "Biến thể " + mv.sourceId();
        }
        StringBuilder sb = new StringBuilder();
        for (Map.Entry<String, String> e : mv.attributes().entrySet()) {
            if (sb.length() > 0) sb.append(", ");
            sb.append(e.getKey()).append(": ").append(e.getValue());
        }
        return sb.toString();
    }

    private List<ProductVariantOptionEntity> buildOptions(
            ProductVariantEntity variant, Map<String, String> attributes) {
        if (attributes == null || attributes.isEmpty()) {
            return new ArrayList<>();
        }
        List<ProductVariantOptionEntity> result = new ArrayList<>();
        AtomicInteger sort = new AtomicInteger(0);
        for (Map.Entry<String, String> entry : attributes.entrySet()) {
            String code = normalizeAttributeCode(entry.getKey());
            String valueSlug = entry.getValue() == null ? "" : entry.getValue().trim();
            AttributeEntity attribute = resolveAttribute(code);
            AttributeValueEntity attributeValue = resolveAttributeValue(attribute, valueSlug);

            ProductVariantOptionEntity opt = new ProductVariantOptionEntity();
            opt.setVariant(variant);
            opt.setAttribute(attribute);
            opt.setAttributeValue(attributeValue);
            opt.setOptionName(code);
            opt.setOptionValue(valueSlug);
            opt.setSortOrder(sort.getAndIncrement());
            result.add(opt);
        }
        return result;
    }

    private AttributeEntity resolveAttribute(String code) {
        if (code == null || code.isBlank()) {
            return null;
        }
        return attributeRepo.findByCode(code).orElseGet(() -> {
            AttributeEntity entity = new AttributeEntity();
            entity.setId("wp-attr-auto-" + code);
            entity.setCode(code);
            entity.setName(humanize(code));
            entity.setKind("select");
            entity.setVariation(true);
            return attributeRepo.save(entity);
        });
    }

    private AttributeValueEntity resolveAttributeValue(AttributeEntity attribute, String valueSlug) {
        String normalizedSlug = normalizeSlug(valueSlug);
        if (attribute == null || normalizedSlug == null) {
            return null;
        }
        return attributeValueRepo.findByAttributeIdAndSlug(attribute.getId(), normalizedSlug).orElseGet(() -> {
            AttributeValueEntity entity = new AttributeValueEntity();
            entity.setId("wp-attr-value-" + attribute.getCode() + "-" + normalizedSlug);
            entity.setAttribute(attribute);
            entity.setSlug(normalizedSlug);
            entity.setLabel(valueSlug == null ? normalizedSlug : valueSlug.trim());
            entity.setSortOrder(0);
            return attributeValueRepo.save(entity);
        });
    }

    private String normalizeSlug(String value) {
        if (value == null) {
            return null;
        }
        String normalized = value.trim().toLowerCase();
        if (normalized.isBlank()) {
            return null;
        }
        normalized = normalized.replaceAll("[^a-z0-9]+", "-");
        normalized = normalized.replaceAll("(^-|-$)", "");
        return normalized.isBlank() ? null : normalized;
    }

    private String normalizeAttributeCode(String raw) {
        if (raw == null) {
            return null;
        }
        String normalized = raw.trim().toLowerCase();
        if (normalized.startsWith("attribute_")) {
            normalized = normalized.substring("attribute_".length());
        }
        if (normalized.startsWith("pa_")) {
            normalized = normalized.substring(3);
        }
        return normalized;
    }

    private String humanize(String code) {
        String value = code.replace('-', ' ').replace('_', ' ');
        if (value.isBlank()) {
            return code;
        }
        return Character.toUpperCase(value.charAt(0)) + value.substring(1);
    }

    private ProductStockState resolveStockState(String stockStatus) {
        if (stockStatus == null) return ProductStockState.IN_STOCK;
        return switch (stockStatus.toLowerCase()) {
            case "outofstock", "out_of_stock" -> ProductStockState.OUT_OF_STOCK;
            case "onbackorder" -> ProductStockState.PREORDER;
            default -> ProductStockState.IN_STOCK;
        };
    }
}
