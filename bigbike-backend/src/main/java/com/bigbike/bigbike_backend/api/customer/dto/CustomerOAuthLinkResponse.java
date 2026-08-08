package com.bigbike.bigbike_backend.api.customer.dto;

import java.time.Instant;

/**
 * One social identity linked to the signed-in customer, for the "Tài khoản liên kết" panel.
 *
 * @param provider    {@code google} or {@code facebook}
 * @param linkedAt    when the link was created
 * @param canUnlink   false when removing it would leave the account with no way to sign in
 *                    (no password and this is the last link)
 */
public record CustomerOAuthLinkResponse(String provider, Instant linkedAt, boolean canUnlink) {
}
