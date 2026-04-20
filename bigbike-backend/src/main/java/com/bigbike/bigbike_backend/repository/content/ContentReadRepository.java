package com.bigbike.bigbike_backend.repository.content;

import com.bigbike.bigbike_backend.domain.content.Article;
import com.bigbike.bigbike_backend.domain.content.Page;
import java.util.List;
import java.util.Optional;

public interface ContentReadRepository {

    List<Article> findAllArticles();

    List<Page> findAllPages();

    Optional<Article> findArticleBySlug(String slug);

    Optional<Article> findArticleById(String id);

    Optional<Page> findPageBySlug(String slug);

    Optional<Page> findPageById(String id);
}
