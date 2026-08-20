package com.bigbike.bigbike_backend.api.chat.dto;

import java.util.UUID;

public record ChatInteractionResponse(boolean recorded, UUID interactionId) {}
