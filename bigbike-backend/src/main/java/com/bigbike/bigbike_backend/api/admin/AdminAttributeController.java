package com.bigbike.bigbike_backend.api.admin;

import com.bigbike.bigbike_backend.api.admin.dto.AttributeSummaryResponse;
import com.bigbike.bigbike_backend.api.admin.dto.AttributeValueResponse;
import com.bigbike.bigbike_backend.api.admin.dto.CreateAttributeRequest;
import com.bigbike.bigbike_backend.api.admin.dto.CreateAttributeValueRequest;
import com.bigbike.bigbike_backend.api.admin.dto.UpdateAttributeRequest;
import com.bigbike.bigbike_backend.api.admin.dto.UpdateAttributeValueRequest;
import com.bigbike.bigbike_backend.api.common.ApiDataResponse;
import com.bigbike.bigbike_backend.api.common.ApiResponseFactory;
import com.bigbike.bigbike_backend.service.admin.AdminAttributeService;
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
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@Validated
@RestController
@RequestMapping("/api/v1/admin")
@RequiredArgsConstructor
public class AdminAttributeController extends AdminControllerSupport {

    private static final String ID_REGEX = "^[A-Za-z0-9_-]+$";

    private final AdminAttributeService adminAttributeService;
    private final DevAdminAuthService devAdminAuthService;
    private final ApiResponseFactory apiResponseFactory;

    @GetMapping("/attributes")
    public List<AttributeSummaryResponse> listAttributes(HttpServletRequest request) {
        devAdminAuthService.requirePermission(request, "products.read");
        return adminAttributeService.listAttributes();
    }

    @PostMapping("/attributes")
    public ApiDataResponse<AttributeSummaryResponse> createAttribute(
            @Valid @RequestBody CreateAttributeRequest payload,
            HttpServletRequest request) {
        devAdminAuthService.requirePermission(request, "products.update");
        return apiResponseFactory.data(adminAttributeService.createAttribute(payload, resolveAdminId()), request);
    }

    @DeleteMapping("/attributes/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteAttribute(
            @PathVariable @Pattern(regexp = ID_REGEX) String id,
            HttpServletRequest request) {
        devAdminAuthService.requirePermission(request, "products.update");
        adminAttributeService.deleteAttribute(id, resolveAdminId());
    }

    @DeleteMapping("/attribute-values/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteAttributeValue(
            @PathVariable @Pattern(regexp = ID_REGEX) String id,
            HttpServletRequest request) {
        devAdminAuthService.requirePermission(request, "products.update");
        adminAttributeService.deleteAttributeValue(id, resolveAdminId());
    }

    @GetMapping("/attributes/{attributeId}/values")
    public List<AttributeValueResponse> listAttributeValues(
            @PathVariable @Pattern(regexp = ID_REGEX) String attributeId,
            HttpServletRequest request) {
        devAdminAuthService.requirePermission(request, "products.read");
        return adminAttributeService.listValues(attributeId);
    }

    @PatchMapping("/attributes/{id}")
    public ApiDataResponse<AttributeSummaryResponse> updateAttribute(
            @PathVariable @Pattern(regexp = ID_REGEX) String id,
            @Valid @RequestBody UpdateAttributeRequest payload,
            HttpServletRequest request) {
        devAdminAuthService.requirePermission(request, "products.update");
        return apiResponseFactory.data(adminAttributeService.updateAttributeName(id, payload, resolveAdminId()), request);
    }

    @PostMapping("/attributes/{attributeId}/values")
    public ApiDataResponse<AttributeValueResponse> createAttributeValue(
            @PathVariable @Pattern(regexp = ID_REGEX) String attributeId,
            @Valid @RequestBody CreateAttributeValueRequest payload,
            HttpServletRequest request) {
        devAdminAuthService.requirePermission(request, "products.update");
        return apiResponseFactory.data(adminAttributeService.createValue(attributeId, payload, resolveAdminId()), request);
    }

    @PatchMapping("/attribute-values/{id}")
    public ApiDataResponse<AttributeValueResponse> updateAttributeValue(
            @PathVariable @Pattern(regexp = ID_REGEX) String id,
            @Valid @RequestBody UpdateAttributeValueRequest payload,
            HttpServletRequest request) {
        devAdminAuthService.requirePermission(request, "products.update");
        return apiResponseFactory.data(adminAttributeService.updateValueLabel(id, payload, resolveAdminId()), request);
    }
}
