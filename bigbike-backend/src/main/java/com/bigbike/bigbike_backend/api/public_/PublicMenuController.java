package com.bigbike.bigbike_backend.api.public_;

import com.bigbike.bigbike_backend.api.admin.dto.menu.PublicMenuResponse;
import com.bigbike.bigbike_backend.api.common.ApiDataResponse;
import com.bigbike.bigbike_backend.api.common.ApiResponseFactory;
import com.bigbike.bigbike_backend.service.admin.AdminMenuService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/menus")
@RequiredArgsConstructor
public class PublicMenuController {

    private final AdminMenuService adminMenuService;
    private final ApiResponseFactory apiResponseFactory;

    @GetMapping("/{location}")
    public ApiDataResponse<PublicMenuResponse> getPublicMenu(
            @PathVariable String location,
            HttpServletRequest request
    ) {
        return apiResponseFactory.data(adminMenuService.getPublicMenuByLocation(location), request);
    }
}
