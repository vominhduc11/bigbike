package com.bigbike.bigbike_backend.api.admin;

import com.bigbike.bigbike_backend.api.admin.dto.PatchHomeVideoRequest;
import com.bigbike.bigbike_backend.api.admin.dto.ReorderHomeVideosRequest;
import com.bigbike.bigbike_backend.api.admin.dto.UpsertHomeVideoRequest;
import com.bigbike.bigbike_backend.api.common.ApiDataResponse;
import com.bigbike.bigbike_backend.api.common.ApiResponseFactory;
import com.bigbike.bigbike_backend.domain.video.HomeVideo;
import com.bigbike.bigbike_backend.service.admin.AdminHomeVideoService;
import com.bigbike.bigbike_backend.service.auth.DevAdminAuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.List;
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
@RequestMapping("/api/v1/admin/home-videos")
public class AdminHomeVideoController {

    private final AdminHomeVideoService adminHomeVideoService;
    private final DevAdminAuthService devAdminAuthService;
    private final ApiResponseFactory apiResponseFactory;

    public AdminHomeVideoController(
            AdminHomeVideoService adminHomeVideoService,
            DevAdminAuthService devAdminAuthService,
            ApiResponseFactory apiResponseFactory
    ) {
        this.adminHomeVideoService = adminHomeVideoService;
        this.devAdminAuthService = devAdminAuthService;
        this.apiResponseFactory = apiResponseFactory;
    }

    @GetMapping
    public ApiDataResponse<List<HomeVideo>> listHomeVideos(HttpServletRequest request) {
        devAdminAuthService.requirePermission(request, "home_videos.read");
        return apiResponseFactory.data(adminHomeVideoService.list(), request);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiDataResponse<HomeVideo> createHomeVideo(
            @Valid @RequestBody UpsertHomeVideoRequest payload,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "home_videos.write");
        return apiResponseFactory.data(adminHomeVideoService.create(payload), request);
    }

    @PatchMapping("/{id}")
    public ApiDataResponse<HomeVideo> patchHomeVideo(
            @PathVariable String id,
            @Valid @RequestBody PatchHomeVideoRequest payload,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "home_videos.write");
        return apiResponseFactory.data(adminHomeVideoService.patch(id, payload), request);
    }

    @PostMapping("/reorder")
    public ApiDataResponse<List<HomeVideo>> reorderHomeVideos(
            @Valid @RequestBody ReorderHomeVideosRequest payload,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "home_videos.write");
        return apiResponseFactory.data(adminHomeVideoService.reorder(payload), request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteHomeVideo(
            @PathVariable String id,
            HttpServletRequest request
    ) {
        devAdminAuthService.requirePermission(request, "home_videos.write");
        adminHomeVideoService.delete(id);
    }
}
