package com.bigbike.bigbike_backend.api.admin;

import com.bigbike.bigbike_backend.api.admin.dto.shipping.CreateShippingMethodRequest;
import com.bigbike.bigbike_backend.api.admin.dto.shipping.CreateShippingZoneRequest;
import com.bigbike.bigbike_backend.api.common.ApiDataResponse;
import com.bigbike.bigbike_backend.api.common.ApiListResponse;
import com.bigbike.bigbike_backend.api.common.ApiResponseFactory;
import com.bigbike.bigbike_backend.service.admin.AdminShippingService;
import com.bigbike.bigbike_backend.service.auth.DevAdminAuthService;
import tools.jackson.databind.JsonNode;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@Validated
@RestController
@RequestMapping("/api/v1/admin/shipping")
public class AdminShippingController {

    private final AdminShippingService adminShippingService;
    private final DevAdminAuthService devAdminAuthService;
    private final ApiResponseFactory apiResponseFactory;

    public AdminShippingController(
            AdminShippingService adminShippingService,
            DevAdminAuthService devAdminAuthService,
            ApiResponseFactory apiResponseFactory
    ) {
        this.adminShippingService = adminShippingService;
        this.devAdminAuthService = devAdminAuthService;
        this.apiResponseFactory = apiResponseFactory;
    }

    // ── Zones ─────────────────────────────────────────────────────────────────

    @GetMapping("/zones")
    public ApiListResponse<Map<String, Object>> listZones(
            @RequestParam(defaultValue = "1") @Min(1) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size,
            @RequestParam(required = false) String q,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "shipping.read");
        return apiResponseFactory.list(adminShippingService.listZones(page, size, q), request);
    }

    @GetMapping("/zones/{id}")
    public ApiDataResponse<Map<String, Object>> getZone(
            @PathVariable UUID id,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "shipping.read");
        return apiResponseFactory.data(adminShippingService.getZone(id), request);
    }

    @PostMapping("/zones")
    public ApiDataResponse<Map<String, Object>> createZone(
            @jakarta.validation.Valid @RequestBody CreateShippingZoneRequest body,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "shipping.write");
        return apiResponseFactory.data(adminShippingService.createZone(body), request);
    }

    @PatchMapping("/zones/{id}")
    public ApiDataResponse<Map<String, Object>> updateZone(
            @PathVariable UUID id,
            @RequestBody JsonNode body,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "shipping.write");
        return apiResponseFactory.data(adminShippingService.updateZone(id, body), request);
    }

    @DeleteMapping("/zones/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteZone(
            @PathVariable UUID id,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "shipping.write");
        adminShippingService.deleteZone(id);
    }

    // ── Methods ───────────────────────────────────────────────────────────────

    @GetMapping("/zones/{zoneId}/methods")
    public ApiDataResponse<List<Map<String, Object>>> listMethods(
            @PathVariable UUID zoneId,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "shipping.read");
        return apiResponseFactory.data(adminShippingService.listMethods(zoneId), request);
    }

    @PostMapping("/zones/{zoneId}/methods")
    public ApiDataResponse<Map<String, Object>> createMethod(
            @PathVariable UUID zoneId,
            @jakarta.validation.Valid @RequestBody CreateShippingMethodRequest body,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "shipping.write");
        return apiResponseFactory.data(adminShippingService.createMethod(zoneId, body), request);
    }

    @PatchMapping("/zones/{zoneId}/methods/{methodId}")
    public ApiDataResponse<Map<String, Object>> updateMethod(
            @PathVariable UUID zoneId,
            @PathVariable UUID methodId,
            @RequestBody JsonNode body,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "shipping.write");
        return apiResponseFactory.data(adminShippingService.updateMethod(zoneId, methodId, body), request);
    }

    @DeleteMapping("/zones/{zoneId}/methods/{methodId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteMethod(
            @PathVariable UUID zoneId,
            @PathVariable UUID methodId,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "shipping.write");
        adminShippingService.deleteMethod(zoneId, methodId);
    }
}
