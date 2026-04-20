package com.bigbike.bigbike_backend.api.common;

import com.bigbike.bigbike_backend.service.common.PageResult;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Component;

@Component
public class ApiResponseFactory {

    private final ApiMetaFactory apiMetaFactory;

    public ApiResponseFactory(ApiMetaFactory apiMetaFactory) {
        this.apiMetaFactory = apiMetaFactory;
    }

    public <T> ApiDataResponse<T> data(T data, HttpServletRequest request) {
        return new ApiDataResponse<>(data, apiMetaFactory.from(request));
    }

    public <T> ApiListResponse<T> list(PageResult<T> pageResult, HttpServletRequest request) {
        PaginationMeta paginationMeta = new PaginationMeta(
                pageResult.page(),
                pageResult.pageSize(),
                pageResult.totalItems(),
                pageResult.totalPages(),
                pageResult.page() < pageResult.totalPages(),
                pageResult.page() > 1
        );
        return new ApiListResponse<>(pageResult.items(), paginationMeta, apiMetaFactory.from(request));
    }
}

