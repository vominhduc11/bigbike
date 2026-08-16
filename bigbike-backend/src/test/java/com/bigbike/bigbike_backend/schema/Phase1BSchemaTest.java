package com.bigbike.bigbike_backend.schema;

import static org.assertj.core.api.Assertions.assertThat;

import com.bigbike.bigbike_backend.persistence.entity.audit.AuditLogEntity;
import com.bigbike.bigbike_backend.persistence.entity.customer.CustomerAddressEntity;
import com.bigbike.bigbike_backend.persistence.entity.customer.CustomerEntity;
import com.bigbike.bigbike_backend.persistence.entity.media.MediaEntity;
import com.bigbike.bigbike_backend.persistence.entity.menu.MenuEntity;
import com.bigbike.bigbike_backend.persistence.entity.menu.MenuItemEntity;
import com.bigbike.bigbike_backend.persistence.entity.redirect.RedirectEntity;
import com.bigbike.bigbike_backend.persistence.entity.settings.SiteSettingEntity;
import com.bigbike.bigbike_backend.persistence.repository.audit.AuditLogJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.customer.CustomerAddressJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.customer.CustomerJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.media.MediaJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.menu.MenuItemJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.menu.MenuJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.redirect.RedirectJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.settings.SiteSettingJpaRepository;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.jdbc.Sql;

@SpringBootTest
@Sql(scripts = "/db/test-seed.sql", executionPhase = Sql.ExecutionPhase.BEFORE_TEST_CLASS)
class Phase1BSchemaTest {

    @Autowired CustomerJpaRepository customerRepo;
    @Autowired CustomerAddressJpaRepository customerAddressRepo;
    @Autowired MediaJpaRepository mediaRepo;
    @Autowired RedirectJpaRepository redirectRepo;
    @Autowired JdbcTemplate jdbcTemplate;
    @Autowired MenuJpaRepository menuRepo;
    @Autowired MenuItemJpaRepository menuItemRepo;
    @Autowired SiteSettingJpaRepository siteSettingRepo;
    @Autowired AuditLogJpaRepository auditLogRepo;

    // ── seed data loaded by V1001 ──────────────────────────────────────────

    @Test
    void siteSettings_seedLoaded() {
        Optional<SiteSettingEntity> siteName = siteSettingRepo.findBySettingKey("site.name");
        assertThat(siteName).isPresent();
        assertThat(siteName.get().getSettingValue()).isEqualTo("\"BigBike\"");

        List<SiteSettingEntity> all = siteSettingRepo.findAll();
        assertThat(all).hasSizeGreaterThanOrEqualTo(4);
    }

    @Test
    void menus_seedLoaded() {
        Optional<MenuEntity> primary = menuRepo.findByLocation("primary");
        assertThat(primary).isPresent();
        assertThat(primary.get().getStatus()).isEqualTo("ACTIVE");

        assertThat(menuRepo.findByLocation("footer")).isPresent();
        assertThat(menuRepo.findByLocation("guide")).isPresent();
    }

    // Shipping zone/method seed tests removed (owner decision 2026-06-23) — see V264.

    // ── customer round-trip ────────────────────────────────────────────────

    @Test
    void customer_saveAndFind() {
        CustomerEntity c = new CustomerEntity();
        c.setEmail("test-" + UUID.randomUUID() + "@example.com");
        c.setStatus("ACTIVE");
        c.setSynthetic(false);
        c.setCreatedAt(Instant.now());
        c.setUpdatedAt(Instant.now());
        CustomerEntity saved = customerRepo.save(c);

        assertThat(saved.getId()).isNotNull();
        assertThat(customerRepo.findByEmail(saved.getEmail())).isPresent();
    }

    @Test
    void customerAddress_saveAndFind() {
        CustomerEntity c = new CustomerEntity();
        c.setEmail("addr-" + UUID.randomUUID() + "@example.com");
        c.setStatus("ACTIVE");
        c.setSynthetic(false);
        c.setCreatedAt(Instant.now());
        c.setUpdatedAt(Instant.now());
        customerRepo.save(c);

        CustomerAddressEntity addr = new CustomerAddressEntity();
        addr.setCustomer(c);
        addr.setType("shipping");
        addr.setFullName("Nguyen Van A");
        addr.setCountry("VN");
        addr.setAddressLine1("123 Le Loi");
        addr.setDefault(false);
        addr.setCreatedAt(Instant.now());
        addr.setUpdatedAt(Instant.now());
        customerAddressRepo.save(addr);

        List<CustomerAddressEntity> found = customerAddressRepo.findByCustomerId(c.getId());
        assertThat(found).hasSize(1);
    }

