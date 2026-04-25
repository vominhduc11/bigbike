package com.bigbike.bigbike_backend.api.public_.dto;

public record ContactRequest(
        String fullName,
        String phone,
        String email,
        String content
) {}
