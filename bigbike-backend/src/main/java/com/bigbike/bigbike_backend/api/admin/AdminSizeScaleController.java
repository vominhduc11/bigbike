package com.bigbike.bigbike_backend.api.admin;

import com.bigbike.bigbike_backend.api.admin.dto.CreateSizeScaleGroupRequest;
import com.bigbike.bigbike_backend.api.admin.dto.SizeScaleGroupResponse;
import com.bigbike.bigbike_backend.api.admin.dto.SizeScaleResponse;
import com.bigbike.bigbike_backend.api.admin.dto.SizeScaleValueResponse;
import com.bigbike.bigbike_backend.api.admin.dto.UpdateSizeScaleGroupRequest;
import com.bigbike.bigbike_backend.api.admin.dto.UpsertSizeScaleRequest;
import com.bigbike.bigbike_backend.api.admin.dto.UpsertSizeScaleValueRequest;
import com.bigbike.bigbike_backend.api.common.ApiDataResponse;
import com.bigbike.bigbike_backend.api.common.ApiResponseFactory;
import com.bigbike.bigbike_backend.service.admin.AdminSizeScaleService;
import com.bigbike.bigbike_backend.service.auth.DevAdminAuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Pattern;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@Validated
@RestController
@RequestMapping("/api/v1/admin")
@RequiredArgsConstructor
public class AdminSizeScaleController extends AdminControllerSupport {

    private static final String ID_REGEX = "^[A-Za-z0-9_-]+$";

    private final AdminSizeScaleService sizeScaleService;
    private final DevAdminAuthService devAdminAuthService;
    private final ApiResponseFactory apiResponseFactory;

    @GetMapping("/size-scale-groups")
    public List<SizeScaleGroupResponse> listGroups(
            @RequestParam(name = "includeInactive", defaultValue = "false") boolean includeInactive,
            HttpServletRequest request) {
        devAdminAuthService.requirePermission(request, "products.read");
        return sizeScaleService.listGroups(includeInactive);
    }

    @PostMapping("/size-scale-groups")
    public ApiDataResponse<SizeScaleGroupResponse> createGroup(
            @Valid @RequestBody CreateSizeScaleGroupRequest payload,
            HttpServletRequest request) {
        devAdminAuthService.requirePermission(request, "products.update");
        return apiResponseFactory.data(sizeScaleService.createGroup(payload, resolveAdminId()), request);
    }

    @PatchMapping("/size-scale-groups/{id}")
    public ApiDataResponse<SizeScaleGroupResponse> updateGroup(
            @PathVariable @Pattern(regexp = ID_REGEX) String id,
            @Valid @RequestBody UpdateSizeScaleGroupRequest payload,
            HttpServletRequest request) {
        devAdminAuthService.requirePermission(request, "products.update");
        return apiResponseFactory.data(
                sizeScaleService.updateGroup(id, payload, resolveAdminId()), request);
    }

    @DeleteMapping("/size-scale-groups/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteGroup(
            @PathVariable @Pattern(regexp = ID_REGEX) String id,
            HttpServletRequest request) {
        devAdminAuthService.requirePermission(request, "products.update");
        sizeScaleService.deleteGroup(id, resolveAdminId());
    }

    @GetMapping("/size-scales")
    public List<SizeScaleResponse> listScales(HttpServletRequest request) {
        devAdminAuthService.requirePermission(request, "products.read");
        return sizeScaleService.listScales();
    }

    @PostMapping("/size-scales")
    public ApiDataResponse<SizeScaleResponse> createScale(
            @Valid @RequestBody UpsertSizeScaleRequest payload,
            HttpServletRequest request) {
        devAdminAuthService.requirePermission(request, "products.update");
        return apiResponseFactory.data(sizeScaleService.createScale(payload), request);
    }

    @PatchMapping("/size-scales/{id}")
    public ApiDataResponse<SizeScaleResponse> updateScale(
            @PathVariable @Pattern(regexp = ID_REGEX) String id,
            @Valid @RequestBody UpsertSizeScaleRequest payload,
            HttpServletRequest request) {
        devAdminAuthService.requirePermission(request, "products.update");
        return apiResponseFactory.data(sizeScaleService.updateScale(id, payload), request);
    }

    @DeleteMapping("/size-scales/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteScale(
            @PathVariable @Pattern(regexp = ID_REGEX) String id,
            HttpServletRequest request) {
        devAdminAuthService.requirePermission(request, "products.update");
        sizeScaleService.deleteScale(id);
    }

    @PostMapping("/size-scales/{scaleId}/values")
    public ApiDataResponse<SizeScaleValueResponse> createValue(
            @PathVariable @Pattern(regexp = ID_REGEX) String scaleId,
            @Valid @RequestBody UpsertSizeScaleValueRequest payload,
            HttpServletRequest request) {
        devAdminAuthService.requirePermission(request, "products.update");
        return apiResponseFactory.data(sizeScaleService.createValue(scaleId, payload), request);
    }

    @PatchMapping("/size-scale-values/{id}")
    public ApiDataResponse<SizeScaleValueResponse> updateValue(
            @PathVariable @Pattern(regexp = ID_REGEX) String id,
            @Valid @RequestBody UpsertSizeScaleValueRequest payload,
            HttpServletRequest request) {
        devAdminAuthService.requirePermission(request, "products.update");
        return apiResponseFactory.data(sizeScaleService.updateValue(id, payload), request);
    }

    @DeleteMapping("/size-scale-values/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteValue(
            @PathVariable @Pattern(regexp = ID_REGEX) String id,
            HttpServletRequest request) {
        devAdminAuthService.requirePermission(request, "products.update");
        sizeScaleService.deleteValue(id);
    }
}
