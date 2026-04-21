package com.bigbike.bigbike_backend.api.admin.dto.menu;

import jakarta.validation.constraints.NotNull;
import java.util.List;

public record ReorderMenuItemsRequest(
        @NotNull List<ReorderMenuItemRequest> items
) {}
