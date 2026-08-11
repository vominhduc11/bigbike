package com.bigbike.bigbike_backend.persistence.repository.catalog;

import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;

/** Keyset fragment for product exports; deliberately does not execute a count query. */
public interface ProductCsvExportRepository {

    List<ProductEntity> findForCsvAfterId(
            Specification<ProductEntity> specification,
            String afterId,
            Pageable pageable
    );
}
