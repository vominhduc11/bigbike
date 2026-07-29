package com.bigbike.bigbike_backend.service.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.bigbike.bigbike_backend.api.admin.dto.menu.AdminMenuItemResponse;
import com.bigbike.bigbike_backend.api.admin.dto.menu.CreateMenuItemRequest;
import com.bigbike.bigbike_backend.api.admin.dto.menu.PublicMenuResponse;
import com.bigbike.bigbike_backend.api.admin.dto.menu.UpdateMenuItemRequest;
import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.persistence.entity.catalog.CategoryEntity;
import com.bigbike.bigbike_backend.persistence.entity.menu.MenuEntity;
import com.bigbike.bigbike_backend.persistence.entity.menu.MenuItemEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.CategoryJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.menu.MenuItemJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.menu.MenuJpaRepository;
import com.bigbike.bigbike_backend.service.audit.AuditLogWriter;
import com.bigbike.bigbike_backend.service.common.PaginationService;
import com.bigbike.bigbike_backend.service.web.WebRevalidationService;
import com.bigbike.bigbike_backend.service.admin.support.AuditLogFactory;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class AdminMenuServiceTest {

    // Category ids are legacy WP-import strings (e.g. "wp-cat-318"), not UUIDs —
    // see CategoryEntity.id (VARCHAR) vs MenuItemEntity.targetId (VARCHAR, V302).
    private static final String CATEGORY_ID = "wp-cat-318";

    private final MenuJpaRepository menuRepo = mock(MenuJpaRepository.class);
    private final MenuItemJpaRepository menuItemRepo = mock(MenuItemJpaRepository.class);
    private final AuditLogWriter auditLogWriter = mock(AuditLogWriter.class);
    private final AuditLogFactory auditLogFactory = mock(AuditLogFactory.class);
    private final PaginationService paginationService = mock(PaginationService.class);
    private final WebRevalidationService webRevalidationService = mock(WebRevalidationService.class);
    private final CategoryJpaRepository categoryRepo = mock(CategoryJpaRepository.class);

    private final AdminMenuService service = new AdminMenuService(
            menuRepo, menuItemRepo, auditLogWriter, auditLogFactory, paginationService, webRevalidationService, categoryRepo);

    private static CategoryEntity category(String id, String slug, String slugEn, String name, String nameEn) {
        CategoryEntity cat = new CategoryEntity();
        cat.setId(id);
        cat.setSlug(slug);
        cat.setSlugEn(slugEn);
        cat.setName(name);
        cat.setNameEn(nameEn);
        return cat;
    }

    private static MenuEntity menu(UUID id, String location) {
        MenuEntity menu = new MenuEntity();
        menu.setId(id);
        menu.setLocation(location);
        menu.setName("Primary");
        menu.setStatus("ACTIVE");
        menu.setCreatedAt(Instant.now());
        menu.setUpdatedAt(Instant.now());
        return menu;
    }

    @Test
    void createMenuItem_categoryTarget_succeedsWhenCategoryExists() {
        UUID menuId = UUID.randomUUID();
        when(menuRepo.findById(menuId)).thenReturn(Optional.of(menu(menuId, "primary")));
        when(categoryRepo.findById(CATEGORY_ID))
                .thenReturn(Optional.of(category(CATEGORY_ID, "mu-bao-hiem", "helmets", "Mũ bảo hiểm chính hãng", "Genuine helmets")));
        when(menuItemRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        // req.label() is a stale hand-typed value — the service must ignore it and derive the
        // label/url from the linked category instead, proving the "no manual edit" contract.
        CreateMenuItemRequest req = new CreateMenuItemRequest(
                null, "Tên cũ gõ tay", null, "/danh-muc-san-pham/mu-bao-hiem",
                "CATEGORY", CATEGORY_ID, 0, false, null, "ACTIVE");

        AdminMenuItemResponse response = service.createMenuItem(menuId, UUID.randomUUID(), req);

        assertThat(response.targetType()).isEqualTo("CATEGORY");
        assertThat(response.targetId()).isEqualTo(CATEGORY_ID);
        assertThat(response.label()).isEqualTo("Mũ bảo hiểm chính hãng");
        assertThat(response.labelEn()).isEqualTo("Genuine helmets");
        assertThat(response.url()).isEqualTo("/danh-muc/mu-bao-hiem/");
    }

    @Test
    void createMenuItem_categoryTarget_throwsWhenCategoryMissing() {
        UUID menuId = UUID.randomUUID();
        when(menuRepo.findById(menuId)).thenReturn(Optional.of(menu(menuId, "primary")));
        when(categoryRepo.findById(CATEGORY_ID)).thenReturn(Optional.empty());

        CreateMenuItemRequest req = new CreateMenuItemRequest(
                null, "Mũ bảo hiểm", null, "/danh-muc-san-pham/mu-bao-hiem",
                "CATEGORY", CATEGORY_ID, 0, false, null, "ACTIVE");

        assertThrows(ValidationException.class,
                () -> service.createMenuItem(menuId, UUID.randomUUID(), req));
    }

    @Test
    void createMenuItem_customTarget_blankLabel_throws() {
        UUID menuId = UUID.randomUUID();
        when(menuRepo.findById(menuId)).thenReturn(Optional.of(menu(menuId, "primary")));

        CreateMenuItemRequest req = new CreateMenuItemRequest(
                null, "  ", null, "https://example.com",
                "CUSTOM", null, 0, false, null, "ACTIVE");

        assertThrows(ValidationException.class,
                () -> service.createMenuItem(menuId, UUID.randomUUID(), req));
    }

    private MenuItemEntity categoryLinkedItem(MenuEntity menuEntity) {
        MenuItemEntity item = new MenuItemEntity();
        item.setId(UUID.randomUUID());
        item.setMenu(menuEntity);
        item.setLabel("Mũ bảo hiểm");
        item.setUrl("/danh-muc-san-pham/mu-bao-hiem"); // stored VI fallback
        item.setTargetType("CATEGORY");
        item.setTargetId(CATEGORY_ID);
        item.setSortOrder(0);
        item.setStatus("ACTIVE");
        item.setCreatedAt(Instant.now());
        item.setUpdatedAt(Instant.now());
        return item;
    }

    @Test
    void getPublicMenuByLocation_lang_en_usesSlugEnWhenPresent() {
        UUID menuId = UUID.randomUUID();
        MenuEntity menuEntity = menu(menuId, "primary");
        when(menuRepo.findByLocation("primary")).thenReturn(Optional.of(menuEntity));
        when(menuItemRepo.findByMenuIdOrderBySortOrderAsc(menuId))
                .thenReturn(List.of(categoryLinkedItem(menuEntity)));
        when(categoryRepo.findById(CATEGORY_ID))
                .thenReturn(Optional.of(category(CATEGORY_ID, "mu-bao-hiem", "helmets", "Mũ bảo hiểm", "Helmets")));

        PublicMenuResponse response = service.getPublicMenuByLocation("primary", "en");

        assertThat(response.items()).hasSize(1);
        assertThat(response.items().get(0).url()).isEqualTo("/categories/helmets/");
        assertThat(response.items().get(0).label()).isEqualTo("Helmets");
    }

    @Test
    void getPublicMenuByLocation_lang_en_fallsBackToSlugWhenSlugEnBlank() {
        UUID menuId = UUID.randomUUID();
        MenuEntity menuEntity = menu(menuId, "primary");
        when(menuRepo.findByLocation("primary")).thenReturn(Optional.of(menuEntity));
        when(menuItemRepo.findByMenuIdOrderBySortOrderAsc(menuId))
                .thenReturn(List.of(categoryLinkedItem(menuEntity)));
        when(categoryRepo.findById(CATEGORY_ID))
                .thenReturn(Optional.of(category(CATEGORY_ID, "mu-bao-hiem", null, "Mũ bảo hiểm", null)));

        PublicMenuResponse response = service.getPublicMenuByLocation("primary", "en");

        assertThat(response.items().get(0).url()).isEqualTo("/danh-muc/mu-bao-hiem/");
        assertThat(response.items().get(0).label()).isEqualTo("Mũ bảo hiểm");
    }

    @Test
    void getPublicMenuByLocation_categoryDeleted_fallsBackToStoredLabelAndUrl() {
        UUID menuId = UUID.randomUUID();
        MenuEntity menuEntity = menu(menuId, "primary");
        when(menuRepo.findByLocation("primary")).thenReturn(Optional.of(menuEntity));
        when(menuItemRepo.findByMenuIdOrderBySortOrderAsc(menuId))
                .thenReturn(List.of(categoryLinkedItem(menuEntity)));
        when(categoryRepo.findById(CATEGORY_ID)).thenReturn(Optional.empty());

        PublicMenuResponse response = service.getPublicMenuByLocation("primary", "en");

        assertThat(response.items().get(0).url()).isEqualTo("/danh-muc/mu-bao-hiem/");
        assertThat(response.items().get(0).label()).isEqualTo("Mũ bảo hiểm");
    }

    @Test
    void updateMenuItem_categoryLinked_reSyncsLabelUrlFromCategory_ignoringRequestLabel() {
        UUID menuId = UUID.randomUUID();
        MenuEntity menuEntity = menu(menuId, "primary");
        MenuItemEntity item = categoryLinkedItem(menuEntity); // stored label "Mũ bảo hiểm" (stale)
        when(menuRepo.findById(menuId)).thenReturn(Optional.of(menuEntity));
        when(menuItemRepo.findById(item.getId())).thenReturn(Optional.of(item));
        when(categoryRepo.findById(CATEGORY_ID))
                .thenReturn(Optional.of(category(CATEGORY_ID, "mu-bao-hiem", "helmets", "Mũ bảo hiểm chính hãng", "Genuine helmets")));

        // Patch only touches sortOrder, but also (incorrectly) sends a manual label — must be ignored.
        UpdateMenuItemRequest req = new UpdateMenuItemRequest(
                null, null, "Ghi đè tay", null, null, null, null, 5, null, null, null);

        AdminMenuItemResponse response = service.updateMenuItem(menuId, item.getId(), UUID.randomUUID(), req);

        assertThat(response.label()).isEqualTo("Mũ bảo hiểm chính hãng");
        assertThat(response.labelEn()).isEqualTo("Genuine helmets");
        assertThat(response.url()).isEqualTo("/danh-muc/mu-bao-hiem/");
        assertThat(response.sortOrder()).isEqualTo(5);
    }
}
