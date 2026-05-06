package com.bigbike.bigbike_backend.api.admin.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class UpsertAuthorRequest {

    @NotBlank(message = "name is required.")
    @Size(max = 255, message = "name must be at most 255 characters.")
    private String name;

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }
}
