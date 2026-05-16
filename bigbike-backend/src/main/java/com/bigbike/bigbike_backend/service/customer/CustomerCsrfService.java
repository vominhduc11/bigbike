package com.bigbike.bigbike_backend.service.customer;

import com.bigbike.bigbike_backend.service.auth.JwtService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class CustomerCsrfService {

    private final JwtService jwtService;

    public String generateCsrfToken() {
        return jwtService.generateRawRefreshToken();
    }
}
