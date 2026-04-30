package com.bigbike.bigbike_backend.api.admin.dto;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.hibernate.validator.constraints.URL;

public class ImageAssetRequest {

    @Size(max = 2048, message = "Image URL is too long.")
    @URL(message = "Image URL must be a valid URL.")
    @Pattern(regexp = "^https?://.*", flags = Pattern.Flag.CASE_INSENSITIVE,
            message = "Image URL must use http or https scheme.")
    private String url;

    @Size(max = 255, message = "Image alt is too long.")
    private String alt;

    private Integer width;
    private Integer height;

    @Size(max = 100, message = "Image mimeType is too long.")
    private String mimeType;

    public String getUrl() {
        return url;
    }

    public void setUrl(String url) {
        this.url = url;
    }

    public String getAlt() {
        return alt;
    }

    public void setAlt(String alt) {
        this.alt = alt;
    }

    public Integer getWidth() {
        return width;
    }

    public void setWidth(Integer width) {
        this.width = width;
    }

    public Integer getHeight() {
        return height;
    }

    public void setHeight(Integer height) {
        this.height = height;
    }

    public String getMimeType() {
        return mimeType;
    }

    public void setMimeType(String mimeType) {
        this.mimeType = mimeType;
    }
}