    // ── media round-trip ───────────────────────────────────────────────────

    @Test
    void media_saveAndFind() {
        MediaEntity m = new MediaEntity();
        m.setFilePath("/uploads/test.jpg");
        m.setStorageProvider("local");
        m.setStatus("ACTIVE");
        m.setCreatedAt(Instant.now());
        m.setUpdatedAt(Instant.now());
        MediaEntity saved = mediaRepo.save(m);

        assertThat(saved.getId()).isNotNull();
        assertThat(mediaRepo.findByStorageProvider("local")).isNotEmpty();
    }

    // ── redirect round-trip ────────────────────────────────────────────────

    @Test
    void redirectMigration_keepsStatusCodeAndRemovesLegacyTypeColumn() {
        Long statusCodeColumns = jdbcTemplate.queryForObject(
                "select count(*) from information_schema.columns "
                        + "where table_schema = current_schema() and table_name = 'redirects' "
                        + "and column_name = 'status_code'",
                Long.class);
        Long legacyTypeColumns = jdbcTemplate.queryForObject(
                "select count(*) from information_schema.columns "
                        + "where table_schema = current_schema() and table_name = 'redirects' "
                        + "and column_name = 'redirect_type'",
                Long.class);
        Long removedIndex = jdbcTemplate.queryForObject(
                "select count(*) from information_schema.indexes "
                        + "where upper(table_name) = 'REDIRECTS' "
                        + "and upper(index_name) = 'IDX_REDIRECTS_STATUS_CODE'",
                Long.class);
        assertThat(statusCodeColumns).isEqualTo(1L);
        assertThat(legacyTypeColumns).isZero();
        assertThat(removedIndex).isZero();
        assertThat(redirectRepo.findAll()).allSatisfy(redirect -> {
            assertThat(redirect.getSourcePattern()).isNotBlank();
            assertThat(redirect.getTargetUrl()).isNotBlank();
        });
    }

    @Test
    void redirect_saveAndFind() {
        RedirectEntity r = new RedirectEntity();
        r.setSourcePattern("/old-page-" + UUID.randomUUID());
        r.setTargetUrl("/new-page");
        r.setEnabled(true);
        r.setCreatedAt(Instant.now());
        r.setUpdatedAt(Instant.now());
        RedirectEntity saved = redirectRepo.save(r);

        assertThat(saved.getId()).isNotNull();
        assertThat(redirectRepo.findBySourcePattern(saved.getSourcePattern())).isPresent();
        assertThat(redirectRepo.findByEnabled(true)).isNotEmpty();
    }

    // ── menu item round-trip ───────────────────────────────────────────────

    @Test
    void menuItem_saveAndFind() {
        Optional<MenuEntity> primary = menuRepo.findByLocation("primary");
        assertThat(primary).isPresent();
        MenuEntity menu = primary.get();

        MenuItemEntity item = new MenuItemEntity();
        item.setMenu(menu);
        item.setLabel("Home");
        item.setUrl("/");
        item.setSortOrder(1);
        item.setOpenInNewTab(false);
        item.setStatus("ACTIVE");
        item.setCreatedAt(Instant.now());
        item.setUpdatedAt(Instant.now());
        menuItemRepo.save(item);

        List<MenuItemEntity> items = menuItemRepo.findByMenuIdOrderBySortOrderAsc(menu.getId());
        assertThat(items).isNotEmpty();
        assertThat(items.get(0).getLabel()).isEqualTo("Home");
    }

    // ── audit log round-trip ───────────────────────────────────────────────

    @Test
    void auditLog_saveAndFind() {
        UUID actorId = UUID.randomUUID();
        AuditLogEntity log = new AuditLogEntity();
        log.setActorType("admin");
        log.setActorId(actorId);
        log.setAction("CREATE");
        log.setResourceType("product");
        log.setResourceId(UUID.randomUUID());
        log.setCreatedAt(Instant.now());
        auditLogRepo.save(log);

        List<AuditLogEntity> found = auditLogRepo.findByActorId(actorId);
        assertThat(found).hasSize(1);
        assertThat(found.get(0).getAction()).isEqualTo("CREATE");
    }

    // ── site settings group query ──────────────────────────────────────────

    @Test
    void siteSettings_findByGroup() {
        List<SiteSettingEntity> general = siteSettingRepo.findBySettingGroup("general");
        assertThat(general).isNotEmpty();
    }
}
