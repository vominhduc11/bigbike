package com.bigbike.bigbike_backend.api.admin.dto.chat;

import java.util.List;

public record AdminChatTemplatePreviewResponse(
        boolean matched,
        String answer,
        String source,
        List<String> violations,
        boolean canEnable
) {}
