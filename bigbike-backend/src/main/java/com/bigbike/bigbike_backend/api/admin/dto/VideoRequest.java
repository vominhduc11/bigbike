package com.bigbike.bigbike_backend.api.admin.dto;

import jakarta.validation.constraints.Pattern;
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
public class VideoRequest {

    @Size(max = 2048, message = "Video URL is too long.")
    private String url;

    @Size(max = 255, message = "Video title is too long.")
    private String title;

    @Size(max = 50, message = "Video provider is too long.")
    @Pattern(regexp = "youtube|upload", message = "Video provider must be 'youtube' or 'upload'.")
    private String provider;

    @Size(max = 5000, message = "Video description is too long.")
    private String description;

    @Size(max = 2048, message = "Thumbnail URL is too long.")
    private String thumbnailUrl;

    private Integer sortOrder;
}
