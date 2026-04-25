package com.bigbike.bigbike_backend.config;

import com.bigbike.bigbike_backend.persistence.entity.auth.AdminUserEntity;
import com.bigbike.bigbike_backend.persistence.repository.auth.AdminUserJpaRepository;
import com.bigbike.bigbike_backend.service.auth.PasswordService;
import java.time.Instant;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class DataInitializer {

    private static final Logger log = LoggerFactory.getLogger(DataInitializer.class);

    private final AdminUserJpaRepository adminUserRepo;
    private final PasswordService passwordService;

    public DataInitializer(AdminUserJpaRepository adminUserRepo, PasswordService passwordService) {
        this.adminUserRepo = adminUserRepo;
        this.passwordService = passwordService;
    }

    @EventListener(ApplicationReadyEvent.class)
    @Transactional
    public void seedDefaultAdmin() {
        if (adminUserRepo.count() > 0) return;

        AdminUserEntity admin = new AdminUserEntity();
        admin.setEmail("admin@bigbike.vn");
        admin.setPasswordHash(passwordService.hash("admin123"));
        admin.setDisplayName("Super Admin");
        admin.setRole("SUPER_ADMIN");
        admin.setStatus("ACTIVE");
        admin.setCreatedAt(Instant.now());
        admin.setUpdatedAt(Instant.now());
        adminUserRepo.save(admin);

        log.info("Seeded default admin user: admin@bigbike.vn / admin123");
    }
}
