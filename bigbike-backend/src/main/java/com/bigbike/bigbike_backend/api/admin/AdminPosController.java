package com.bigbike.bigbike_backend.api.admin;

import com.bigbike.bigbike_backend.api.common.ApiDataResponse;
import com.bigbike.bigbike_backend.api.common.ApiListResponse;
import com.bigbike.bigbike_backend.api.common.ApiResponseFactory;
import com.bigbike.bigbike_backend.service.admin.AdminCatalogReadService;
import com.bigbike.bigbike_backend.service.auth.DevAdminAuthService;
import com.bigbike.bigbike_backend.service.pos.PosOrderService;
import com.bigbike.bigbike_backend.service.pos.PosOrderService.PosCreateOrderRequest;
import com.bigbike.bigbike_backend.service.pos.PosOrderService.PosOrderResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/pos")
public class AdminPosController {

    private final PosOrderService posOrderService;
    private final AdminCatalogReadService catalogReadService;
    private final DevAdminAuthService devAdminAuthService;
    private final ApiResponseFactory apiResponseFactory;

    public AdminPosController(
            PosOrderService posOrderService,
            AdminCatalogReadService catalogReadService,
            DevAdminAuthService devAdminAuthService,
            ApiResponseFactory apiResponseFactory
    ) {
        this.posOrderService = posOrderService;
        this.catalogReadService = catalogReadService;
        this.devAdminAuthService = devAdminAuthService;
        this.apiResponseFactory = apiResponseFactory;
    }

    /** Tìm kiếm sản phẩm nhanh theo tên / SKU — dùng cho POS search bar. */
    @GetMapping("/products/search")
    public ApiListResponse<?> searchProducts(
            @RequestParam String q,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "pos.read");
        var results = catalogReadService.listProducts(page, size, "name:asc", q, null, "PUBLISHED", null, null, null);
        return apiResponseFactory.list(results, request);
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
        return apiResponseFactory.data(posOrderService.createOrder(req, staffId, canOverridePrice), request);
    }
}
