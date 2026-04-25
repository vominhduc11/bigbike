package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.persistence.entity.auth.AdminUserEntity;
import com.bigbike.bigbike_backend.persistence.repository.auth.AdminUserJpaRepository;
import com.bigbike.bigbike_backend.service.auth.PasswordService;
import com.bigbike.bigbike_backend.service.common.PageResult;
import com.bigbike.bigbike_backend.service.common.PaginationService;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminAdminUsersService {

    private static final int DEFAULT_SIZE = 20;
    private static final int MAX_SIZE = 100;

    private final AdminUserJpaRepository adminUserRepo;
    private final PaginationService paginationService;
    private final PasswordService passwordService;

    public AdminAdminUsersService(
            AdminUserJpaRepository adminUserRepo,
            PaginationService paginationService,
            PasswordService passwordService
    ) {
        this.adminUserRepo = adminUserRepo;
        this.paginationService = paginationService;
        this.passwordService = passwordService;
    }

    public PageResult<Map<String, Object>> listAdminUsers(int page, int size, String q) {
        int normalizedPage = Math.max(1, page);
        int normalizedSize = (size <= 0) ? DEFAULT_SIZE : Math.min(size, MAX_SIZE);

        List<AdminUserEntity> all = adminUserRepo.findAll();
        if (q != null && !q.isBlank()) {
            String qLower = q.toLowerCase(Locale.ROOT);
            all = all.stream()
                    .filter(u -> matches(u.getEmail(), qLower) || matches(u.getDisplayName(), qLower))
                    .toList();
        }
        List<Map<String, Object>> mapped = all.stream().map(this::toMap).toList();
        return paginationService.paginate(mapped, normalizedPage, normalizedSize);
    }

    public Map<String, Object> getAdminUser(UUID id) {
        return toMap(adminUserRepo.findById(id)
                .orElseThrow(() -> new NotFoundException("Admin user not found.")));
    }

    @Transactional
    public Map<String, Object> updateAdminUser(UUID id, String displayName, String status, String newPassword) {
        AdminUserEntity entity = adminUserRepo.findById(id)
                .orElseThrow(() -> new NotFoundException("Admin user not found."));
        if (displayName != null && !displayName.isBlank()) entity.setDisplayName(displayName.trim());
        if (status != null && !status.isBlank()) entity.setStatus(status.toUpperCase(Locale.ROOT));
        if (newPassword != null && !newPassword.isBlank()) {
            entity.setPasswordHash(passwordService.hash(newPassword));
        }
        entity.setUpdatedAt(Instant.now());
        return toMap(adminUserRepo.save(entity));
    }

    private boolean matches(String field, String q) {
        return field != null && field.toLowerCase(Locale.ROOT).contains(q);
    }

    private Map<String, Object> toMap(AdminUserEntity u) {
        return Map.of(
                "id", u.getId().toString(),
                "email", u.getEmail(),
                "displayName", u.getDisplayName(),
                "role", u.getRole() != null ? u.getRole() : "",
                "status", u.getStatus() != null ? u.getStatus() : "",
                "lastLoginAt", u.getLastLoginAt() != null ? u.getLastLoginAt().toString() : "",
                "createdAt", u.getCreatedAt() != null ? u.getCreatedAt().toString() : "",
                "updatedAt", u.getUpdatedAt() != null ? u.getUpdatedAt().toString() : ""
        );
    }
}
