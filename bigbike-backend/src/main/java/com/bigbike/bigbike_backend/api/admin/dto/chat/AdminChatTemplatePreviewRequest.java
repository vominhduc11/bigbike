package com.bigbike.bigbike_backend.api.admin.dto.chat;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;

public record AdminChatTemplatePreviewRequest(
        @Size(max = 120) String topic,
        List<@Size(max = 160) String> triggersVi,
        List<@Size(max = 160) String> triggersEn,
        @Size(max = 2000) String answerVi,
        @Size(max = 2000) String answerEn,
        @NotBlank @Pattern(regexp = "^(vi|en)$") String locale,
        @NotBlank @Size(max = 1000) String sampleQuestion
) {}
