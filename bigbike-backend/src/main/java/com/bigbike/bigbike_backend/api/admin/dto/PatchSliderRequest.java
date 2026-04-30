package com.bigbike.bigbike_backend.api.admin.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public class PatchSliderRequest {

    @Pattern(regexp = "^[a-z0-9_-]+$", message = "Invalid location.")
    private String location;

    @Min(value = 0, message = "sortOrder must be >= 0.")
    private Integer sortOrder;

    private Boolean isActive;

    @Valid
    private ImageAssetRequest desktopImage;

    @Valid
    private ImageAssetRequest mobileImage;

    @Size(max = 64, message = "productId is too long.")
    private String productId;

    @Size(max = 2048, message = "externalLink is too long.")
    private String externalLink;

    /** True when the payload is a full edit (location is present). */
    public boolean isFullEdit() {
        return location != null;
    }

    public String getLocation() {
        return location;
    }

    public void setLocation(String location) {
        this.location = location;
    }

    public Integer getSortOrder() {
        return sortOrder;
    }

    public void setSortOrder(Integer sortOrder) {
        this.sortOrder = sortOrder;
    }

    public Boolean getIsActive() {
        return isActive;
    }

    public void setIsActive(Boolean isActive) {
        this.isActive = isActive;
    }

    public ImageAssetRequest getDesktopImage() {
        return desktopImage;
    }

    public void setDesktopImage(ImageAssetRequest desktopImage) {
        this.desktopImage = desktopImage;
    }

    public ImageAssetRequest getMobileImage() {
        return mobileImage;
    }

    public void setMobileImage(ImageAssetRequest mobileImage) {
        this.mobileImage = mobileImage;
    }

    public String getProductId() {
        return productId;
    }

    public void setProductId(String productId) {
        this.productId = productId;
    }

    public String getExternalLink() {
        return externalLink;
    }

    public void setExternalLink(String externalLink) {
        this.externalLink = externalLink;
    }
}
