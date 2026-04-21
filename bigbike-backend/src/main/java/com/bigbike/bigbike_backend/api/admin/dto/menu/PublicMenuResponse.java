package com.bigbike.bigbike_backend.api.admin.dto.menu;

import java.util.List;

public record PublicMenuResponse(
        String location,
        String name,
        List<PublicMenuItemResponse> items
) {}
