package com.bigbike.bigbike_backend.api.admin;

import com.bigbike.bigbike_backend.api.admin.dto.AttributeSummaryResponse;
import com.bigbike.bigbike_backend.api.admin.dto.AttributeValueResponse;
import com.bigbike.bigbike_backend.api.admin.dto.AttributeValueSwatchRequest;
import com.bigbike.bigbike_backend.service.admin.AdminAttributeService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Pattern;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Validated
@RestController
@RequestMapping("/api/v1/admin")
@RequiredArgsConstructor
public class AdminAttributeController extends AdminControllerSupport {

    private static final String ID_REGEX = "^[A-Za-z0-9_-]+$";

    private final AdminAttributeService adminAttributeService;

    @GetMapping("/attributes")
    public List<AttributeSummaryResponse> listAttributes() {
        return adminAttributeService.listAttributes();
    }

    @GetMapping("/attributes/{attributeId}/values")
    public List<AttributeValueResponse> listAttributeValues(
            @PathVariable @Pattern(regexp = ID_REGEX) String attributeId) {
        return adminAttributeService.listValues(attributeId);
    }

    @PatchMapping("/attribute-values/{id}/swatch")
    public AttributeValueResponse updateSwatch(
            @PathVariable @Pattern(regexp = ID_REGEX) String id,
            @Valid @RequestBody AttributeValueSwatchRequest request) {
        return adminAttributeService.updateSwatch(id, request);
    }
}
