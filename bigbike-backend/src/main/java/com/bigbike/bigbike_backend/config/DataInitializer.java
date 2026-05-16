package com.bigbike.bigbike_backend.config;

import com.bigbike.bigbike_backend.persistence.entity.auth.AdminUserEntity;
import com.bigbike.bigbike_backend.persistence.repository.auth.AdminUserJpaRepository;
import com.bigbike.bigbike_backend.service.auth.PasswordService;
import java.time.Instant;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.annotation.Profile;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@Profile("!prod")
@Slf4j
public class DataInitializer {

    private final AdminUserJpaRepository adminUserRepo;
    private final PasswordService passwordService;
    private final String seedAdminEmail;
    private final String seedAdminPassword;

    public DataInitializer(
            AdminUserJpaRepository adminUserRepo,
            PasswordService passwordService,
            @Value("${bigbike.seed.admin-email:admin@bigbike.vn}") String seedAdminEmail,
            @Value("${bigbike.seed.admin-password:admin123}") String seedAdminPassword
    ) {
        this.adminUserRepo = adminUserRepo;
        this.passwordService = passwordService;
        this.seedAdminEmail = seedAdminEmail;
        this.seedAdminPassword = seedAdminPassword;
    }

    @EventListener(ApplicationReadyEvent.class)
    @Transactional
    public void seedDefaultAdmin() {
        if (adminUserRepo.count() > 0) return;

        AdminUserEntity admin = new AdminUserEntity();
        admin.setEmail(seedAdminEmail);
        admin.setPasswordHash(passwordService.hash(seedAdminPassword));
        admin.setDisplayName("Super Admin");
        admin.setRole("SUPER_ADMIN");
        admin.setStatus("ACTIVE");
        admin.setCreatedAt(Instant.now());
        admin.setUpdatedAt(Instant.now());
        adminUserRepo.save(admin);

        log.warn("Seeded default admin user: {} — change the password immediately!", seedAdminEmail);
    }
}
