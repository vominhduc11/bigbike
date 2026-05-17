package com.bigbike.bigbike_backend.api.admin.dto.menu;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

public record ReorderMenuItemsRequest(
        @NotNull
        @Size(max = 500)
        List<@Valid ReorderMenuItemRequest> items
) {}
