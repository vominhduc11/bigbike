package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.admin.dto.MissingRequiredEnglishResponse;
import com.bigbike.bigbike_backend.api.admin.dto.MissingRequiredEnglishResponse.Item;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.persistence.entity.catalog.BrandEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.CategoryEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import com.bigbike.bigbike_backend.persistence.entity.content.ArticleEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.BrandJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.CategoryJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.content.ArticleJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.settings.SiteSettingJpaRepository;
import com.bigbike.bigbike_backend.service.admin.settings.SettingDefinition;
import com.bigbike.bigbike_backend.service.admin.settings.SettingDefinitionRegistry;
import com.bigbike.bigbike_backend.service.admin.settings.SettingValueType;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * Reports records still missing English content in a field that became required
 * (TRANSLATION_RULE_002) when Gemini auto-translation was removed (V312) — helps admin find
 * and fix old records proactively instead of discovering the block one save at a time.
 * Dataset is small (a few hundred rows per entity), so in-memory filtering is fine.
 */
@Service
@RequiredArgsConstructor
public class TranslationCompletenessService {

    private final ProductJpaRepository productJpaRepository;
    private final CategoryJpaRepository categoryJpaRepository;
    private final BrandJpaRepository brandJpaRepository;
    private final ArticleJpaRepository articleJpaRepository;
    private final SiteSettingJpaRepository settingJpaRepository;
    private final SettingDefinitionRegistry settingDefinitionRegistry;

    public MissingRequiredEnglishResponse findMissing() {
        List<Item> products = productJpaRepository.findAll().stream()
                .filter(p -> p.getPublishStatus() != PublishStatus.TRASH)
                .filter(p -> isBlank(p.getNameEn()))
                .map(p -> new Item(p.getId(), p.getSlug(), p.getName()))
                .toList();

        List<Item> categories = categoryJpaRepository.findAll().stream()
                .filter(c -> !c.isDeleted())
                .filter(c -> isBlank(c.getNameEn()))
                .map(c -> new Item(c.getId(), c.getSlug(), c.getName()))
                .toList();

        List<Item> brands = brandJpaRepository.findAll().stream()
                .filter(BrandEntity::isVisible)
                .filter(b -> isBlank(b.getNameEn()))
                .map(b -> new Item(b.getId(), b.getSlug(), b.getName()))
                .toList();

        List<Item> articles = articleJpaRepository.findAll().stream()
                .filter(a -> a.getPublishStatus() != PublishStatus.TRASH)
                .filter(a -> isBlank(a.getTitleEn()))
                .map(a -> new Item(a.getId(), a.getSlug(), a.getTitle()))
                .toList();

        List<String> settingKeys = settingDefinitionRegistry.all().values().stream()
                .filter(SettingDefinition::required)
                .filter(this::isFreeTextType)
                .map(SettingDefinition::key)
                .filter(key -> settingJpaRepository.findBySettingKey(key)
                        .map(s -> isBlank(s.getSettingValueEn()))
                        .orElse(true))
                .toList();

        return new MissingRequiredEnglishResponse(products, categories, brands, articles, settingKeys);
    }

    private boolean isFreeTextType(SettingDefinition def) {
        return def.type() == SettingValueType.STRING
                || def.type() == SettingValueType.HTML
                || def.type() == SettingValueType.LONG_TEXT;
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
