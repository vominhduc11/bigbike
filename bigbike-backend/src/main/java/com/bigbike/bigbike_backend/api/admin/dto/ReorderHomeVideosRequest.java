package com.bigbike.bigbike_backend.api.admin.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReorderHomeVideosRequest {

    @NotNull
    @NotEmpty(message = "items must not be empty.")
    @Valid
    private List<Item> items;

    @Getter
    @Setter
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Item {

        @NotBlank(message = "id is required.")
        @Size(max = 64)
        private String id;

        @NotNull(message = "sortOrder is required.")
        @Min(value = 0, message = "sortOrder must be >= 0.")
        private Integer sortOrder;
    }
}
