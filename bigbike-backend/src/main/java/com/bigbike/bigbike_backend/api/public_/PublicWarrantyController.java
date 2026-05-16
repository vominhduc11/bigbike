package com.bigbike.bigbike_backend.api.public_;

import com.bigbike.bigbike_backend.api.common.ApiDataResponse;
import com.bigbike.bigbike_backend.api.common.ApiResponseFactory;
import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.api.public_.dto.WarrantyLookupResponse;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductSerialEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.warranty.WarrantyRecordEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductSerialJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.warranty.WarrantyRecordJpaRepository;
import jakarta.servlet.http.HttpServletRequest;
import java.time.LocalDate;
import lombok.RequiredArgsConstructor;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/warranties")
@RequiredArgsConstructor
public class PublicWarrantyController {

    private final ProductSerialJpaRepository serialRepo;
    private final WarrantyRecordJpaRepository warrantyRepo;
    private final ApiResponseFactory apiResponseFactory;

    @Transactional(readOnly = true)
    @GetMapping("/lookup")
    public ApiDataResponse<WarrantyLookupResponse> lookup(
            @RequestParam String serial,
            HttpServletRequest request
    ) {
        String normalized = serial.trim().toUpperCase();
        ProductSerialEntity serialEntity = serialRepo.findBySerialNumber(normalized)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy serial: " + normalized));

        WarrantyRecordEntity warranty = warrantyRepo.findBySerialId(serialEntity.getId())
                .orElseThrow(() -> new NotFoundException("Không có bảo hành cho serial: " + normalized));

        LocalDate today = LocalDate.now();
        long daysLeft = today.until(warranty.getEndDate()).getDays();
        boolean expired = warranty.getEndDate().isBefore(today);
        String displayStatus = "VOIDED".equals(warranty.getStatus())
                ? "VOIDED"
                : expired ? "EXPIRED" : warranty.getStatus();

        return apiResponseFactory.data(new WarrantyLookupResponse(
                serialEntity.getSerialNumber(),
                serialEntity.getProduct().getName(),
                warranty.getStartDate().toString(),
                warranty.getEndDate().toString(),
                displayStatus,
                Math.max(0, daysLeft)
        ), request);
    }
}
