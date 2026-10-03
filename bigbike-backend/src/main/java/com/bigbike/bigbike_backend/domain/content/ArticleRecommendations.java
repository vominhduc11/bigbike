package com.bigbike.bigbike_backend.domain.content;

import java.util.List;

public record ArticleRecommendations(List<Article> featured, List<Article> related) {
}
