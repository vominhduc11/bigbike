package com.bigbike.bigbike_backend.api.admin.dto.chat;

import java.util.List;
import java.util.UUID;

public record AdminChatTemplatePrefillResponse(
        UUID feedbackId,
        String topic,
        List<String> triggersVi,
        List<String> triggersEn
) {}
