package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.admin.dto.order.OrderHistoryClassificationResponse;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderHistoryBatchOrderEntity;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderHistoryBatchJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderHistoryBatchOrderJpaRepository;
import java.util.Collection;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class OrderHistoryClassificationService {

    private final OrderHistoryBatchJpaRepository batchRepository;
    private final OrderHistoryBatchOrderJpaRepository membershipRepository;

    @Transactional(readOnly = true)
    public boolean hasActiveBatch() {
        return batchRepository.existsByActiveTrue();
    }

    @Transactional(readOnly = true)
    public boolean isHistorical(UUID orderId) {
        return membershipRepository.findActiveByOrderId(orderId).isPresent();
    }

    @Transactional(readOnly = true)
    public Optional<OrderHistoryClassificationResponse> activeClassification(UUID orderId) {
        return membershipRepository.findActiveByOrderId(orderId).map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public Map<UUID, OrderHistoryClassificationResponse> activeClassifications(Collection<UUID> orderIds) {
        if (orderIds == null || orderIds.isEmpty()) return Map.of();
        return membershipRepository.findActiveByOrderIds(orderIds).stream()
                .collect(Collectors.toMap(
                        membership -> membership.getOrder().getId(),
                        this::toResponse,
                        (first, ignored) -> first
                ));
    }

    private OrderHistoryClassificationResponse toResponse(OrderHistoryBatchOrderEntity membership) {
        var batch = membership.getBatch();
        return new OrderHistoryClassificationResponse(
                batch.getBatchKey(),
                batch.getLabelVi(),
                batch.getLabelEn(),
                batch.getReasonVi(),
                batch.getReasonEn(),
                membership.getClassifiedAt()
        );
    }
}
