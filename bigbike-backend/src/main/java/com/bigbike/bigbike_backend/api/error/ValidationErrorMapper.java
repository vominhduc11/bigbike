package com.bigbike.bigbike_backend.api.error;

import com.bigbike.bigbike_backend.api.common.ApiErrorDetail;
import jakarta.validation.ConstraintViolationException;
import java.util.List;
import org.springframework.validation.BindException;
import org.springframework.web.bind.MethodArgumentNotValidException;

final class ValidationErrorMapper {

    private ValidationErrorMapper() {
    }

    static List<ApiErrorDetail> from(Exception ex) {
        if (ex instanceof ConstraintViolationException cve) {
            return cve.getConstraintViolations().stream()
                    .map(violation -> new ApiErrorDetail(
                            lastPath(violation.getPropertyPath().toString()),
                            "INVALID_VALUE",
                            violation.getMessage()
                    ))
                    .toList();
        }

        if (ex instanceof MethodArgumentNotValidException manve) {
            return manve.getBindingResult().getFieldErrors().stream()
                    .map(error -> new ApiErrorDetail(
                            error.getField(),
                            "INVALID_VALUE",
                            error.getDefaultMessage() == null ? "Invalid value." : error.getDefaultMessage()
                    ))
                    .toList();
        }

        if (ex instanceof BindException be) {
            return be.getBindingResult().getFieldErrors().stream()
                    .map(error -> new ApiErrorDetail(
                            error.getField(),
                            "INVALID_VALUE",
                            error.getDefaultMessage() == null ? "Invalid value." : error.getDefaultMessage()
                    ))
                    .toList();
        }

        return List.of(new ApiErrorDetail(null, "INVALID_VALUE", "Invalid value."));
    }

    private static String lastPath(String path) {
        if (path == null || path.isBlank()) {
            return null;
        }
        String[] parts = path.split("\\.");
        return parts[parts.length - 1];
    }
}

