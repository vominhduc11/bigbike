package com.bigbike.bigbike_backend.repository.content;

import com.bigbike.bigbike_backend.domain.content.Article;
import com.bigbike.bigbike_backend.domain.content.Page;
import java.util.List;
import java.util.Optional;

public interface ContentReadRepository {

    List<Article> findAllArticles();

    Optional<Article> findArticleBySlug(String slug);

    Optional<Page> findPageBySlug(String slug);
}

