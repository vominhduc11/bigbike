package com.bigbike.bigbike_backend.api.error;

import com.bigbike.bigbike_backend.api.common.ApiError;
import com.bigbike.bigbike_backend.api.common.ApiErrorDetail;
import com.bigbike.bigbike_backend.api.common.ApiErrorResponse;
import com.bigbike.bigbike_backend.api.common.ApiMeta;
import com.bigbike.bigbike_backend.api.common.ApiMetaFactory;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.validation.BindException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

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
        log.warn("Validation failed [{}]: {}", request.getRequestURI(), details);
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
        log.warn("Unreadable request body [{}]: {}", request.getRequestURI(), ex.getMessage());
        ApiErrorDetail detail = new ApiErrorDetail(
                null,
                "INVALID_VALUE",
                "Malformed request body or invalid enum value."
        );
        return build(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "Validation failed.", List.of(detail), request);
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ApiErrorResponse> handleDataIntegrityViolation(
            DataIntegrityViolationException ex, HttpServletRequest request) {
        log.warn("Data integrity violation: {}", ex.getMostSpecificCause().getMessage());
        return build(HttpStatus.CONFLICT, "DATA_CONFLICT",
                "Operation violates a data integrity constraint (e.g. duplicate serial number).",
                List.of(), request);
    }

    @ExceptionHandler(ObjectOptimisticLockingFailureException.class)
    public ResponseEntity<ApiErrorResponse> handleOptimisticLock(
            ObjectOptimisticLockingFailureException ex, HttpServletRequest request) {
        return build(HttpStatus.CONFLICT, "CONCURRENT_MODIFICATION",
                "This record was modified by another request. Please retry.", List.of(), request);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiErrorResponse> handleUnexpected(Exception ex, HttpServletRequest request) {
        log.error("Unhandled exception", ex);
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
