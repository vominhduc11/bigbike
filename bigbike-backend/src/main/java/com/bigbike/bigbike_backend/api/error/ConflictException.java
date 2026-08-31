package com.bigbike.bigbike_backend.api.error;

import java.util.List;
import org.springframework.http.HttpStatus;

public class ConflictException extends ApiException {

    public ConflictException(String message) {
        super(HttpStatus.CONFLICT, "CONFLICT", message, List.of());
    }

    public ConflictException(String code, String message) {
        super(HttpStatus.CONFLICT, code, message, List.of());
    }
}
