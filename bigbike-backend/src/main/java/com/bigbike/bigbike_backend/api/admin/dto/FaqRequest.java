package com.bigbike.bigbike_backend.api.admin.dto;

import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** A single product FAQ entry in an {@link UpsertProductRequest}. */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FaqRequest {

    @Size(max = 500, message = "FAQ question is too long.")
    private String question;

    @Size(max = 20000, message = "FAQ answer is too long.")
    private String answer;

    private Integer sortOrder;
}
