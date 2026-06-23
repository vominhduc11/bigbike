package com.bigbike.bigbike_backend.api.admin;

import com.bigbike.bigbike_backend.api.admin.dto.inventory.AdminStockItemResponse;
import com.bigbike.bigbike_backend.api.admin.dto.inventory.AdminStockProductGroupResponse;
import com.bigbike.bigbike_backend.api.admin.dto.inventory.InventorySummaryResponse;
import com.bigbike.bigbike_backend.api.admin.dto.inventory.SetAvailabilityRequest;
import com.bigbike.bigbike_backend.api.admin.dto.inventory.StockMovementResponse;
import com.bigbike.bigbike_backend.service.admin.AdminInventoryService;
import com.bigbike.bigbike_backend.service.auth.DevAdminAuthService;
import com.bigbike.bigbike_backend.service.common.PageResult;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import java.io.IOException;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

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

    @GetMapping("/grouped")
    public PageResult<AdminStockProductGroupResponse> listStockGrouped(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String stockState,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "inventory.read");
        return inventoryService.listStockGrouped(page, size, q, stockState);
    }

    @GetMapping("/summary")
    public InventorySummaryResponse getSummary(HttpServletRequest request) {
        devAdminAuthService.requirePermission(request, "inventory.read");
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
        devAdminAuthService.requirePermission(request, "inventory.read");
        return inventoryService.listAllMovements(page, size, movementType, referenceType);
    }

    @GetMapping("/export.csv")
    public void exportCsv(HttpServletRequest request, HttpServletResponse response) throws IOException {
        devAdminAuthService.requirePermission(request, "inventory.read");
        inventoryService.exportCsv(response);
    }

    @GetMapping("/variants/{variantId}/movements")
    public PageResult<StockMovementResponse> listMovements(
            @PathVariable String variantId,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "inventory.read");
        return inventoryService.listMovements(variantId, page, size);
    }

    @GetMapping("/products/{productId}/movements")
    public PageResult<StockMovementResponse> listProductMovements(
            @PathVariable String productId,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "inventory.read");
        return inventoryService.listProductMovements(productId, page, size);
    }

    @PatchMapping("/variants/{variantId}/availability")
    public AdminStockItemResponse setVariantAvailability(
            @PathVariable String variantId,
            @Valid @RequestBody SetAvailabilityRequest req,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "inventory.write");
        return inventoryService.setVariantAvailability(variantId, resolveAdminId(), req.available());
    }

    @PatchMapping("/products/{productId}/availability")
    public AdminStockItemResponse setProductAvailability(
            @PathVariable String productId,
            @Valid @RequestBody SetAvailabilityRequest req,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "inventory.write");
        return inventoryService.setProductAvailability(productId, resolveAdminId(), req.available());
    }
}
