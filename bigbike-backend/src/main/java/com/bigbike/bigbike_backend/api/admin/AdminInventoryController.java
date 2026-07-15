package com.bigbike.bigbike_backend.api.admin;

import com.bigbike.bigbike_backend.api.admin.dto.inventory.AdminStockItemResponse;
import com.bigbike.bigbike_backend.api.admin.dto.inventory.InventorySummaryResponse;
import com.bigbike.bigbike_backend.service.admin.AdminInventoryService;
import com.bigbike.bigbike_backend.service.auth.DevAdminAuthService;
import com.bigbike.bigbike_backend.service.common.PageResult;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Read-only inventory endpoints backing the Dashboard out-of-stock alert.
 *
 * Removed 2026-07-15 (AUD-056, owner decision #8 — no internal caller, no external clients):
 * GET /grouped, GET /movements, GET /variants/{id}/movements, GET /products/{id}/movements,
 * GET /export.csv, PATCH /variants/{id}/availability, PATCH /products/{id}/availability.
 * Còn/Hết is toggled inside the product edit form (products.update) — see BUSINESS_RULES
 * Stock State Derivation Rules.
 */
@RestController
@RequestMapping("/api/v1/admin/inventory")
@RequiredArgsConstructor
public class AdminInventoryController extends AdminControllerSupport {

    private final AdminInventoryService inventoryService;
    private final DevAdminAuthService devAdminAuthService;

    @GetMapping
    public PageResult<AdminStockItemResponse> listStock(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String stockState,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "inventory.read");
        return inventoryService.listStock(page, size, q, stockState);
    }

    @GetMapping("/summary")
    public InventorySummaryResponse getSummary(HttpServletRequest request) {
        devAdminAuthService.requirePermission(request, "inventory.read");
        return inventoryService.getSummary();
    }
}
