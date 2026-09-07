package com.bigbike.bigbike_backend.service.catalog;

import com.bigbike.bigbike_backend.persistence.entity.commerce.cart.CartItemEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderLineItemEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Enriches commerce responses in one query without changing stored selling snapshots. */
@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class ProductAnalyticsResolver {
    private final ProductJpaRepository productRepo;

    public record Metadata(String brandName, String categoryName) {}

    public Map<UUID, Metadata> forCartItems(List<CartItemEntity> items) {
        return resolve(items, CartItemEntity::getId, item ->
                item.getProductPk() != null && !item.getProductPk().isBlank()
                        ? item.getProductPk()
                        : item.getProductId() == null ? null : item.getProductId().toString());
    }

    public Map<UUID, Metadata> forOrderItems(List<OrderLineItemEntity> items) {
        return resolve(items, OrderLineItemEntity::getId, OrderLineItemEntity::resolveProductKey);
    }

    private <T> Map<UUID, Metadata> resolve(
            List<T> items, Function<T, UUID> lineId, Function<T, String> productKey) {
        List<String> keys = items.stream().map(productKey)
                .filter(key -> key != null && !key.isBlank()).distinct().toList();
        if (keys.isEmpty()) return Map.of();

        Map<String, Metadata> byProduct = new HashMap<>();
        for (var row : productRepo.findAnalyticsMetadataByIds(keys)) {
            byProduct.put(row.getProductId(), new Metadata(row.getBrandName(), row.getCategoryName()));
        }
        Map<UUID, Metadata> byLine = new HashMap<>();
        for (T item : items) {
            Metadata metadata = byProduct.get(productKey.apply(item));
            if (metadata != null) byLine.put(lineId.apply(item), metadata);
        }
        return byLine;
    }
}
