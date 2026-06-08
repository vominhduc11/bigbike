package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.admin.dto.warranty.WarrantyRecordResponse;
import com.bigbike.bigbike_backend.api.error.ConflictException;
import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.mapper.WarrantyMapper;
import com.bigbike.bigbike_backend.persistence.entity.commerce.warranty.WarrantyRecordEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductSerialJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderLineItemJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.warranty.WarrantyRecordJpaRepository;
import com.bigbike.bigbike_backend.service.common.PageResult;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AdminWarrantyService {

    private static final int DEFAULT_SIZE = 20;
    private static final int MAX_SIZE = 100;

    private final WarrantyRecordJpaRepository warrantyRepo;
    private final WarrantyMapper warrantyMapper;
    private final ProductSerialJpaRepository serialRepo;
    private final OrderLineItemJpaRepository lineItemRepo;

    public WarrantyRecordResponse getBySerial(UUID serialId) {
        WarrantyRecordEntity w = warrantyRepo.findBySerialId(serialId)
                .orElseThrow(() -> new NotFoundException("No warranty found for serial: " + serialId));
        return enrich(List.of(warrantyMapper.toResponse(w))).get(0);
    }

    public Optional<WarrantyRecordResponse> findBySerial(UUID serialId) {
        return warrantyRepo.findBySerialId(serialId)
                .map(warrantyMapper::toResponse)
                .map(r -> enrich(List.of(r)).get(0));
    }

    public PageResult<WarrantyRecordResponse> search(
            int page, int size, String status, UUID customerId, String q
    ) {
        int pg = Math.max(1, page) - 1;
        int sz = (size <= 0) ? DEFAULT_SIZE : Math.min(size, MAX_SIZE);
        String query = (q == null || q.isBlank()) ? null : q.trim();
        PageRequest pageable = PageRequest.of(pg, sz, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<WarrantyRecordEntity> result = warrantyRepo.search(status, customerId, query, pageable);

        List<WarrantyRecordResponse> items = enrich(
                result.getContent().stream().map(warrantyMapper::toResponse).toList()
        );

        return new PageResult<>(items, result.getNumber() + 1, result.getSize(),
                (int) result.getTotalElements(), result.getTotalPages());
    }

    @Transactional
    public WarrantyRecordResponse voidWarranty(UUID warrantyId) {
        WarrantyRecordEntity warranty = warrantyRepo.findById(warrantyId)
                .orElseThrow(() -> new NotFoundException("Warranty not found: " + warrantyId));

        if ("VOIDED".equals(warranty.getStatus())) {
            throw new ConflictException("Warranty is already voided.");
        }

        warranty.setStatus("VOIDED");
        warranty.setUpdatedAt(Instant.now());
        return enrich(List.of(warrantyMapper.toResponse(warrantyRepo.save(warranty)))).get(0);
    }

    private List<WarrantyRecordResponse> enrich(List<WarrantyRecordResponse> items) {
        if (items.isEmpty()) return items;

        List<UUID> serialIds = items.stream().map(WarrantyRecordResponse::serialId).toList();
        Map<UUID, String> serialNumberMap = serialRepo.findAllById(serialIds).stream()
                .collect(Collectors.toMap(s -> s.getId(), s -> s.getSerialNumber()));

        List<UUID> lineItemIds = items.stream()
                .map(WarrantyRecordResponse::orderLineItemId)
                .filter(Objects::nonNull)
                .toList();
        Map<UUID, Object[]> lineItemMap = new HashMap<>();
        if (!lineItemIds.isEmpty()) {
            lineItemRepo.findWarrantyInfoByIdIn(lineItemIds)
                    .forEach(row -> lineItemMap.put((UUID) row[0], row));
        }

        return items.stream().map(r -> {
            Object[] li = r.orderLineItemId() != null ? lineItemMap.get(r.orderLineItemId()) : null;
            return new WarrantyRecordResponse(
                    r.id(),
                    r.serialId(),
                    serialNumberMap.get(r.serialId()),
                    r.orderLineItemId(),
                    li != null ? (String) li[3] : null,
                    li != null ? (String) li[1] : null,
                    li != null ? (String) li[2] : null,
                    r.customerId(),
                    r.customerEmail(),
                    r.customerPhone(),
                    r.startDate(),
                    r.endDate(),
                    r.status(),
                    r.createdAt()
            );
        }).toList();
    }
}
