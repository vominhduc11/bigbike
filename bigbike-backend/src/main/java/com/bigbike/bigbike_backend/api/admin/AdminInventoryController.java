package com.bigbike.bigbike_backend.api.admin;

import com.bigbike.bigbike_backend.api.admin.dto.inventory.AddSerialsRequest;
import com.bigbike.bigbike_backend.api.admin.dto.inventory.AdminSerialResponse;
import com.bigbike.bigbike_backend.api.admin.dto.inventory.AdminStockItemResponse;
import com.bigbike.bigbike_backend.api.admin.dto.inventory.AdminStockProductGroupResponse;
import com.bigbike.bigbike_backend.api.admin.dto.inventory.AdjustStockRequest;
import com.bigbike.bigbike_backend.api.admin.dto.inventory.InventorySummaryResponse;
import com.bigbike.bigbike_backend.api.admin.dto.inventory.SerialImportRequest;
import com.bigbike.bigbike_backend.api.admin.dto.inventory.SerialImportResponse;
import com.bigbike.bigbike_backend.api.admin.dto.inventory.StockMovementResponse;
import com.bigbike.bigbike_backend.api.admin.dto.inventory.UpdateSerialStatusRequest;
import com.bigbike.bigbike_backend.domain.auth.AdminPrincipal;
import com.bigbike.bigbike_backend.service.admin.AdminInventoryService;
import com.bigbike.bigbike_backend.service.admin.AdminSerialImportService;
import com.bigbike.bigbike_backend.service.admin.AdminSerialService;
import com.bigbike.bigbike_backend.service.auth.DevAdminAuthService;
import com.bigbike.bigbike_backend.service.common.PageResult;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import java.io.IOException;
import java.util.List;
import java.util.UUID;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
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
    private final AdminSerialService serialService;
    private final AdminSerialImportService serialImportService;
    private final DevAdminAuthService devAdminAuthService;

    public AdminInventoryController(
            AdminInventoryService inventoryService,
            AdminSerialService serialService,
            AdminSerialImportService serialImportService,
            DevAdminAuthService devAdminAuthService
    ) {
        this.inventoryService = inventoryService;
        this.serialService = serialService;
        this.serialImportService = serialImportService;
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

    @PostMapping("/variants/{variantId}/adjust")
    public AdminStockItemResponse adjustStock(
            @PathVariable String variantId,
            @Valid @RequestBody AdjustStockRequest req,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "inventory.write");
        return inventoryService.adjustStock(variantId, resolveAdminId(), req);
    }

    @PostMapping("/products/{productId}/adjust")
    public AdminStockItemResponse adjustProductStock(
            @PathVariable String productId,
            @Valid @RequestBody AdjustStockRequest req,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "inventory.write");
        return inventoryService.adjustProductStock(productId, resolveAdminId(), req);
    }

    // ── Serial management ─────────────────────────────────────────────────────

    @GetMapping("/serials")
    public PageResult<AdminSerialResponse> listAllSerials(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String productId,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "inventory.read");
        return serialService.listAll(q, status, productId, page, size);
    }

    @GetMapping("/variants/{variantId}/serials")
    public PageResult<AdminSerialResponse> listVariantSerials(
            @PathVariable String variantId,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "inventory.read");
        return serialService.listForVariant(variantId, status, page, size);
    }

    @GetMapping("/products/{productId}/serials")
    public PageResult<AdminSerialResponse> listProductSerials(
            @PathVariable String productId,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "inventory.read");
        return serialService.listForProduct(productId, status, page, size);
    }

    @GetMapping("/serials/{serialId}")
    public AdminSerialResponse getSerial(
            @PathVariable UUID serialId,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "inventory.read");
        return serialService.getSerial(serialId);
    }

    @PostMapping("/variants/{variantId}/serials")
    public List<AdminSerialResponse> addVariantSerials(
            @PathVariable String variantId,
            @Valid @RequestBody AddSerialsRequest req,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "inventory.write");
        return serialService.addToVariant(variantId, resolveAdminId(), req);
    }

    @PostMapping("/products/{productId}/serials")
    public List<AdminSerialResponse> addProductSerials(
            @PathVariable String productId,
            @Valid @RequestBody AddSerialsRequest req,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "inventory.write");
        return serialService.addToProduct(productId, resolveAdminId(), req);
    }

    @PatchMapping("/serials/{serialId}/status")
    public AdminSerialResponse updateSerialStatus(
            @PathVariable UUID serialId,
            @Valid @RequestBody UpdateSerialStatusRequest req,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "inventory.write");
        return serialService.updateStatus(serialId, resolveAdminId(), req);
    }

    /**
     * POST /api/v1/admin/inventory/serials/import
     * Bulk-insert product serials from a JSON payload.
     * partialMode=false (default): all-or-nothing transaction.
     * partialMode=true: skip bad rows, insert valid ones.
     * Permission: inventory.write.
     */
    @PostMapping("/serials/import")
    public SerialImportResponse importSerials(
            @RequestBody @Valid SerialImportRequest req,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "inventory.write");
        return serialImportService.importSerials(req, resolveAdminId());
    }

    private UUID resolveAdminId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof AdminPrincipal principal) {
            try { return UUID.fromString(principal.id()); } catch (Exception ignored) {}
        }
        return DEV_ADMIN_ID;
    }
}
