package com.bigbike.bigbike_backend.api.checkout.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record CheckoutAddressRequest(
        @NotBlank(message = "fullName is required.")
        @Size(max = 255)
        String fullName,
        @Email(message = "email is invalid.")
        @Size(max = 255)
        String email,
        @NotBlank(message = "phone is required.")
        @Pattern(regexp = "^\\+?[0-9]{8,15}$", message = "phone is invalid.")
        String phone,
        @Size(max = 100)
        String country,
        @Size(max = 255)
        String province,
        @Size(max = 255)
        String district,
        @Size(max = 255)
        String ward,
        @NotBlank(message = "addressLine1 is required.")
        @Size(max = 500)
        String addressLine1,
        @Size(max = 500)
        String addressLine2
) {}
