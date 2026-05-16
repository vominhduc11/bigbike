package com.bigbike.bigbike_backend.api.admin;

import com.bigbike.bigbike_backend.api.admin.dto.media.MediaFolderResponse;
import com.bigbike.bigbike_backend.api.admin.dto.media.UpsertMediaFolderRequest;
import com.bigbike.bigbike_backend.api.common.ApiDataResponse;
import com.bigbike.bigbike_backend.api.common.ApiListResponse;
import com.bigbike.bigbike_backend.api.common.ApiResponseFactory;
import com.bigbike.bigbike_backend.service.admin.AdminMediaFolderService;
import com.bigbike.bigbike_backend.service.auth.DevAdminAuthService;
import com.bigbike.bigbike_backend.service.common.PageResult;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/media-folders")
@RequiredArgsConstructor
public class AdminMediaFolderController {

    private final AdminMediaFolderService folderService;
    private final DevAdminAuthService authService;
    private final ApiResponseFactory responseFactory;

    @GetMapping
    public ApiListResponse<MediaFolderResponse> list(HttpServletRequest request) {
        authService.requirePermission(request, "media.read");
        List<MediaFolderResponse> all = folderService.listAll();
        // Wrap into PageResult so the response shape stays consistent with other list endpoints.
        return responseFactory.list(new PageResult<>(all, 1, all.size(), all.size(), 1), request);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiDataResponse<MediaFolderResponse> create(
            @Valid @RequestBody UpsertMediaFolderRequest body,
            HttpServletRequest request
    ) {
        authService.requirePermission(request, "media.write");
        return responseFactory.data(folderService.create(body), request);
    }

    @PatchMapping("/{id}")
    public ApiDataResponse<MediaFolderResponse> update(
            @PathVariable UUID id,
            @Valid @RequestBody UpsertMediaFolderRequest body,
            HttpServletRequest request
    ) {
        authService.requirePermission(request, "media.write");
        return responseFactory.data(folderService.update(id, body), request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id, HttpServletRequest request) {
        authService.requirePermission(request, "media.write");
        folderService.delete(id);
    }
}
