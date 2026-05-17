package com.bigbike.bigbike_backend.api.admin;

import com.bigbike.bigbike_backend.api.common.ApiDataResponse;
import com.bigbike.bigbike_backend.api.common.ApiListResponse;
import com.bigbike.bigbike_backend.api.common.ApiResponseFactory;
import com.bigbike.bigbike_backend.domain.catalog.Product;
import com.bigbike.bigbike_backend.domain.catalog.ProductStockState;
import com.bigbike.bigbike_backend.domain.catalog.ProductVariant;
import com.bigbike.bigbike_backend.service.admin.AdminCatalogReadService;
import com.bigbike.bigbike_backend.service.auth.DevAdminAuthService;
import com.bigbike.bigbike_backend.service.inventory.SerialLifecycleService;
import com.bigbike.bigbike_backend.service.payment.RefundService;
import com.bigbike.bigbike_backend.service.pos.PosOrderService;
import com.bigbike.bigbike_backend.service.pos.PosOrderService.PosCreateOrderRequest;
import com.bigbike.bigbike_backend.service.pos.PosOrderService.PosOrderResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Validated
@RequestMapping("/api/v1/admin/pos")
@RequiredArgsConstructor
public class AdminPosController {

    private final PosOrderService posOrderService;
    private final AdminCatalogReadService catalogReadService;
    private final DevAdminAuthService devAdminAuthService;
    private final ApiResponseFactory apiResponseFactory;
    private final RefundService refundService;
    private final SerialLifecycleService serialLifecycleService;

    /** Tìm kiếm sản phẩm nhanh theo tên / SKU — dùng cho POS search bar.
     *  Re-fetches each result with variants so the POS grid can render per-variant cards.
     *  N+1 is intentional: POS search returns ≤20 results and is user-triggered. */
    @GetMapping("/products/search")
    public ApiListResponse<?> searchProducts(
            @RequestParam @Size(max = 100) String q,
            @RequestParam(defaultValue = "1") @Min(1) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "pos.read");
        var summary = catalogReadService.listProducts(page, size, "name:asc", q, null, "PUBLISHED", null, null, null, null);
        // listProducts returns Products without variants (list-view optimisation).
        // POS needs variants → re-fetch detail for each result.
        // Products with no variants need a synthetic variant so the POS grid can render them.
        // Two cases: (1) product-level serials — trackSerials=true, qty from serial count;
        //            (2) product-level non-serial stock — trackSerials=false, qty from stockQuantity.
        // Products with neither (no variants, no serials, no stock) are excluded from POS.
        var withVariants = summary.items().stream()
                .map(p -> {
                    Product detail = catalogReadService.getProductById(p.id());
                    if (detail.variants() != null && !detail.variants().isEmpty()) return detail;
                    long serialCount = serialLifecycleService.countAvailable(detail.id(), null);
                    int stockQty = detail.stockQuantity() != null ? detail.stockQuantity() : 0;
                    if (serialCount == 0 && stockQty <= 0) return null; // unsellable at POS — skip
                    boolean isSerial = serialCount > 0;
                    int qty = isSerial ? (int) Math.min(serialCount, Integer.MAX_VALUE) : stockQty;
                    ProductStockState state = qty <= 0 ? ProductStockState.OUT_OF_STOCK : ProductStockState.IN_STOCK;
                    ProductVariant synthetic = new ProductVariant(
                            null, detail.sku(), null, List.of(),
                            detail.price(), state, qty,
                            detail.image(), List.of(), true, isSerial);
                    return new Product(
                            detail.id(), detail.sku(), detail.slug(), detail.name(),
                            detail.shortDescription(), detail.description(),
                            detail.brand(), detail.category(), detail.categories(),
                            detail.image(), detail.gallery(), detail.videos(),
                            detail.price(), List.of(synthetic),
                            detail.specifications(), detail.stockState(), detail.stockQuantity(),
                            detail.forceOutOfStock(), detail.publishStatus(),
                            detail.homepageBlock(), detail.homepageOrder(),
                            detail.rating(), detail.ratingCount(), detail.contentBottom(),
                            detail.seo(), detail.createdAt(), detail.updatedAt());
                })
                .filter(java.util.Objects::nonNull)
                .toList();
        var posPage = new com.bigbike.bigbike_backend.service.common.PageResult<>(
                withVariants, summary.page(), summary.pageSize(),
                summary.totalItems(), summary.totalPages());
        return apiResponseFactory.list(posPage, request);
    }

    /** Tạo đơn tại quầy. Trừ kho ngay, không cần địa chỉ giao hàng. */
    @PostMapping("/orders")
    public ApiDataResponse<PosOrderResponse> createPosOrder(
            @Valid @RequestBody PosCreateOrderRequest req,
            HttpServletRequest request
    ) {
        var admin = devAdminAuthService.requirePermission(request, "pos.write");
        String staffId = admin.id();
        boolean canOverridePrice = admin.permissions().contains("*")
                || admin.permissions().contains("pos.price_override");
        boolean canOverrideCreditLimit = admin.permissions().contains("*")
                || admin.permissions().contains("receivables.override_limit");
        String clientIp = extractClientIp(request);
        String userAgent = request.getHeader("User-Agent");
        return apiResponseFactory.data(
                posOrderService.createOrder(req, staffId, canOverridePrice, canOverrideCreditLimit,
                        clientIp, userAgent),
                request);
    }

    /** Hoàn tiền tại quầy cho đơn POS. Delegates to the shared RefundService. */
    @PostMapping("/orders/{orderId}/refund")
    public ApiDataResponse<Map<String, Object>> posRefund(
            @PathVariable UUID orderId,
            @Valid @RequestBody PosRefundRequest req,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "pos.refund");
        UUID adminId = resolveAdminId();
        String clientIp = extractClientIp(request);
        String userAgent = request.getHeader("User-Agent");
        refundService.applyRefund(
                orderId,
                adminId,
                req.refundAmount(),
                req.reason(),
                req.note(),
                true,
                clientIp,
                userAgent);
        return apiResponseFactory.data(Map.of("orderId", orderId, "status", "REFUND_APPLIED"), request);
    }

    public record PosRefundRequest(
            @NotNull @DecimalMin(value = "0.01", message = "refundAmount phải lớn hơn 0")
            BigDecimal refundAmount,
            String reason,
            String note
    ) {}

    private static final UUID DEV_ADMIN_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");

    private UUID resolveAdminId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof com.bigbike.bigbike_backend.domain.auth.AdminPrincipal principal) {
            try {
                return UUID.fromString(principal.id());
            } catch (IllegalArgumentException ignored) {
                // non-UUID dev id — fall through
            }
        }
        return DEV_ADMIN_ID;
    }

    private String extractClientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
