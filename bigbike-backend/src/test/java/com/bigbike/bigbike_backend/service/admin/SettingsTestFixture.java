package com.bigbike.bigbike_backend.service.admin;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.when;

import com.bigbike.bigbike_backend.config.MediaUrlProperties;
import com.bigbike.bigbike_backend.persistence.entity.settings.SiteSettingEntity;
import com.bigbike.bigbike_backend.persistence.repository.settings.SiteSettingJpaRepository;
import com.bigbike.bigbike_backend.service.admin.settings.SettingDefinitionRegistry;
import com.bigbike.bigbike_backend.service.admin.settings.SettingValueValidator;
import com.bigbike.bigbike_backend.service.admin.support.AuditLogFactory;
import com.bigbike.bigbike_backend.service.audit.AuditLogWriter;
import com.bigbike.bigbike_backend.service.common.PaginationService;
import com.bigbike.bigbike_backend.service.security.SafeMediaAssetUrlPolicy;
import com.bigbike.bigbike_backend.service.security.YouTubeChannelUrlPolicy;
import com.bigbike.bigbike_backend.service.web.WebRevalidationService;
import java.util.Optional;
import java.util.UUID;
import tools.jackson.databind.ObjectMapper;

/** Pure in-memory tests: no database, migration, container, or shop mutation. */
public class SettingsTestFixture {
    public final SiteSettingJpaRepository repository = mock(SiteSettingJpaRepository.class);
    public final AuditLogWriter audit = mock(AuditLogWriter.class);
    public final AuditLogFactory auditFactory = mock(AuditLogFactory.class);
    public final WebRevalidationService revalidation = mock(WebRevalidationService.class);
    public final MediaAutoFolderService media = mock(MediaAutoFolderService.class);
    public final SettingDefinitionRegistry registry = spy(new SettingDefinitionRegistry());
    public final AdminSettingsService service = new AdminSettingsService(
            repository, audit, auditFactory, mock(PaginationService.class), revalidation, registry,
            new SettingValueValidator(new SafeMediaAssetUrlPolicy(new MediaUrlProperties(), "https://bigbike.vn"),
                    new YouTubeChannelUrlPolicy(), new ObjectMapper()), new ObjectMapper(), media);

    public SiteSettingEntity setting(String key, String value, String valueEn) {
        var entity = new SiteSettingEntity();
        entity.setId(UUID.randomUUID());
        entity.setSettingKey(key);
        entity.setSettingValue(value);
        entity.setSettingValueEn(valueEn);
        entity.setSettingGroup("public_hero");
        when(repository.findBySettingKey(key)).thenReturn(Optional.of(entity));
        return entity;
    }
}
