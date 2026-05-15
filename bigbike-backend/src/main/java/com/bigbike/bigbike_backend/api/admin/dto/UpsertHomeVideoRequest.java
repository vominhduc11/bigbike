package com.bigbike.bigbike_backend.api.admin.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
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
public class UpsertHomeVideoRequest {

    @NotBlank(message = "title is required.")
    @Size(max = 255, message = "title is too long.")
    private String title;

    @NotBlank(message = "videoUrl is required.")
    @Size(max = 2048, message = "videoUrl is too long.")
    private String videoUrl;

    @NotNull(message = "sortOrder is required.")
    @Min(value = 0, message = "sortOrder must be >= 0.")
    private Integer sortOrder;

    @Valid
    private ImageAssetRequest thumbnail;

    private Boolean isActive;
}
