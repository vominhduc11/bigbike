package com.bigbike.bigbike_backend.service.home;

import com.bigbike.bigbike_backend.api.admin.dto.home.AdminSaveHighlightsRequest;
import com.bigbike.bigbike_backend.api.public_.dto.HomeHighlightItemDto;
import com.bigbike.bigbike_backend.persistence.entity.home.HomeHighlightEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.home.HomeHighlightJpaRepository;
import java.time.Instant;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
public class HomeHighlightsService {

    private final HomeHighlightJpaRepository highlightRepo;
    private final ProductJpaRepository productRepo;

    @Transactional(readOnly = true)
    public List<HomeHighlightItemDto> listHighlights() {
        return highlightRepo.findAllWithProductAndCategoryOrderBySlot()
                .stream()
                .map(HomeHighlightItemDto::from)
                .toList();
    }

    @Transactional
    public List<HomeHighlightItemDto> saveHighlights(AdminSaveHighlightsRequest body) {
        for (var input : body.slots()) {
            if (!productRepo.existsById(input.productId())) {
                throw new ResponseStatusException(
                        HttpStatus.UNPROCESSABLE_ENTITY,
                        "Product not found: " + input.productId());
            }
        }

        highlightRepo.deleteAllInBatch();

        var entities = body.slots().stream()
                .map(input -> {
                    var entity = new HomeHighlightEntity();
                    entity.setSlot(input.slot().shortValue());
                    entity.setProduct(productRepo.getReferenceById(input.productId()));
                    entity.setUpdatedAt(Instant.now());
                    return entity;
                })
                .toList();

        highlightRepo.saveAllAndFlush(entities);
        return listHighlights();
    }
}
