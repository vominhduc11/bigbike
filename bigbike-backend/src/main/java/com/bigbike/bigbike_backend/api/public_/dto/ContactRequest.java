package com.bigbike.bigbike_backend.api.public_.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ContactRequest(
        @NotBlank(message = "fullName is required.")
        @Size(max = 255)
        String fullName,
        @NotBlank(message = "phone is required.")
        @Size(max = 50)
        String phone,
        @Email(message = "email is invalid.")
        @Size(max = 255)
        String email,
        @NotBlank(message = "content is required.")
        @Size(max = 5000)
        String content
) {}
