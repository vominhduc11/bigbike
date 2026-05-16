package com.bigbike.bigbike_backend.api.customer;

import com.bigbike.bigbike_backend.api.common.ApiDataResponse;
import com.bigbike.bigbike_backend.api.common.ApiResponseFactory;
import com.bigbike.bigbike_backend.api.customer.dto.CustomerAddressResponse;
import com.bigbike.bigbike_backend.api.customer.dto.SaveCustomerAddressRequest;
import com.bigbike.bigbike_backend.api.error.UnauthorizedException;
import com.bigbike.bigbike_backend.domain.customer.CustomerPrincipal;
import com.bigbike.bigbike_backend.service.customer.CustomerAddressService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/customer/addresses")
@RequiredArgsConstructor
public class CustomerAddressController {

    private final CustomerAddressService addressService;
    private final ApiResponseFactory apiResponseFactory;

    @GetMapping
    public ApiDataResponse<List<CustomerAddressResponse>> list(HttpServletRequest request) {
        UUID customerId = requireCustomer();
        return apiResponseFactory.data(addressService.listAddresses(customerId), request);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiDataResponse<CustomerAddressResponse> create(@Valid @RequestBody SaveCustomerAddressRequest req, HttpServletRequest request) {
        UUID customerId = requireCustomer();
        return apiResponseFactory.data(addressService.save(customerId, req), request);
    }

    @PatchMapping("/{id}")
    public ApiDataResponse<CustomerAddressResponse> update(@PathVariable UUID id, @Valid @RequestBody SaveCustomerAddressRequest req, HttpServletRequest request) {
        UUID customerId = requireCustomer();
        return apiResponseFactory.data(addressService.update(customerId, id, req), request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id) {
        UUID customerId = requireCustomer();
        addressService.delete(customerId, id);
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private UUID requireCustomer() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof CustomerPrincipal principal) {
            return principal.customerId();
        }
        throw new UnauthorizedException("Customer authentication required.");
    }
}
