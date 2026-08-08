package com.bigbike.bigbike_backend.persistence.repository.redirect;

import com.bigbike.bigbike_backend.persistence.entity.redirect.RedirectEntity;
import jakarta.persistence.criteria.Predicate;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import org.springframework.data.jpa.domain.Specification;

public final class RedirectSpecification {

    private RedirectSpecification() {}

    public static Specification<RedirectEntity> withFilters(String q, Boolean enabled) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            if (q != null && !q.isBlank()) {
                String pattern = "%" + escapeLikePattern(q.trim().toLowerCase(Locale.ROOT)) + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("sourcePattern")), pattern, '!'),
                        cb.like(cb.lower(root.get("targetUrl")), pattern, '!')
                ));
            }

            if (enabled != null) {
                predicates.add(cb.equal(root.get("enabled"), enabled));
            }

            return predicates.isEmpty() ? cb.conjunction() : cb.and(predicates.toArray(new Predicate[0]));
        };
    }

    private static String escapeLikePattern(String value) {
        return value
                .replace("!", "!!")
                .replace("%", "!%")
                .replace("_", "!_");
    }
}
