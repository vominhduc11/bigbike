package com.bigbike.bigbike_backend.service.auth;

/** Published after a role's permission set has been durably updated. */
public record AdminRolePermissionsChangedEvent(String roleId) {}
