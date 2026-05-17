package com.bigbike.bigbike_backend.api.admin.dto.contact;

import jakarta.validation.constraints.Size;
import java.util.UUID;

/**
 * Patch payload for an admin updating a contact message.
 *
 * <p>All fields are optional. Only fields that are non-null are applied — sending
 * {@code {"status":"RESOLVED"}} updates only the status without clearing the
 * admin note or assignee.
 */
public record UpdateContactMessageRequest(
        @Size(max = 32, message = "status is too long.")
        String status,
        @Size(max = 4000, message = "adminNote is too long.")
        String adminNote,
        UUID assignedAdminId
) {}
