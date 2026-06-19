package com.bigbike.bigbike_backend.domain.content;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * One card of the admin-managed guide landing page ({@code /huong-dan}).
 *
 * <p>Stored as an element of a {@code List<GuideEntry>} in the {@code guide_page_layout.entries}
 * JSONB column. An entry holds only the <em>card</em> (icon, bilingual title/description, order) and
 * a pointer to where the detailed body lives: {@link #pathSegment()} is the friendly URL under
 * {@code /huong-dan/}, {@link #pageSlug()} is the CMS page ({@code pages}) whose body/SEO/EN content
 * the storefront renders — the body itself is <em>not</em> duplicated here.
 *
 * @param id             stable client key for drag-reorder / React keys
 * @param enabled        whether the card renders on the public landing grid
 * @param sortOrder      render order within the grid (ascending)
 * @param pathSegment    URL segment under {@code /huong-dan/} (e.g. {@code mua-hang})
 * @param pageSlug       CMS page slug holding the detail body (e.g. {@code huong-dan-mua-hang})
 * @param icon           lucide icon name (e.g. {@code BookOpen}) or an absolute/media image URL
 * @param titleVi        Vietnamese card title
 * @param titleEn        English card title; storefront falls back to {@link #titleVi()} when blank
 * @param descriptionVi  Vietnamese short description
 * @param descriptionEn  English short description; falls back to {@link #descriptionVi()}
 */
public record GuideEntry(
        @NotBlank(message = "entry.id is required.")
        @Size(max = 64, message = "entry.id must not exceed 64 characters.")
        String id,

        boolean enabled,

        @NotNull(message = "entry.sortOrder is required.")
        @Min(value = 0, message = "entry.sortOrder must be >= 0.")
        @Max(value = 999, message = "entry.sortOrder must be <= 999.")
        Integer sortOrder,

        @NotBlank(message = "entry.pathSegment is required.")
        @Size(max = 100, message = "entry.pathSegment must not exceed 100 characters.")
        @Pattern(regexp = "[a-z0-9]+(?:-[a-z0-9]+)*",
                message = "entry.pathSegment must be a lowercase slug (e.g. mua-hang).")
        String pathSegment,

        @NotBlank(message = "entry.pageSlug is required.")
        @Size(max = 200, message = "entry.pageSlug must not exceed 200 characters.")
        String pageSlug,

        @Size(max = 500, message = "entry.icon must not exceed 500 characters.")
        String icon,

        @NotBlank(message = "entry.titleVi is required.")
        @Size(max = 200, message = "entry.titleVi must not exceed 200 characters.")
        String titleVi,

        @Size(max = 200, message = "entry.titleEn must not exceed 200 characters.")
        String titleEn,

        @Size(max = 1000, message = "entry.descriptionVi must not exceed 1 000 characters.")
        String descriptionVi,

        @Size(max = 1000, message = "entry.descriptionEn must not exceed 1 000 characters.")
        String descriptionEn
) {}
