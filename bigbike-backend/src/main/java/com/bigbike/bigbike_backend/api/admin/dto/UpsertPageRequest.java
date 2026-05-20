package com.bigbike.bigbike_backend.api.admin.dto;

import com.bigbike.bigbike_backend.domain.catalog.DescriptionBlock;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.domain.content.PageType;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Pattern;
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
public class UpsertPageRequest {

    private static final String SLUG_REGEX = "^[a-z0-9]+(?:-[a-z0-9]+)*$";

    @Pattern(regexp = SLUG_REGEX, message = "Slug format is invalid.")
    private String slug;

    @Size(max = 255, message = "Title is too long.")
    private String title;

    private String body;
    @Size(max = 64, message = "Parent ID is too long.")
    private String parentId;
    private PageType pageType;
    private PublishStatus publishStatus;

    @Valid
    private SeoMetaRequest seo;

    @Valid
    private ImageAssetRequest heroImage;

    @Size(max = 256, message = "Hero title is too long.")
    private String heroTitle;

    @Size(max = 1024, message = "Hero description is too long.")
    private String heroDescription;

    @Size(max = 128, message = "Hero kicker is too long.")
    private String heroKicker;

    @Valid
    private PageTranslationRequest translations;

    /**
     * Structured body blocks (V140). Presence-flag pattern: key present in JSON → overwrite both
     * body_blocks and body columns. Key absent → leave both columns unchanged.
     */
    @Valid
    @Size(max = 200, message = "bodyBlocks must not exceed 200 blocks.")
    private List<DescriptionBlock> bodyBlocks;

    private boolean bodyBlocksPresent = false;

    public void setBodyBlocks(List<DescriptionBlock> bodyBlocks) {
        this.bodyBlocks = bodyBlocks;
        this.bodyBlocksPresent = true;
    }

    public boolean isBodyBlocksPresent() {
        return bodyBlocksPresent;
    }
}
