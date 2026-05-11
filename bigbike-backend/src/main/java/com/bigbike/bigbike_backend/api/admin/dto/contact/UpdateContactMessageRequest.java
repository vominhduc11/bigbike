package com.bigbike.bigbike_backend.api.admin.dto.contact;

import java.util.UUID;

/**
 * Patch payload for an admin updating a contact message.
 *
 * <p>All fields are optional. Only fields that are non-null are applied — sending
 * {@code {"status":"RESOLVED"}} updates only the status without clearing the
 * admin note or assignee.
 */
public record UpdateContactMessageRequest(
        String status,
        String adminNote,
        UUID assignedAdminId
) {}
