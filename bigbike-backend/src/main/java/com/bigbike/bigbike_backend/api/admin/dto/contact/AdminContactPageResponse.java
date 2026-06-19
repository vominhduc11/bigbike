package com.bigbike.bigbike_backend.api.admin.dto.contact;

import com.bigbike.bigbike_backend.domain.content.ContactBlock;
import java.util.List;

/**
 * Admin read of the contact page builder: the full block list (incl. disabled blocks) plus the
 * current values of every whitelisted {@code contact} setting key so the screen can edit them inline.
 *
 * @param blocks ordered layout blocks (all, regardless of enabled)
 * @param values current value of each bound/bindable contact setting
 */
public record AdminContactPageResponse(
        List<ContactBlock> blocks,
        List<SettingValue> values
) {
    public record SettingValue(String key, String value, String valueEn) {}
}
