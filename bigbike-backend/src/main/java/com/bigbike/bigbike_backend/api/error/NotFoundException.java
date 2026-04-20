package com.bigbike.bigbike_backend.api.error;

import java.util.List;
import org.springframework.http.HttpStatus;

public class NotFoundException extends ApiException {

    public NotFoundException(String message) {
        super(HttpStatus.NOT_FOUND, "NOT_FOUND", message, List.of());
    }
}

