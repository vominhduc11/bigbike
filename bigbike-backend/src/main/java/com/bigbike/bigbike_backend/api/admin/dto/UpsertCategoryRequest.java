package com.bigbike.bigbike_backend.api.admin.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public class UpsertCategoryRequest {

    @NotBlank(message = "slug is required.")
    @Pattern(regexp = "^[a-z0-9]+(?:-[a-z0-9]+)*$", message = "slug must be lowercase alphanumeric with hyphens.")
    @Size(max = 100, message = "slug must be at most 100 characters.")
    private String slug;

    @NotBlank(message = "name is required.")
    @Size(max = 255, message = "name must be at most 255 characters.")
    private String name;

    public String getSlug() { return slug; }
    public void setSlug(String slug) { this.slug = slug; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
}
