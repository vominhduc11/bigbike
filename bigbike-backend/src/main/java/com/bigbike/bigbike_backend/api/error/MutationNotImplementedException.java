package com.bigbike.bigbike_backend.api.error;

import java.util.List;
import org.springframework.http.HttpStatus;

public class MutationNotImplementedException extends ApiException {

    public MutationNotImplementedException(String message) {
        super(HttpStatus.NOT_IMPLEMENTED, "MUTATION_NOT_IMPLEMENTED", message, List.of());
    }
}

