package com.bigbike.bigbike_backend.service.auth;

import java.util.UUID;

/**
 * Published inside the mutation transaction and consumed only after a successful commit. The event
 * deliberately carries no permission data: every client reloads its profile from the normal auth
 * endpoint and the backend continues to decide every request.
 */
public record AdminAccessChangeEvent(
        UUID adminUserId,
        String reason,
        boolean forceReauthentication
) {}
