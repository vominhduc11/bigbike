package com.bigbike.bigbike_backend.service.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.bigbike.bigbike_backend.api.admin.dto.settings.BatchUpdateSettingsRequest.BatchSettingUpdate;
import com.bigbike.bigbike_backend.api.admin.dto.settings.UpdateSiteSettingRequest;
import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.service.admin.settings.SettingDefinition;
import com.bigbike.bigbike_backend.service.admin.settings.SettingValueType;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class AdminSettingsServiceTest {
    private SettingsTestFixture fixture;
    private final UUID adminId = UUID.randomUUID();

    @BeforeEach
    void setUp() { fixture = new SettingsTestFixture(); }

    @Test
    void invalidSecondImageIdentifiesIndexAndKeepsTheWholeBatchUnchanged() {
        var title = fixture.setting("hero_products_title", "Original", null);
        var image = fixture.setting("hero_products_image_url", "/media/original.png", null);
        var error = assertThrows(ValidationException.class, () -> fixture.service.batchUpdateSettings(List.of(
                new BatchSettingUpdate(title.getSettingKey(), "New title", null),
                new BatchSettingUpdate(image.getSettingKey(), "https://example.com/banner.png", null)), adminId, true));
        assertThat(error.details().get(0).field()).isEqualTo("updates[1].value");
        assertThat(title.getSettingValue()).isEqualTo("Original");
        assertThat(image.getSettingValue()).isEqualTo("/media/original.png");
        assertNoWrites();
    }

    @Test
    void requiredEnglishErrorCarriesItsOwnBatchIndex() {
        var title = fixture.setting("hero_news_title", "Original", null);
        fixture.setting("site_name", "BigBike", "BigBike");
        var error = assertThrows(ValidationException.class, () -> fixture.service.batchUpdateSettings(List.of(
                new BatchSettingUpdate(title.getSettingKey(), "News", null),
                new BatchSettingUpdate("site_name", "BigBike", "")), adminId, true));
        assertThat(error.details().get(0).field()).isEqualTo("updates[1].valueEn");
        assertThat(error.details().get(0).code()).isEqualTo("REQUIRED");
        assertThat(title.getSettingValue()).isEqualTo("Original");
        assertNoWrites();
    }

    @Test
    void readOnlyErrorIdentifiesTheKeyWithoutMutatingEarlierItems() {
        fixture.setting("hero_news_title", "Original", null);
        fixture.setting("read_only_fixture", "Original", null);
        when(fixture.registry.find("read_only_fixture")).thenReturn(Optional.of(
                SettingDefinition.builder("read_only_fixture", "test", SettingValueType.STRING).readOnly().build()));
        var error = assertThrows(ValidationException.class, () -> fixture.service.batchUpdateSettings(List.of(
                new BatchSettingUpdate("hero_news_title", "News", null),
                new BatchSettingUpdate("read_only_fixture", "Changed", null)), adminId, true));
        assertThat(error.details().get(0).field()).isEqualTo("updates[1].key");
        assertNoWrites();
    }

    @Test
    void successfulEnglishOnlyUpdatePreservesVietnameseAndExistingLegacyImages() {
        var title = fixture.setting("hero_news_title", "Tin tức", "Old English");
        var legacy = fixture.setting("hero_default_bg_url", "https://bigbike.vn/wp-content/themes/bigbike/images/page-title-bg.png", null);
        var result = fixture.service.batchUpdateSettings(List.of(new BatchSettingUpdate("hero_news_title", null, "News")), adminId, true);
        assertThat(title.getSettingValue()).isEqualTo("Tin tức");
        assertThat(title.getSettingValueEn()).isEqualTo("News");
        assertThat(legacy.getSettingValue()).contains("/wp-content/themes/");
        assertThat(result).hasSize(1);
        verify(fixture.repository).save(title);
        verify(fixture.revalidation).revalidate("settings");
        verify(fixture.media).placeSetting("hero_news_title");
    }

    @Test
    void singleUpdateKeepsTheUnprefixedErrorField() {
        fixture.setting("hero_news_image_url", "", null);
        var request = new UpdateSiteSettingRequest("https://example.com/banner.png", null, null, null, null);
        var error = assertThrows(ValidationException.class, () -> fixture.service.updateSetting("hero_news_image_url", adminId, true, request));
        assertThat(error.details().get(0).field()).isEqualTo("value");
        assertNoWrites();
    }

    private void assertNoWrites() {
        verify(fixture.repository, never()).save(any());
        verifyNoInteractions(fixture.audit, fixture.auditFactory, fixture.media, fixture.revalidation);
    }
}
