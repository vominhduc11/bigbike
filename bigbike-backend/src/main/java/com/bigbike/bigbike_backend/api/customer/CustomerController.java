package com.bigbike.bigbike_backend.api.customer;

import com.bigbike.bigbike_backend.api.common.ApiDataResponse;
import com.bigbike.bigbike_backend.api.common.ApiResponseFactory;
import com.bigbike.bigbike_backend.api.customer.dto.CustomerSummary;
import com.bigbike.bigbike_backend.api.customer.dto.UpdateCustomerProfileRequest;
import com.bigbike.bigbike_backend.api.error.UnauthorizedException;
import com.bigbike.bigbike_backend.domain.customer.CustomerPrincipal;
import com.bigbike.bigbike_backend.service.customer.CustomerAuthService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/customer")
public class CustomerController {

    private final CustomerAuthService authService;
    private final ApiResponseFactory apiResponseFactory;

    public CustomerController(CustomerAuthService authService, ApiResponseFactory apiResponseFactory) {
        this.authService = authService;
        this.apiResponseFactory = apiResponseFactory;
    }

    @GetMapping("/me")
    public ApiDataResponse<CustomerSummary> me(HttpServletRequest request) {
        CustomerPrincipal principal = requireCustomer();
        return apiResponseFactory.data(authService.getProfile(principal.customerId()), request);
    }

    @PatchMapping("/me")
    public ApiDataResponse<CustomerSummary> updateMe(@RequestBody UpdateCustomerProfileRequest req, HttpServletRequest request) {
        CustomerPrincipal principal = requireCustomer();
        return apiResponseFactory.data(authService.updateProfile(principal.customerId(), req), request);
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private CustomerPrincipal requireCustomer() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof CustomerPrincipal principal) {
            return principal;
        }
        throw new UnauthorizedException("Customer authentication required.");
    }
}
