package com.bigbike.bigbike_backend.service.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.bigbike.bigbike_backend.persistence.entity.auth.AdminRoleEntity;
import com.bigbike.bigbike_backend.persistence.repository.auth.AdminRoleJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.auth.AdminUserJpaRepository;
import com.bigbike.bigbike_backend.service.admin.support.AuditLogFactory;
import com.bigbike.bigbike_backend.service.audit.AuditLogWriter;
import java.time.Instant;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;

@ExtendWith(MockitoExtension.class)
class AdminRoleServiceTest {

    @Mock AdminRoleJpaRepository roleRepo;
    @Mock AdminUserJpaRepository adminUserRepo;
    @Mock AuditLogWriter auditLogWriter;
    @Mock AuditLogFactory auditLogFactory;
    @Mock ApplicationEventPublisher eventPublisher;

    @Test
    void getAllRoles_usesSingleGroupedCountQueryAndDefaultsMissingRolesToZero() {
        when(roleRepo.findAll()).thenReturn(List.of(role("ADMIN"), role("CUSTOM_ROLE")));
        when(adminUserRepo.countAssignedUsersByRoleAndStatusIn(anyCollection()))
                .thenReturn(Collections.singletonList(new Object[] {"ADMIN", 3L}));

        AdminRoleService service = new AdminRoleService(
                roleRepo, adminUserRepo, auditLogWriter, auditLogFactory, eventPublisher);

        List<java.util.Map<String, Object>> result = service.getAllRoles();

        assertThat(result).extracting(item -> item.get("assignedUserCount"))
                .containsExactly(3L, 0L);
        verify(adminUserRepo, times(1)).countAssignedUsersByRoleAndStatusIn(anyCollection());
        verify(adminUserRepo, never()).countByRole(anyString());
    }

    private AdminRoleEntity role(String id) {
        AdminRoleEntity role = new AdminRoleEntity();
        role.setId(id);
        role.setName(id);
        role.setDescription("");
        role.setSystem(false);
        role.setPermissions(new LinkedHashSet<>());
        role.setCreatedAt(Instant.parse("2026-01-01T00:00:00Z"));
        role.setUpdatedAt(Instant.parse("2026-01-01T00:00:00Z"));
        return role;
    }
}
