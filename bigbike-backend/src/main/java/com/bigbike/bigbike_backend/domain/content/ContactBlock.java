package com.bigbike.bigbike_backend.domain.content;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * One block of the admin-managed contact page layout ({@code /lien-he}).
 *
 * <p>Stored as an element of a {@code List<ContactBlock>} in the {@code contact_page_layout.blocks}
 * JSONB column. The block holds only <em>layout</em> (type, order, column, icon, labels) plus the
 * value of <em>custom</em> (unbound) channels. For channels bound to a shared site setting via
 * {@link #bindKey()} (hotline, address, social URLs, opening hours), the live value lives in
 * {@code site_settings} — single source of truth shared with the header/footer — and is written
 * through the contact-page endpoint, never duplicated here.
 *
 * @param id        stable client key for drag-reorder / React keys
 * @param type      one of {@code channel|address|hours|map|richtext}
 * @param enabled   whether the block renders on the public page
 * @param sortOrder render order within its column (ascending)
 * @param column    {@code main} (left) or {@code online} (right) in the two-column body
 * @param icon      lucide icon name (e.g. {@code Phone}) or an absolute/media image URL
 * @param labelVi   Vietnamese heading shown above the block
 * @param labelEn   English heading; storefront falls back to {@link #labelVi()} when blank
 * @param bindKey   site_settings key feeding this block's value, or null for a custom block
 * @param value     literal value for a custom (unbound) channel
 * @param href      literal link for a custom (unbound) channel
 * @param htmlVi    rich HTML body for a {@code richtext} block (Vietnamese)
 * @param htmlEn    rich HTML body for a {@code richtext} block (English; falls back to VI)
 */
public record ContactBlock(
        @NotBlank(message = "block.id is required.")
        @Size(max = 64, message = "block.id must not exceed 64 characters.")
        String id,

        @NotNull(message = "block.type is required.")
        @Pattern(regexp = "channel|address|hours|map|richtext",
                message = "block.type must be one of channel, address, hours, map, richtext.")
        String type,

        boolean enabled,

        @NotNull(message = "block.sortOrder is required.")
        @Min(value = 0, message = "block.sortOrder must be >= 0.")
        @Max(value = 999, message = "block.sortOrder must be <= 999.")
        Integer sortOrder,

        @Pattern(regexp = "main|online", message = "block.column must be 'main' or 'online'.")
        String column,

        @Size(max = 200, message = "block.icon must not exceed 200 characters.")
        String icon,

        @Size(max = 200, message = "block.labelVi must not exceed 200 characters.")
        String labelVi,

        @Size(max = 200, message = "block.labelEn must not exceed 200 characters.")
        String labelEn,

        @Size(max = 64, message = "block.bindKey must not exceed 64 characters.")
        String bindKey,

        @Size(max = 2000, message = "block.value must not exceed 2 000 characters.")
        String value,

        @Size(max = 2000, message = "block.href must not exceed 2 000 characters.")
        String href,

        @Size(max = 20000, message = "block.htmlVi must not exceed 20 000 characters.")
        String htmlVi,

        @Size(max = 20000, message = "block.htmlEn must not exceed 20 000 characters.")
        String htmlEn
) {}
