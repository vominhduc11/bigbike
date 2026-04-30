package com.bigbike.bigbike_backend.api.admin.dto;

import jakarta.validation.constraints.Size;

public class VariantOptionRequest {

    @Size(max = 100, message = "Option name is too long.")
    private String optionName;

    @Size(max = 255, message = "Option value is too long.")
    private String optionValue;

    public String getOptionName() { return optionName; }
    public void setOptionName(String optionName) { this.optionName = optionName; }

    public String getOptionValue() { return optionValue; }
    public void setOptionValue(String optionValue) { this.optionValue = optionValue; }
}
