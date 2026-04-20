package com.bigbike.bigbike_backend.api.error;

import com.bigbike.bigbike_backend.api.common.ApiErrorDetail;
import java.util.List;
import org.springframework.http.HttpStatus;

public class ApiException extends RuntimeException {

    private final HttpStatus status;
    private final String code;
    private final List<ApiErrorDetail> details;

    public ApiException(HttpStatus status, String code, String message, List<ApiErrorDetail> details) {
        super(message);
        this.status = status;
        this.code = code;
        this.details = details;
    }

    public HttpStatus status() {
        return status;
    }

    public String code() {
        return code;
    }

    public List<ApiErrorDetail> details() {
        return details;
    }
}

