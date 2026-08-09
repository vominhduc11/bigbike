package com.bigbike.bigbike_backend.api.chat.dto;

public record ChatContactResponse(
        String hotline,
        String zaloUrl,
        String messengerUrl,
        String zaloDisplay,
        String messengerDisplay
) {}
