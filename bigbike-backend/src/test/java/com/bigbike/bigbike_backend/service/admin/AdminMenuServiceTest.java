package com.bigbike.bigbike_backend.service.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.bigbike.bigbike_backend.api.admin.dto.menu.AdminMenuItemResponse;
import com.bigbike.bigbike_backend.api.admin.dto.menu.CreateMenuItemRequest;
import com.bigbike.bigbike_backend.api.admin.dto.menu.PublicMenuResponse;
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
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class AdminMenuServiceTest {

    private final MenuJpaRepository menuRepo = mock(MenuJpaRepository.class);
    private final MenuItemJpaRepository menuItemRepo = mock(MenuItemJpaRepository.class);
    private final AuditLogWriter auditLogWriter = mock(AuditLogWriter.class);
    private final PaginationService paginationService = mock(PaginationService.class);
    private final WebRevalidationService webRevalidationService = mock(WebRevalidationService.class);
    private final CategoryJpaRepository categoryRepo = mock(CategoryJpaRepository.class);

    private final AdminMenuService service = new AdminMenuService(
            menuRepo, menuItemRepo, auditLogWriter, paginationService, webRevalidationService, categoryRepo);

    private static CategoryEntity category(String id, String slug, String slugEn) {
        CategoryEntity cat = new CategoryEntity();
        cat.setId(id);
        cat.setSlug(slug);
        cat.setSlugEn(slugEn);
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
        UUID categoryId = UUID.randomUUID();
        when(menuRepo.findById(menuId)).thenReturn(Optional.of(menu(menuId, "primary")));
        when(categoryRepo.findById(categoryId.toString()))
                .thenReturn(Optional.of(category(categoryId.toString(), "mu-bao-hiem", "helmets")));
        when(menuItemRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        CreateMenuItemRequest req = new CreateMenuItemRequest(
                null, "Mũ bảo hiểm", null, "/danh-muc-san-pham/mu-bao-hiem",
                "CATEGORY", categoryId, 0, false, null, "ACTIVE");

        AdminMenuItemResponse response = service.createMenuItem(menuId, UUID.randomUUID(), req);

        assertThat(response.targetType()).isEqualTo("CATEGORY");
        assertThat(response.targetId()).isEqualTo(categoryId);
    }

    @Test
    void createMenuItem_categoryTarget_throwsWhenCategoryMissing() {
        UUID menuId = UUID.randomUUID();
        UUID categoryId = UUID.randomUUID();
        when(menuRepo.findById(menuId)).thenReturn(Optional.of(menu(menuId, "primary")));
        when(categoryRepo.findById(categoryId.toString())).thenReturn(Optional.empty());

        CreateMenuItemRequest req = new CreateMenuItemRequest(
                null, "Mũ bảo hiểm", null, "/danh-muc-san-pham/mu-bao-hiem",
                "CATEGORY", categoryId, 0, false, null, "ACTIVE");

        assertThrows(ValidationException.class,
                () -> service.createMenuItem(menuId, UUID.randomUUID(), req));
    }

    private MenuItemEntity categoryLinkedItem(UUID menuId, UUID categoryId, MenuEntity menuEntity) {
        MenuItemEntity item = new MenuItemEntity();
        item.setId(UUID.randomUUID());
        item.setMenu(menuEntity);
        item.setLabel("Mũ bảo hiểm");
        item.setUrl("/danh-muc-san-pham/mu-bao-hiem"); // stored VI fallback
        item.setTargetType("CATEGORY");
        item.setTargetId(categoryId);
        item.setSortOrder(0);
        item.setStatus("ACTIVE");
        item.setCreatedAt(Instant.now());
        item.setUpdatedAt(Instant.now());
        return item;
    }

    @Test
    void getPublicMenuByLocation_lang_en_usesSlugEnWhenPresent() {
        UUID menuId = UUID.randomUUID();
        UUID categoryId = UUID.randomUUID();
        MenuEntity menuEntity = menu(menuId, "primary");
        when(menuRepo.findByLocation("primary")).thenReturn(Optional.of(menuEntity));
        when(menuItemRepo.findByMenuIdOrderBySortOrderAsc(menuId))
                .thenReturn(List.of(categoryLinkedItem(menuId, categoryId, menuEntity)));
        when(categoryRepo.findById(categoryId.toString()))
                .thenReturn(Optional.of(category(categoryId.toString(), "mu-bao-hiem", "helmets")));

        PublicMenuResponse response = service.getPublicMenuByLocation("primary", "en");

        assertThat(response.items()).hasSize(1);
        assertThat(response.items().get(0).url()).isEqualTo("/danh-muc-san-pham/helmets");
    }

    @Test
    void getPublicMenuByLocation_lang_en_fallsBackToSlugWhenSlugEnBlank() {
        UUID menuId = UUID.randomUUID();
        UUID categoryId = UUID.randomUUID();
        MenuEntity menuEntity = menu(menuId, "primary");
        when(menuRepo.findByLocation("primary")).thenReturn(Optional.of(menuEntity));
        when(menuItemRepo.findByMenuIdOrderBySortOrderAsc(menuId))
                .thenReturn(List.of(categoryLinkedItem(menuId, categoryId, menuEntity)));
        when(categoryRepo.findById(categoryId.toString()))
                .thenReturn(Optional.of(category(categoryId.toString(), "mu-bao-hiem", null)));

        PublicMenuResponse response = service.getPublicMenuByLocation("primary", "en");

        assertThat(response.items().get(0).url()).isEqualTo("/danh-muc-san-pham/mu-bao-hiem");
    }

    @Test
    void getPublicMenuByLocation_categoryDeleted_fallsBackToStoredUrl() {
        UUID menuId = UUID.randomUUID();
        UUID categoryId = UUID.randomUUID();
        MenuEntity menuEntity = menu(menuId, "primary");
        when(menuRepo.findByLocation("primary")).thenReturn(Optional.of(menuEntity));
        when(menuItemRepo.findByMenuIdOrderBySortOrderAsc(menuId))
                .thenReturn(List.of(categoryLinkedItem(menuId, categoryId, menuEntity)));
        when(categoryRepo.findById(categoryId.toString())).thenReturn(Optional.empty());

        PublicMenuResponse response = service.getPublicMenuByLocation("primary", "en");

        assertThat(response.items().get(0).url()).isEqualTo("/danh-muc-san-pham/mu-bao-hiem");
    }
}
