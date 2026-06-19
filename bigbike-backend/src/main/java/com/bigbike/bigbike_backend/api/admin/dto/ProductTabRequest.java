package com.bigbike.bigbike_backend.api.admin.dto;

import com.bigbike.bigbike_backend.domain.catalog.DescriptionBlock;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Một tab PDP trong payload upsert sản phẩm (V231). {@code label}/{@code blocks} là bản tiếng Việt
 * (canonical), {@code labelEn}/{@code blocksEn} là bản tiếng Anh. Tab tự do (type=custom) mới dùng blocks.
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProductTabRequest {

    @Size(max = 64, message = "Tab id is too long.")
    private String id;

    @Size(max = 32, message = "Tab type is too long.")
    private String type;

    private boolean enabled;

    private Integer sortOrder;

    @Size(max = 200, message = "Tab label is too long.")
    private String label;

    @Size(max = 200, message = "Tab English label is too long.")
    private String labelEn;

    @Valid
    @Size(max = 200, message = "Tab blocks may not have more than 200 items.")
    private List<DescriptionBlock> blocks;

    @Valid
    @Size(max = 200, message = "Tab English blocks may not have more than 200 items.")
    private List<DescriptionBlock> blocksEn;
}
