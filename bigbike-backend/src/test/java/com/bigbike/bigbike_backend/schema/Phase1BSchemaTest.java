package com.bigbike.bigbike_backend.schema;

import static org.assertj.core.api.Assertions.assertThat;

import com.bigbike.bigbike_backend.persistence.entity.audit.AuditLogEntity;
import com.bigbike.bigbike_backend.persistence.entity.coupon.CouponEntity;
import com.bigbike.bigbike_backend.persistence.entity.customer.CustomerAddressEntity;
import com.bigbike.bigbike_backend.persistence.entity.customer.CustomerEntity;
import com.bigbike.bigbike_backend.persistence.entity.media.MediaEntity;
import com.bigbike.bigbike_backend.persistence.entity.menu.MenuEntity;
import com.bigbike.bigbike_backend.persistence.entity.menu.MenuItemEntity;
import com.bigbike.bigbike_backend.persistence.entity.redirect.RedirectEntity;
import com.bigbike.bigbike_backend.persistence.entity.settings.SiteSettingEntity;
import com.bigbike.bigbike_backend.persistence.entity.shipping.ShippingMethodEntity;
import com.bigbike.bigbike_backend.persistence.entity.shipping.ShippingZoneEntity;
import com.bigbike.bigbike_backend.persistence.repository.audit.AuditLogJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.coupon.CouponJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.customer.CustomerAddressJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.customer.CustomerJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.media.MediaJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.menu.MenuItemJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.menu.MenuJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.redirect.RedirectJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.settings.SiteSettingJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.shipping.ShippingMethodJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.shipping.ShippingZoneJpaRepository;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.jdbc.Sql;

@SpringBootTest
@Sql(scripts = "/db/test-seed.sql", executionPhase = Sql.ExecutionPhase.BEFORE_TEST_CLASS)
class Phase1BSchemaTest {

    @Autowired CustomerJpaRepository customerRepo;
    @Autowired CustomerAddressJpaRepository customerAddressRepo;
    @Autowired MediaJpaRepository mediaRepo;
    @Autowired RedirectJpaRepository redirectRepo;
    @Autowired MenuJpaRepository menuRepo;
    @Autowired MenuItemJpaRepository menuItemRepo;
    @Autowired CouponJpaRepository couponRepo;
    @Autowired ShippingZoneJpaRepository shippingZoneRepo;
    @Autowired ShippingMethodJpaRepository shippingMethodRepo;
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

    @Test
    void shippingZone_seedLoaded() {
        List<ShippingZoneEntity> zones = shippingZoneRepo.findByEnabledOrderBySortOrderAsc(true);
        assertThat(zones).isNotEmpty();
        assertThat(zones.get(0).getRegionCode()).isEqualTo("VN");
    }

    @Test
    void shippingMethods_seedLoaded() {
        List<ShippingZoneEntity> zones = shippingZoneRepo.findByEnabledOrderBySortOrderAsc(true);
        assertThat(zones).isNotEmpty();
        UUID zoneId = zones.get(0).getId();

        List<ShippingMethodEntity> methods = shippingMethodRepo.findByZoneId(zoneId);
        assertThat(methods).hasSizeGreaterThanOrEqualTo(2);
    }

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
    void redirect_saveAndFind() {
        RedirectEntity r = new RedirectEntity();
        r.setSourcePattern("/old-page-" + UUID.randomUUID());
        r.setTargetUrl("/new-page");
        r.setRedirectType("exact");
        r.setStatusCode(301);
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

    // ── coupon round-trip ──────────────────────────────────────────────────

    @Test
    void coupon_saveAndFind() {
        CouponEntity coupon = new CouponEntity();
        coupon.setCode("TEST10-" + UUID.randomUUID().toString().substring(0, 8));
        coupon.setName("Test 10%");
        coupon.setDiscountType("percentage");
        coupon.setAmount(new BigDecimal("10.00"));
        coupon.setStatus("ACTIVE");
        coupon.setCreatedAt(Instant.now());
        coupon.setUpdatedAt(Instant.now());
        CouponEntity saved = couponRepo.save(coupon);

        assertThat(saved.getId()).isNotNull();
        assertThat(couponRepo.findByCode(saved.getCode())).isPresent();
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
