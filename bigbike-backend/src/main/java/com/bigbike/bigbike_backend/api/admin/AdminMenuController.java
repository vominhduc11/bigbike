package com.bigbike.bigbike_backend.api.admin;

import com.bigbike.bigbike_backend.api.admin.dto.menu.AdminMenuItemResponse;
import com.bigbike.bigbike_backend.api.admin.dto.menu.AdminMenuResponse;
import com.bigbike.bigbike_backend.api.admin.dto.menu.CreateMenuItemRequest;
import com.bigbike.bigbike_backend.api.admin.dto.menu.CreateMenuRequest;
import com.bigbike.bigbike_backend.api.admin.dto.menu.ReorderMenuItemsRequest;
import com.bigbike.bigbike_backend.api.admin.dto.menu.UpdateMenuItemRequest;
import com.bigbike.bigbike_backend.api.admin.dto.menu.UpdateMenuRequest;
import com.bigbike.bigbike_backend.api.common.ApiDataResponse;
import com.bigbike.bigbike_backend.api.common.ApiListResponse;
import com.bigbike.bigbike_backend.api.common.ApiResponseFactory;
import com.bigbike.bigbike_backend.domain.auth.AdminPrincipal;
import com.bigbike.bigbike_backend.service.admin.AdminMenuService;
import com.bigbike.bigbike_backend.service.auth.DevAdminAuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
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
@RequestMapping("/api/v1/admin/menus")
@RequiredArgsConstructor
public class AdminMenuController {

    private static final UUID DEV_ADMIN_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");

    private final AdminMenuService adminMenuService;
    private final DevAdminAuthService devAdminAuthService;
    private final ApiResponseFactory apiResponseFactory;

    // ── Menu CRUD ─────────────────────────────────────────────────────────────

    @GetMapping
    public ApiListResponse<AdminMenuResponse> listMenus(
            @RequestParam(defaultValue = "1") @Min(1) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String status,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "menus.read");
        return apiResponseFactory.list(adminMenuService.listMenus(page, size, q, status), request);
    }

    @GetMapping("/{menuId}")
    public ApiDataResponse<AdminMenuResponse> getMenuById(
            @PathVariable UUID menuId,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "menus.read");
        return apiResponseFactory.data(adminMenuService.getMenuById(menuId), request);
    }

    @PostMapping
    public ApiDataResponse<AdminMenuResponse> createMenu(
            @Valid @RequestBody CreateMenuRequest body,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "menus.write");
        return apiResponseFactory.data(adminMenuService.createMenu(resolveAdminId(), body), request);
    }

    @PatchMapping("/{menuId}")
    public ApiDataResponse<AdminMenuResponse> updateMenu(
            @PathVariable UUID menuId,
            @RequestBody UpdateMenuRequest body,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "menus.write");
        return apiResponseFactory.data(adminMenuService.updateMenu(menuId, resolveAdminId(), body), request);
    }

    @DeleteMapping("/{menuId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteMenu(
            @PathVariable UUID menuId,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "menus.write");
        adminMenuService.deleteMenu(menuId, resolveAdminId());
    }

    // ── Menu items ────────────────────────────────────────────────────────────

    @PostMapping("/{menuId}/items")
    public ApiDataResponse<AdminMenuItemResponse> createMenuItem(
            @PathVariable UUID menuId,
            @Valid @RequestBody CreateMenuItemRequest body,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "menus.write");
        return apiResponseFactory.data(
                adminMenuService.createMenuItem(menuId, resolveAdminId(), body), request);
    }

    @PatchMapping("/{menuId}/items/{itemId}")
    public ApiDataResponse<AdminMenuItemResponse> updateMenuItem(
            @PathVariable UUID menuId,
            @PathVariable UUID itemId,
            @RequestBody UpdateMenuItemRequest body,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "menus.write");
        return apiResponseFactory.data(
                adminMenuService.updateMenuItem(menuId, itemId, resolveAdminId(), body), request);
    }

    @DeleteMapping("/{menuId}/items/{itemId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteMenuItem(
            @PathVariable UUID menuId,
            @PathVariable UUID itemId,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "menus.write");
        adminMenuService.deleteMenuItem(menuId, itemId, resolveAdminId());
    }

    @PostMapping("/{menuId}/items/reorder")
    public ApiDataResponse<AdminMenuResponse> reorderItems(
            @PathVariable UUID menuId,
            @Valid @RequestBody ReorderMenuItemsRequest body,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "menus.write");
        return apiResponseFactory.data(
                adminMenuService.reorderItems(menuId, resolveAdminId(), body), request);
    }

    private UUID resolveAdminId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof AdminPrincipal principal) {
            try { return UUID.fromString(principal.id()); } catch (IllegalArgumentException ignored) {}
        }
        return DEV_ADMIN_ID;
    }
}
