package com.bigbike.bigbike_backend.api.admin;

import com.bigbike.bigbike_backend.api.admin.dto.inventory.AdminStockItemResponse;
import com.bigbike.bigbike_backend.api.admin.dto.inventory.AdjustStockRequest;
import com.bigbike.bigbike_backend.api.admin.dto.inventory.InventorySummaryResponse;
import com.bigbike.bigbike_backend.api.admin.dto.inventory.StockMovementResponse;
import com.bigbike.bigbike_backend.domain.auth.AdminPrincipal;
import com.bigbike.bigbike_backend.service.admin.AdminInventoryService;
import com.bigbike.bigbike_backend.service.auth.DevAdminAuthService;
import com.bigbike.bigbike_backend.service.common.PageResult;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import java.io.IOException;
import java.util.UUID;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/inventory")
public class AdminInventoryController {

    private static final UUID DEV_ADMIN_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");

    private final AdminInventoryService inventoryService;
    private final DevAdminAuthService devAdminAuthService;

    public AdminInventoryController(
            AdminInventoryService inventoryService,
            DevAdminAuthService devAdminAuthService
    ) {
        this.inventoryService = inventoryService;
        this.devAdminAuthService = devAdminAuthService;
    }

    @GetMapping
    public PageResult<AdminStockItemResponse> listStock(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String stockState,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "products.read");
        return inventoryService.listStock(page, size, q, stockState);
    }

    @GetMapping("/summary")
    public InventorySummaryResponse getSummary(HttpServletRequest request) {
        devAdminAuthService.requirePermission(request, "products.read");
        return inventoryService.getSummary();
    }

    @GetMapping("/movements")
    public PageResult<StockMovementResponse> listAllMovements(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String movementType,
            @RequestParam(required = false) String referenceType,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "products.read");
        return inventoryService.listAllMovements(page, size, movementType, referenceType);
    }

    @GetMapping("/export.csv")
    public void exportCsv(HttpServletRequest request, HttpServletResponse response) throws IOException {
        devAdminAuthService.requirePermission(request, "products.read");
        inventoryService.exportCsv(response);
    }

    @GetMapping("/variants/{variantId}/movements")
    public PageResult<StockMovementResponse> listMovements(
            @PathVariable String variantId,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "products.read");
        return inventoryService.listMovements(variantId, page, size);
    }

    @PostMapping("/variants/{variantId}/adjust")
    public AdminStockItemResponse adjustStock(
            @PathVariable String variantId,
            @Valid @RequestBody AdjustStockRequest req,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "products.update");
        return inventoryService.adjustStock(variantId, resolveAdminId(), req);
    }

    @PostMapping("/products/{productId}/adjust")
    public AdminStockItemResponse adjustProductStock(
            @PathVariable String productId,
            @Valid @RequestBody AdjustStockRequest req,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "products.update");
        return inventoryService.adjustProductStock(productId, resolveAdminId(), req);
    }

    private UUID resolveAdminId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof AdminPrincipal principal) {
            try { return UUID.fromString(principal.id()); } catch (Exception ignored) {}
        }
        return DEV_ADMIN_ID;
    }
}
