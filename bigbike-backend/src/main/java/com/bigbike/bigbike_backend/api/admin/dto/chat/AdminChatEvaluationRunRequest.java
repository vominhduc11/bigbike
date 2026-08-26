package com.bigbike.bigbike_backend.api.admin.dto.chat;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.util.List;

public record AdminChatEvaluationRunRequest(
        @NotBlank @Size(max = 80) String datasetVersion,
        @NotEmpty @Size(max = 4) List<@NotBlank @Size(max = 120) String> modelIds,
        @DecimalMin("0.01") @DecimalMax("2.00") BigDecimal maxCostUsd
) {}
