package com.bigbike.bigbike_backend.service.order;

import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderLineItemEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * Resolves order line-item thumbnails without per-item catalog queries.
 *
 * <p>The checkout snapshot is authoritative. Only legacy rows without that snapshot use a
 * single batch lookup against the current catalog image.</p>
 */
@Service
@RequiredArgsConstructor
public class OrderLineItemThumbnailResolver {

    private final ProductJpaRepository productRepo;

    /**
     * Loads current catalog images only when at least one line item lacks its checkout snapshot.
     * The returned map is keyed by {@code product_pk} and is safe to reuse for every line item in
     * one order detail response.
     */
    public Map<String, String> resolveLiveFallbacks(List<OrderLineItemEntity> lineItems) {
        boolean anyMissingSnapshot = lineItems.stream()
                .anyMatch(item -> isBlank(item.getImageUrl()));
        if (!anyMissingSnapshot) {
            return Map.of();
        }

        List<String> productPks = lineItems.stream()
                .map(OrderLineItemEntity::getProductPk)
                .filter(pk -> !isBlank(pk))
                .distinct()
                .toList();
        if (productPks.isEmpty()) {
            return Map.of();
        }

        Map<String, String> thumbnailsByPk = new HashMap<>();
        for (Object[] row : productRepo.findImageUrlsByIds(productPks)) {
            if (row[1] != null && !isBlank((String) row[1])) {
                thumbnailsByPk.put((String) row[0], (String) row[1]);
            }
        }
        return thumbnailsByPk;
    }

    /** Returns the checkout snapshot, or the batch-resolved legacy fallback when it is absent. */
    public String resolveThumbnail(OrderLineItemEntity lineItem, Map<String, String> liveFallbacks) {
        return isBlank(lineItem.getImageUrl())
                ? liveFallbacks.get(lineItem.getProductPk())
                : lineItem.getImageUrl();
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
