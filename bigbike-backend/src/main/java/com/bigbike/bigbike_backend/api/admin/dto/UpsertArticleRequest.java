package com.bigbike.bigbike_backend.api.admin.dto;

import com.bigbike.bigbike_backend.domain.catalog.DescriptionBlock;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class UpsertArticleRequest {

    private static final String SLUG_REGEX = "^[a-z0-9]+(?:-[a-z0-9]+)*$";

    @Pattern(regexp = SLUG_REGEX, message = "Slug format is invalid.")
    private String slug;

    @Size(max = 255, message = "Title is too long.")
    private String title;

    @Size(max = 5000, message = "Excerpt is too long.")
    private String excerpt;

    private String body;

    @Valid
    private ImageAssetRequest coverImage;

    @Valid
    private ImageAssetRequest productImage;

    @Size(max = 64, message = "Category ID is too long.")
    private String categoryId;

    private PublishStatus publishStatus;

    /** Featured article flag (V222). Null = leave unchanged on update. */
    private Boolean featured;

    @Valid
    private SeoMetaRequest seo;

    @Valid
    private ArticleTranslationRequest translations;

    /**
     * Structured body blocks (V140). Presence-flag pattern: key present in JSON → overwrite both
     * body_blocks and body columns. Key absent → leave both columns unchanged.
     */
    @Valid
    @Size(max = 200, message = "bodyBlocks must not exceed 200 blocks.")
    private List<DescriptionBlock> bodyBlocks;

    @JsonIgnore
    @Setter(AccessLevel.NONE)
    private boolean bodyBlocksPresent = false;

    public void setBodyBlocks(List<DescriptionBlock> bodyBlocks) {
        this.bodyBlocks = bodyBlocks;
        this.bodyBlocksPresent = true;
    }

    @JsonIgnore
    public boolean isBodyBlocksPresent() {
        return bodyBlocksPresent;
    }
}

