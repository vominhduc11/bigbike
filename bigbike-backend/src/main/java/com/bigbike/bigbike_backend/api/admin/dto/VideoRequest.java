package com.bigbike.bigbike_backend.api.admin.dto;

import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
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

    @Pattern(regexp = "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$", message = "Video id must be a UUID.")
    private String id;

    @Size(max = 2048, message = "Video URL is too long.")
    private String url;

    @Size(max = 255, message = "Video title is too long.")
    private String title;

    @Size(max = 255, message = "English video title is too long.")
    private String titleEn;

    @Size(max = 50, message = "Video provider is too long.")
    @Pattern(regexp = "youtube|tiktok|facebook|upload", message = "Video provider is not supported.")
    private String provider;

    @Size(max = 5000, message = "Video description is too long.")
    private String description;

    @Size(max = 5000, message = "English video description is too long.")
    private String descriptionEn;

    @PositiveOrZero(message = "Video duration must not be negative.")
    private Integer durationSeconds;

    private LocalDate uploadedOn;

    @Size(max = 2048, message = "Thumbnail URL is too long.")
    private String thumbnailUrl;

    private Integer sortOrder;
}
