package com.bigbike.bigbike_backend.api.error;

import java.util.List;
import org.springframework.http.HttpStatus;

public class GoneException extends ApiException {

    public GoneException(String message) {
        super(HttpStatus.GONE, "GONE", message, List.of());
    }
}
