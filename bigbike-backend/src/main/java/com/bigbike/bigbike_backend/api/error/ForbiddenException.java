package com.bigbike.bigbike_backend.api.error;

import java.util.List;
import org.springframework.http.HttpStatus;

public class ForbiddenException extends ApiException {

    public ForbiddenException(String message) {
        super(HttpStatus.FORBIDDEN, "FORBIDDEN", message, List.of());
    }
}
