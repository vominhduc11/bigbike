package com.bigbike.bigbike_backend.api.admin.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
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
public class SetHomepageBlocksRequest {

    @NotNull
    @Size(max = 12, message = "featuredGrid cannot contain more than 12 products.")
    @Valid
    private List<@NotBlank @Size(max = 64) String> featuredGrid;
}
