package com.bigbike.bigbike_backend.api.admin;

import com.bigbike.bigbike_backend.api.common.ApiDataResponse;
import com.bigbike.bigbike_backend.api.common.ApiListResponse;
import com.bigbike.bigbike_backend.api.common.ApiResponseFactory;
import com.bigbike.bigbike_backend.service.admin.AdminShippingService;
import com.bigbike.bigbike_backend.service.auth.DevAdminAuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.math.BigDecimal;
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
            @RequestBody Map<String, Object> body,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "shipping.write");
        String name = (String) body.getOrDefault("name", "");
        String regionCode = (String) body.get("regionCode");
        int sortOrder = body.containsKey("sortOrder") ? ((Number) body.get("sortOrder")).intValue() : 0;
        boolean enabled = body.containsKey("enabled") ? Boolean.TRUE.equals(body.get("enabled")) : true;
        return apiResponseFactory.data(adminShippingService.createZone(name, regionCode, sortOrder, enabled), request);
    }

    @PatchMapping("/zones/{id}")
    public ApiDataResponse<Map<String, Object>> updateZone(
            @PathVariable UUID id,
            @RequestBody Map<String, Object> body,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "shipping.write");
        String name = (String) body.get("name");
        String regionCode = (String) body.get("regionCode");
        Integer sortOrder = body.containsKey("sortOrder") ? ((Number) body.get("sortOrder")).intValue() : null;
        Boolean enabled = (Boolean) body.get("enabled");
        return apiResponseFactory.data(adminShippingService.updateZone(id, name, regionCode, sortOrder, enabled), request);
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
    public ApiDataResponse<java.util.List<Map<String, Object>>> listMethods(
            @PathVariable UUID zoneId,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "shipping.read");
        return apiResponseFactory.data(adminShippingService.listMethods(zoneId), request);
    }

    @PostMapping("/zones/{zoneId}/methods")
    public ApiDataResponse<Map<String, Object>> createMethod(
            @PathVariable UUID zoneId,
            @RequestBody Map<String, Object> body,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "shipping.write");
        String methodCode = (String) body.getOrDefault("methodCode", "");
        String title = (String) body.getOrDefault("title", "");
        String description = (String) body.get("description");
        BigDecimal cost = body.containsKey("cost") ? new BigDecimal(body.get("cost").toString()) : BigDecimal.ZERO;
        BigDecimal minOrderAmount = body.containsKey("minOrderAmount") ? new BigDecimal(body.get("minOrderAmount").toString()) : BigDecimal.ZERO;
        BigDecimal freeShippingThreshold = body.containsKey("freeShippingThreshold") ? new BigDecimal(body.get("freeShippingThreshold").toString()) : null;
        int sortOrder = body.containsKey("sortOrder") ? ((Number) body.get("sortOrder")).intValue() : 0;
        boolean enabled = body.containsKey("enabled") ? Boolean.TRUE.equals(body.get("enabled")) : true;
        return apiResponseFactory.data(adminShippingService.createMethod(zoneId, methodCode, title, description, cost, minOrderAmount, freeShippingThreshold, sortOrder, enabled), request);
    }

    @PatchMapping("/zones/{zoneId}/methods/{methodId}")
    public ApiDataResponse<Map<String, Object>> updateMethod(
            @PathVariable UUID zoneId,
            @PathVariable UUID methodId,
            @RequestBody Map<String, Object> body,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "shipping.write");
        String methodCode = (String) body.get("methodCode");
        String title = (String) body.get("title");
        String description = (String) body.get("description");
        BigDecimal cost = body.containsKey("cost") ? new BigDecimal(body.get("cost").toString()) : null;
        BigDecimal minOrderAmount = body.containsKey("minOrderAmount") ? new BigDecimal(body.get("minOrderAmount").toString()) : null;
        BigDecimal freeShippingThreshold = body.containsKey("freeShippingThreshold") ? new BigDecimal(body.get("freeShippingThreshold").toString()) : null;
        Integer sortOrder = body.containsKey("sortOrder") ? ((Number) body.get("sortOrder")).intValue() : null;
        Boolean enabled = (Boolean) body.get("enabled");
        return apiResponseFactory.data(adminShippingService.updateMethod(zoneId, methodId, methodCode, title, description, cost, minOrderAmount, freeShippingThreshold, sortOrder, enabled), request);
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
