package com.bigbike.bigbike_backend.api.admin;

import com.bigbike.bigbike_backend.api.admin.dto.legacy.AdminLegacyDiscontinuedProductResponse;
import com.bigbike.bigbike_backend.api.admin.dto.legacy.LegacyDiscontinuedProductRequest;
import com.bigbike.bigbike_backend.api.admin.dto.legacy.LegacyDiscontinuedProductUpdateRequest;
import com.bigbike.bigbike_backend.api.common.ApiDataResponse;
import com.bigbike.bigbike_backend.api.common.ApiListResponse;
import com.bigbike.bigbike_backend.api.common.ApiResponseFactory;
import com.bigbike.bigbike_backend.service.admin.LegacyDiscontinuedProductService;
import com.bigbike.bigbike_backend.service.auth.DevAdminAuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Validated
@RestController
@RequestMapping("/api/v1/admin/legacy-discontinued-products")
@RequiredArgsConstructor
public class AdminLegacyDiscontinuedProductController extends AdminControllerSupport {

    private final LegacyDiscontinuedProductService legacyService;
    private final DevAdminAuthService devAdminAuthService;
    private final ApiResponseFactory apiResponseFactory;

    @GetMapping
    public ApiListResponse<AdminLegacyDiscontinuedProductResponse> list(
            @RequestParam(defaultValue = "1") @Min(1) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size,
            @RequestParam(required = false) @Size(max = 200) String q,
            @RequestParam(required = false) Boolean enabled,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "products.read");
        return apiResponseFactory.list(legacyService.list(page, size, q, enabled), request);
    }

    @GetMapping("/{id}")
    public ApiDataResponse<AdminLegacyDiscontinuedProductResponse> get(
            @PathVariable UUID id,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "products.read");
        return apiResponseFactory.data(legacyService.get(id), request);
    }

    @PostMapping
    public ApiDataResponse<AdminLegacyDiscontinuedProductResponse> create(
            @Valid @RequestBody LegacyDiscontinuedProductRequest payload,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "products.update");
        return apiResponseFactory.data(legacyService.create(resolveAdminId(), payload), request);
    }

    @PatchMapping("/{id}")
    public ApiDataResponse<AdminLegacyDiscontinuedProductResponse> update(
            @PathVariable UUID id,
            @Valid @RequestBody LegacyDiscontinuedProductUpdateRequest payload,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "products.update");
        return apiResponseFactory.data(legacyService.update(id, resolveAdminId(), payload), request);
    }
}
