package com.bigbike.bigbike_backend.api.admin;

import com.bigbike.bigbike_backend.api.admin.dto.PatchSliderRequest;
import com.bigbike.bigbike_backend.api.admin.dto.ReorderSlidersRequest;
import com.bigbike.bigbike_backend.api.admin.dto.UpsertSliderRequest;
import com.bigbike.bigbike_backend.api.common.ApiDataResponse;
import com.bigbike.bigbike_backend.api.common.ApiResponseFactory;
import com.bigbike.bigbike_backend.domain.slider.Slider;
import com.bigbike.bigbike_backend.service.admin.AdminSliderService;
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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@Validated
@RestController
@RequestMapping("/api/v1/admin/sliders")
@RequiredArgsConstructor
public class AdminSliderController {

    private static final String LOCATION_REGEX = "^[a-z0-9_-]+$";

    private final AdminSliderService adminSliderService;
    private final DevAdminAuthService devAdminAuthService;
    private final ApiResponseFactory apiResponseFactory;

    @GetMapping
    public ApiDataResponse<List<Slider>> listSliders(
            @RequestParam(defaultValue = "home") @Pattern(regexp = LOCATION_REGEX, message = "Invalid location.") String location,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "sliders.read");
        return apiResponseFactory.data(adminSliderService.list(location), request);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiDataResponse<Slider> createSlider(
            @Valid @RequestBody UpsertSliderRequest payload,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "sliders.write");
        String createdId = adminSliderService.create(payload);
        return apiResponseFactory.data(adminSliderService.findById(createdId), request);
    }

    @PostMapping("/reorder")
    public ApiDataResponse<List<Slider>> reorderSliders(
            @Valid @RequestBody ReorderSlidersRequest payload,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "sliders.write");
        adminSliderService.reorder(payload);
        return apiResponseFactory.data(adminSliderService.list(payload.getLocation()), request);
    }

    @PatchMapping("/{id}")
    public ApiDataResponse<Slider> patchSlider(
            @PathVariable String id,
            @Valid @RequestBody PatchSliderRequest payload,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "sliders.write");
        adminSliderService.patch(id, payload);
        return apiResponseFactory.data(adminSliderService.findById(id), request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteSlider(
            @PathVariable String id,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "sliders.write");
        adminSliderService.delete(id);
    }
}
