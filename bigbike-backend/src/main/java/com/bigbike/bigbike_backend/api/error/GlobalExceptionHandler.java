package com.bigbike.bigbike_backend.api.error;

import com.bigbike.bigbike_backend.api.common.ApiError;
import com.bigbike.bigbike_backend.api.common.ApiErrorDetail;
import com.bigbike.bigbike_backend.api.common.ApiErrorResponse;
import com.bigbike.bigbike_backend.api.common.ApiMeta;
import com.bigbike.bigbike_backend.api.common.ApiMetaFactory;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.BindException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger LOG = LoggerFactory.getLogger(GlobalExceptionHandler.class);
    private final ApiMetaFactory apiMetaFactory;

    public GlobalExceptionHandler(ApiMetaFactory apiMetaFactory) {
        this.apiMetaFactory = apiMetaFactory;
    }

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ApiErrorResponse> handleApiException(ApiException ex, HttpServletRequest request) {
        return build(ex.status(), ex.code(), ex.getMessage(), ex.details(), request);
    }

    @ExceptionHandler({ConstraintViolationException.class, MethodArgumentNotValidException.class, BindException.class})
    public ResponseEntity<ApiErrorResponse> handleConstraintViolations(Exception ex, HttpServletRequest request) {
        List<ApiErrorDetail> details = ValidationErrorMapper.from(ex);
        return build(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "Validation failed.", details, request);
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ApiErrorResponse> handleArgumentTypeMismatch(
            MethodArgumentTypeMismatchException ex,
            HttpServletRequest request
    ) {
        ApiErrorDetail detail = new ApiErrorDetail(
                ex.getName(),
                "INVALID_TYPE",
                "Invalid value type."
        );
        return build(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "Validation failed.", List.of(detail), request);
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiErrorResponse> handleUnreadableMessage(
            HttpMessageNotReadableException ex,
            HttpServletRequest request
    ) {
        ApiErrorDetail detail = new ApiErrorDetail(
                null,
                "INVALID_VALUE",
                "Malformed request body or invalid enum value."
        );
        return build(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "Validation failed.", List.of(detail), request);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiErrorResponse> handleUnexpected(Exception ex, HttpServletRequest request) {
        LOG.error("Unhandled exception", ex);
        return build(HttpStatus.INTERNAL_SERVER_ERROR, "SERVER_ERROR", "An unexpected error occurred.", List.of(), request);
    }

    private ResponseEntity<ApiErrorResponse> build(
            HttpStatus status,
            String code,
            String message,
            List<ApiErrorDetail> details,
            HttpServletRequest request
    ) {
        ApiMeta meta = apiMetaFactory.from(request);
        ApiErrorResponse payload = new ApiErrorResponse(new ApiError(code, message, details), meta);
        return ResponseEntity.status(status).body(payload);
    }
}
