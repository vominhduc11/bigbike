package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.admin.dto.ArticleTranslationRequest;
import com.bigbike.bigbike_backend.api.admin.dto.UpsertArticleRequest;
import com.bigbike.bigbike_backend.domain.catalog.DescriptionBlock;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.persistence.entity.content.ArticleEntity;
import com.bigbike.bigbike_backend.persistence.repository.content.ArticleJpaRepository;
import com.bigbike.bigbike_backend.repository.content.JpaContentReadRepository;
import com.bigbike.bigbike_backend.service.catalog.DescriptionBlockRenderer;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

class ArticleBodyNoopSaveTest {

    @Test
    @SuppressWarnings("unchecked")
    void unchangedBlocksAndEnglishBodyKeepOriginalHtmlBytes() {
        ObjectProvider<ArticleJpaRepository> articles = mock(ObjectProvider.class);
        ObjectProvider<JpaContentReadRepository> reads = mock(ObjectProvider.class);
        var service = new AdminContentMutationService(articles, null, reads, null, null, null,
                new DescriptionBlockRenderer(), null, null, null, null, null, null, null, null);

        String originalVi = "<p style=\"text-align: center;\">Giữ nguyên&nbsp;chữ</p>";
        String originalEn = "<p style=\"font-style: italic;\">Keep&nbsp;spacing</p>";
        var entity = new ArticleEntity();
        entity.setBody(originalVi);
        entity.setBodyEn(originalEn);
        entity.setPublishStatus(PublishStatus.DRAFT);
        entity.setBodyBlocks(List.of(DescriptionBlock.ParagraphBlock.builder()
                .type("paragraph").html(originalVi).build()));

        var request = new UpsertArticleRequest();
        request.setBodyBlocks(List.of(DescriptionBlock.ParagraphBlock.builder()
                .type("paragraph").html(originalVi).build()));
        var translations = new ArticleTranslationRequest();
        var en = new ArticleTranslationRequest.ArticleContentRequest();
        en.setBody(originalEn);
        translations.setEn(en);
        request.setTranslations(translations);

        ReflectionTestUtils.invokeMethod(service, "applyArticlePatch", entity, request, null, false);

        assertThat(entity.getBody()).isEqualTo(originalVi);
        assertThat(entity.getBodyEn()).isEqualTo(originalEn);
    }
}
