package com.bigbike.bigbike_backend.api.admin;

import com.bigbike.bigbike_backend.api.admin.dto.warranty.WarrantyRecordResponse;
import com.bigbike.bigbike_backend.service.admin.AdminWarrantyService;
import com.bigbike.bigbike_backend.service.auth.DevAdminAuthService;
import com.bigbike.bigbike_backend.service.common.PageResult;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Validated
@RequestMapping("/api/v1/admin/warranties")
@RequiredArgsConstructor
public class AdminWarrantyController {

    private final AdminWarrantyService warrantyService;
    private final DevAdminAuthService devAdminAuthService;

    @GetMapping("/by-serial/{serialId}")
    public WarrantyRecordResponse getBySerial(
            @PathVariable UUID serialId,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "warranty.read");
        return warrantyService.getBySerial(serialId);
    }

    @GetMapping
    public PageResult<WarrantyRecordResponse> search(
            @RequestParam(defaultValue = "1") @Min(1) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size,
            @RequestParam(required = false) @Size(max = 32) String status,
            @RequestParam(required = false) UUID customerId,
            @RequestParam(required = false) @Size(max = 100) String q,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "warranty.read");
        return warrantyService.search(page, size, status, customerId, q);
    }

    @PatchMapping("/{warrantyId}/void")
    public WarrantyRecordResponse voidWarranty(
            @PathVariable UUID warrantyId,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "warranty.write");
        return warrantyService.voidWarranty(warrantyId);
    }
}
