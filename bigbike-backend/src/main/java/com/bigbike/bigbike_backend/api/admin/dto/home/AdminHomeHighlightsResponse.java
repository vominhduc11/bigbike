package com.bigbike.bigbike_backend.api.admin.dto.home;

import com.bigbike.bigbike_backend.api.public_.dto.HomeHighlightItemDto;
import java.util.List;

public record AdminHomeHighlightsResponse(
        List<HomeHighlightItemDto> items,
        Long version
) {
}
