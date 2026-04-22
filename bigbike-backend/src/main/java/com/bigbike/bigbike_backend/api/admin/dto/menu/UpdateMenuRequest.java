package com.bigbike.bigbike_backend.api.admin.dto.menu;

public record UpdateMenuRequest(
        String name,
        String status
) {}
