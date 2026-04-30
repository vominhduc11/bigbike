package com.bigbike.bigbike_backend.api.admin.dto;

import jakarta.validation.constraints.Size;

public class SpecificationRequest {

    @Size(max = 255, message = "Specification name is too long.")
    private String name;

    @Size(max = 2000, message = "Specification value is too long.")
    private String value;

    @Size(max = 100, message = "Specification group name is too long.")
    private String groupName;

    private Integer sortOrder;

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getValue() { return value; }
    public void setValue(String value) { this.value = value; }

    public String getGroupName() { return groupName; }
    public void setGroupName(String groupName) { this.groupName = groupName; }

    public Integer getSortOrder() { return sortOrder; }
    public void setSortOrder(Integer sortOrder) { this.sortOrder = sortOrder; }
}
