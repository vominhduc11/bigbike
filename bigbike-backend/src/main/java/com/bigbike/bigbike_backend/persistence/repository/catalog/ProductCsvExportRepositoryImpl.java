package com.bigbike.bigbike_backend.persistence.repository.catalog;

import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.TypedQuery;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.CriteriaQuery;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import java.util.ArrayList;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;

/** Criteria-backed keyset query used by the uncapped CSV stream. */
public class ProductCsvExportRepositoryImpl implements ProductCsvExportRepository {

    @PersistenceContext
    private EntityManager entityManager;

    @Override
    public List<ProductEntity> findForCsvAfterId(
            Specification<ProductEntity> specification,
            String afterId,
            Pageable pageable
    ) {
        CriteriaBuilder criteriaBuilder = entityManager.getCriteriaBuilder();
        CriteriaQuery<ProductEntity> criteriaQuery = criteriaBuilder.createQuery(ProductEntity.class);
        Root<ProductEntity> root = criteriaQuery.from(ProductEntity.class);
        List<Predicate> predicates = new ArrayList<>();

        if (specification != null) {
            Predicate filter = specification.toPredicate(root, criteriaQuery, criteriaBuilder);
            if (filter != null) {
                predicates.add(filter);
            }
        }
        if (afterId != null && !afterId.isBlank()) {
            predicates.add(criteriaBuilder.greaterThan(root.get("id"), afterId));
        }

        criteriaQuery.select(root)
                .where(predicates.toArray(new Predicate[0]))
                .orderBy(criteriaBuilder.asc(root.get("id")));

        TypedQuery<ProductEntity> query = entityManager.createQuery(criteriaQuery);
        query.setMaxResults(Math.max(1, pageable.getPageSize()));
        return query.getResultList();
    }
}
