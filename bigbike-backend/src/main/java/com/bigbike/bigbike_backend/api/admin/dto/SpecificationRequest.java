package com.bigbike.bigbike_backend.api.admin.dto;

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
public class SpecificationRequest {

    @Size(max = 255, message = "Specification name is too long.")
    private String name;

    @Size(max = 2000, message = "Specification value is too long.")
    private String value;

    @Size(max = 100, message = "Specification group name is too long.")
    private String groupName;

    private Integer sortOrder;
}
