package com.bigbike.bigbike_backend.service.inventory;

import com.bigbike.bigbike_backend.domain.catalog.ProductStockState;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVariantEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import com.bigbike.bigbike_backend.service.inventory.InventoryOutOfStockDigest.Counts;
import com.bigbike.bigbike_backend.service.inventory.InventoryOutOfStockDigest.PartialProductItem;
import com.bigbike.bigbike_backend.service.inventory.InventoryOutOfStockDigest.ProductItem;
import com.bigbike.bigbike_backend.service.inventory.InventoryOutOfStockDigest.VariantItem;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class InventoryOutOfStockDigestService {

    static final ZoneId VIETNAM_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    private static final Comparator<ProductItem> FULL_ORDER = Comparator
            .comparing(ProductItem::outOfStockSince)
            .thenComparing(ProductItem::nameVi, String.CASE_INSENSITIVE_ORDER);
    private static final Comparator<VariantItem> VARIANT_ORDER = Comparator
            .comparing(VariantItem::outOfStockSince)
            .thenComparing(VariantItem::nameVi, String.CASE_INSENSITIVE_ORDER);
    private static final Comparator<PartialProductItem> PARTIAL_ORDER = Comparator
            .comparing(PartialProductItem::outOfStockSince)
            .thenComparing(PartialProductItem::nameVi, String.CASE_INSENSITIVE_ORDER);

    private final ProductJpaRepository productRepository;

    @Transactional(readOnly = true)
    public InventoryOutOfStockDigest build(LocalDate digestDate, Instant generatedAt) {
        List<ProductItem> full = new ArrayList<>();
        List<PartialProductItem> partial = new ArrayList<>();
        int unavailableVariantCount = 0;

        for (ProductEntity product : productRepository
                .findOutOfStockDigestCandidates(PublishStatus.PUBLISHED)) {
            // Keep the business boundary explicit even if a future repository refactor drifts.
            if (product.getPublishStatus() != PublishStatus.PUBLISHED || product.isDiscontinued()) {
                continue;
            }
            List<ProductVariantEntity> variants = product.getVariants() == null
                    ? List.of()
                    : product.getVariants();

            if (variants.isEmpty()) {
                if (product.getStockState() == ProductStockState.OUT_OF_STOCK) {
                    full.add(toFullProduct(product, digestDate, generatedAt));
                }
                continue;
            }

            List<ProductVariantEntity> unavailable = variants.stream()
                    .filter(variant -> !variant.isAvailable())
                    .toList();
            unavailableVariantCount += unavailable.size();
            if (unavailable.isEmpty()) {
                continue;
            }
            if (unavailable.size() == variants.size()) {
                full.add(toFullProduct(product, digestDate, generatedAt));
            } else {
                partial.add(toPartialProduct(product, unavailable, digestDate, generatedAt));
            }
        }

        full.sort(FULL_ORDER);
        partial.sort(PARTIAL_ORDER);
        return new InventoryOutOfStockDigest(
                InventoryOutOfStockDigest.SCHEMA_VERSION,
                digestDate,
                generatedAt,
                new Counts(full.size(), partial.size(), unavailableVariantCount),
                List.copyOf(full),
                List.copyOf(partial));
    }

    private ProductItem toFullProduct(ProductEntity product, LocalDate digestDate, Instant generatedAt) {
        Age age = age(product.getOutOfStockSince(), product.isOutOfStockSinceEstimated(), digestDate, generatedAt);
        return new ProductItem(
                product.getId(),
                display(product.getName(), product.getId()),
                display(product.getNameEn(), product.getName()),
                display(product.getSku(), "—"),
                editPath(product.getId()),
                age.since(),
                age.days(),
                age.estimated());
    }

    private PartialProductItem toPartialProduct(
            ProductEntity product,
            List<ProductVariantEntity> unavailable,
            LocalDate digestDate,
            Instant generatedAt
    ) {
        List<VariantItem> variantItems = unavailable.stream()
                .map(variant -> toVariant(variant, digestDate, generatedAt))
                .sorted(VARIANT_ORDER)
                .toList();
        VariantItem oldest = variantItems.get(0);
        return new PartialProductItem(
                product.getId(),
                display(product.getName(), product.getId()),
                display(product.getNameEn(), product.getName()),
                display(product.getSku(), "—"),
                editPath(product.getId()),
                oldest.outOfStockSince(),
                oldest.outOfStockDays(),
                oldest.outOfStockSinceEstimated(),
                variantItems);
    }

    private VariantItem toVariant(ProductVariantEntity variant, LocalDate digestDate, Instant generatedAt) {
        Age age = age(variant.getOutOfStockSince(), variant.isOutOfStockSinceEstimated(), digestDate, generatedAt);
        String name = display(variant.getName(), variant.getId());
        return new VariantItem(
                variant.getId(),
                name,
                name,
                display(variant.getSku(), "—"),
                age.since(),
                age.days(),
                age.estimated());
    }

    private static Age age(Instant since, boolean estimated, LocalDate digestDate, Instant generatedAt) {
        Instant effectiveSince = since == null ? generatedAt : since;
        boolean effectiveEstimated = since == null || estimated;
        LocalDate sinceDate = effectiveSince.atZone(VIETNAM_ZONE).toLocalDate();
        long days = Math.max(0, ChronoUnit.DAYS.between(sinceDate, digestDate));
        return new Age(effectiveSince, days, effectiveEstimated);
    }

    private static String editPath(String productId) {
        return "/admin/products/" + productId;
    }

    private static String display(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value.trim();
    }

    private record Age(Instant since, long days, boolean estimated) {}
}
