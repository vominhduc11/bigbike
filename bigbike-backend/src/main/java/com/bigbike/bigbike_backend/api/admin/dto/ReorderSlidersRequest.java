package com.bigbike.bigbike_backend.api.admin.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;

public class ReorderSlidersRequest {

    @NotBlank(message = "location is required.")
    @Pattern(regexp = "^[a-z0-9_-]+$", message = "Invalid location.")
    private String location;

    @NotNull
    @NotEmpty(message = "items must not be empty.")
    @Valid
    private List<Item> items;

    public String getLocation() {
        return location;
    }

    public void setLocation(String location) {
        this.location = location;
    }

    public List<Item> getItems() {
        return items;
    }

    public void setItems(List<Item> items) {
        this.items = items;
    }

    public static class Item {

        @NotBlank(message = "id is required.")
        @Size(max = 64)
        private String id;

        @NotNull(message = "sortOrder is required.")
        @Min(value = 0, message = "sortOrder must be >= 0.")
        private Integer sortOrder;

        public String getId() {
            return id;
        }

        public void setId(String id) {
            this.id = id;
        }

        public Integer getSortOrder() {
            return sortOrder;
        }

        public void setSortOrder(Integer sortOrder) {
            this.sortOrder = sortOrder;
        }
    }
}
