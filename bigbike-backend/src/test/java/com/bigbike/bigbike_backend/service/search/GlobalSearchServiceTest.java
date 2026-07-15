package com.bigbike.bigbike_backend.service.search;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.bigbike.bigbike_backend.repository.catalog.CatalogReadRepository;
import com.bigbike.bigbike_backend.repository.content.ContentReadRepository;
import java.util.List;
import org.junit.jupiter.api.Test;

class GlobalSearchServiceTest {

    @Test
    void search_passesEnglishLocaleToProductAndArticleRepositories() {
        CatalogReadRepository catalogRepository = mock(CatalogReadRepository.class);
        ContentReadRepository contentRepository = mock(ContentReadRepository.class);
        GlobalSearchService service = new GlobalSearchService(catalogRepository, contentRepository);

        when(catalogRepository.searchPublishedProducts(List.of("helmet"), "en", 6)).thenReturn(List.of());
        when(contentRepository.searchPublishedArticles(List.of("helmet"), "en", 6)).thenReturn(List.of());

        service.search("helmet", null, 6, "en");

        verify(catalogRepository).searchPublishedProducts(List.of("helmet"), "en", 6);
        verify(contentRepository).searchPublishedArticles(List.of("helmet"), "en", 6);
    }
}
