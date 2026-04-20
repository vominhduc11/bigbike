package com.bigbike.bigbike_backend.api.error;

import java.util.List;
import org.springframework.http.HttpStatus;

public class AuthNotImplementedException extends ApiException {

    public AuthNotImplementedException(String message) {
        super(HttpStatus.NOT_IMPLEMENTED, "AUTH_NOT_IMPLEMENTED", message, List.of());
    }
}
