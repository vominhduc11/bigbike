package com.bigbike.bigbike_backend.service.auth;

/** Minimal STOMP payload for an affected admin's own user queue. */
public record AdminAccessChangeMessage(String reason, boolean forceReauthentication) {}
