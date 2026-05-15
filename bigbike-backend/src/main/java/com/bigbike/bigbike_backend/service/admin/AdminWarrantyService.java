package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.admin.dto.warranty.WarrantyRecordResponse;
import com.bigbike.bigbike_backend.api.error.ConflictException;
import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.mapper.WarrantyMapper;
import com.bigbike.bigbike_backend.persistence.entity.commerce.warranty.WarrantyRecordEntity;
import com.bigbike.bigbike_backend.persistence.repository.commerce.warranty.WarrantyRecordJpaRepository;
import com.bigbike.bigbike_backend.service.common.PageResult;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
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

    public WarrantyRecordResponse getBySerial(UUID serialId) {
        return warrantyRepo.findBySerialId(serialId)
                .map(warrantyMapper::toResponse)
                .orElseThrow(() -> new NotFoundException("No warranty found for serial: " + serialId));
    }

    public Optional<WarrantyRecordResponse> findBySerial(UUID serialId) {
        return warrantyRepo.findBySerialId(serialId).map(warrantyMapper::toResponse);
    }

    public PageResult<WarrantyRecordResponse> search(
            int page, int size, String status, UUID customerId
    ) {
        int pg = Math.max(1, page) - 1;
        int sz = (size <= 0) ? DEFAULT_SIZE : Math.min(size, MAX_SIZE);
        PageRequest pageable = PageRequest.of(pg, sz, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<WarrantyRecordEntity> result = warrantyRepo.search(status, customerId, pageable);

        List<WarrantyRecordResponse> items = result.getContent().stream()
                .map(warrantyMapper::toResponse)
                .toList();

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
        return warrantyMapper.toResponse(warrantyRepo.save(warranty));
    }
}
