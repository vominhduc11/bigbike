package com.bigbike.bigbike_backend.api.error;

import com.bigbike.bigbike_backend.api.common.ApiErrorDetail;
import java.util.List;
import org.springframework.http.HttpStatus;

public class ValidationException extends ApiException {

    public ValidationException(String message, List<ApiErrorDetail> details) {
        super(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", message, details);
    }

    public static ValidationException fromField(String field, String code, String message) {
        return new ValidationException(
                "Validation failed.",
                List.of(new ApiErrorDetail(field, code, message))
        );
    }
}

