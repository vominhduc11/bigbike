package com.bigbike.bigbike_backend.api.chat.dto;

/**
 * A fixed, frontend-owned action offered after a chat answer. The server never
 * accepts a URL from the model; the storefront maps these types to its own
 * localized routes.
 */
public record ChatActionResponse(String type) {}
