package com.bigbike.bigbike_backend.api.admin.dto.customer;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record UpdateCustomerStatusRequest(
        @NotBlank(message = "Trạng thái không được để trống.")
        String status,

        @Size(max = 1000, message = "Lý do không được vượt quá 1000 ký tự.")
        String reason
) {}
