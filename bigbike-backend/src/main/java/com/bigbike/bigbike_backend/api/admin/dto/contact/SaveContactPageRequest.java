package com.bigbike.bigbike_backend.api.admin.dto.contact;

import com.bigbike.bigbike_backend.domain.content.ContactBlock;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * Payload for {@code PUT /api/v1/admin/contact-page}. The builder sends the full block list (layout)
 * plus the edited values of bound contact settings — the service writes those through to
 * {@code site_settings} (whitelist-guarded) so the header/footer stay in sync, and never duplicates
 * them inside the stored block JSON.
 *
 * @param blocks ordered layout blocks (whole array replaces the previous one)
 * @param values write-through values for whitelisted {@code contact} setting keys (may be empty)
 */
public record SaveContactPageRequest(
        @NotNull(message = "blocks is required.")
        @Size(max = 40, message = "A contact page can have at most 40 blocks.")
        List<@Valid ContactBlock> blocks,

        @Size(max = 40, message = "Too many setting values.")
        List<@Valid SettingValueInput> values
) {
    /** One write-through value for a bound contact setting key. */
    public record SettingValueInput(
            @NotBlank(message = "value.key is required.")
            @Size(max = 64, message = "value.key must not exceed 64 characters.")
            String key,

            @Size(max = 2000, message = "value must not exceed 2 000 characters.")
            String value,

            @Size(max = 2000, message = "valueEn must not exceed 2 000 characters.")
            String valueEn
    ) {}
}
