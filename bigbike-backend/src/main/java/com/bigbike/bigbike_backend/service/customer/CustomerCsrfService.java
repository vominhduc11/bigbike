package com.bigbike.bigbike_backend.service.customer;

import com.bigbike.bigbike_backend.service.auth.JwtService;
import org.springframework.stereotype.Service;

@Service
public class CustomerCsrfService {

    private final JwtService jwtService;

    public CustomerCsrfService(JwtService jwtService) {
        this.jwtService = jwtService;
    }

    public String generateCsrfToken() {
        return jwtService.generateRawRefreshToken();
    }
}
