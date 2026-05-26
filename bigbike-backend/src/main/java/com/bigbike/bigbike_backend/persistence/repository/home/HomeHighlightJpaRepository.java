package com.bigbike.bigbike_backend.persistence.repository.home;

import com.bigbike.bigbike_backend.persistence.entity.home.HomeHighlightEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface HomeHighlightJpaRepository extends JpaRepository<HomeHighlightEntity, Short> {

    @Query("SELECT h FROM HomeHighlightEntity h JOIN FETCH h.product p JOIN FETCH p.category c ORDER BY h.slot")
    List<HomeHighlightEntity> findAllWithProductAndCategoryOrderBySlot();
}
