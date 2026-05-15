package com.bigbike.bigbike_backend.api.admin.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class PatchHomeVideoRequest {

    @Size(max = 255, message = "title is too long.")
    private String title;

    @Size(max = 2048, message = "videoUrl is too long.")
    private String videoUrl;

    @Min(value = 0, message = "sortOrder must be >= 0.")
    private Integer sortOrder;

    @Valid
    private ImageAssetRequest thumbnail;

    private boolean clearThumbnail;

    private Boolean isActive;
}
