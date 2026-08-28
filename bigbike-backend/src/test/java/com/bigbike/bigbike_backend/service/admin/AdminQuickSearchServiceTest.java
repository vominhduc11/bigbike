package com.bigbike.bigbike_backend.service.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.bigbike.bigbike_backend.api.admin.dto.quicksearch.AdminQuickSearchGroup;
import com.bigbike.bigbike_backend.api.admin.dto.quicksearch.AdminQuickSearchItem;
import com.bigbike.bigbike_backend.api.admin.dto.quicksearch.AdminQuickSearchResponse;
import com.bigbike.bigbike_backend.domain.auth.AdminUserProfile;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class AdminQuickSearchServiceTest {

    @Test
    void reportsOnlyPermittedGroupsAndKeepsSuccessfulGroupWhenAnotherFails() {
        AdminQuickSearchReader reader = mock(AdminQuickSearchReader.class);
        when(reader.searchOrders("nguyen")).thenReturn(
                AdminQuickSearchGroup.ready(1, List.of(AdminQuickSearchItem.order(
                        UUID.randomUUID().toString(), "BB-1", "PROCESSING", "Nguyễn Văn A", null,
                        null, null, null, "VND", "customerName"))));
        when(reader.searchProducts("nguyen"))
                .thenThrow(new IllegalStateException("database unavailable"));
        AdminQuickSearchService service = new AdminQuickSearchService(reader);

        AdminQuickSearchResponse response = service.search(
                "  nguyen  ", profile("orders.read", "products.read"));

        assertThat(response.groups()).containsOnlyKeys("orders", "products");
        assertThat(response.groups().get("orders").state().name()).isEqualTo("READY");
        assertThat(response.groups().get("products").state().name()).isEqualTo("ERROR");
        assertThat(response.groups().get("products").errorCode()).isEqualTo("SEARCH_GROUP_UNAVAILABLE");
        verify(reader).searchOrders("nguyen");
        verify(reader).searchProducts("nguyen");
        verify(reader, never()).searchCustomers("nguyen");
        verify(reader, never()).searchCategories("nguyen");
        verify(reader, never()).searchBrands("nguyen");
        verify(reader, never()).searchArticles("nguyen");
        verify(reader, never()).searchAdminUsers("nguyen");
        verifyNoMoreInteractions(reader);
    }

    @Test
    void rejectsBlankOrOverlongQueryBeforeReadingAnyGroup() {
        AdminQuickSearchReader reader = mock(AdminQuickSearchReader.class);
        AdminQuickSearchService service = new AdminQuickSearchService(reader);

        assertThatThrownBy(() -> service.search("   ", profile("orders.read")))
                .isInstanceOf(com.bigbike.bigbike_backend.api.error.ValidationException.class);
        assertThatThrownBy(() -> service.search("a".repeat(101), profile("orders.read")))
                .isInstanceOf(com.bigbike.bigbike_backend.api.error.ValidationException.class);
        verifyNoInteractions(reader);
    }

    private static AdminUserProfile profile(String... permissions) {
        return new AdminUserProfile(
                "admin-1", "Admin", "admin@example.test", List.of("ADMIN"),
                List.of(permissions), "ACTIVE", null, null);
    }

}
