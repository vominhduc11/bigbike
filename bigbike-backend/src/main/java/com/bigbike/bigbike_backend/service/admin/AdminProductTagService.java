package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.migration.wordpress.normalizer.ProductSlugGenerator;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductTagEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductTagJpaRepository;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Quản lý tag (thẻ) của sản phẩm cho admin. Tách thành sub-resource riêng
 * (GET/PUT /admin/products/{id}/tags) thay vì nhồi vào domain {@code Product}
 * vốn được dùng chung bởi storefront/POS/list — giữ blast radius nhỏ.
 *
 * ProductEntity là owning side của quan hệ product_tag_map nên chỉ cần sửa
 * {@code product.getTags()} rồi save là đồng bộ bảng nối.
 */
@Service
@RequiredArgsConstructor
public class AdminProductTagService {

    private final ProductJpaRepository productJpaRepository;
    private final ProductTagJpaRepository productTagJpaRepository;

    @Transactional(readOnly = true)
    public List<String> getProductTags(String productId) {
        ProductEntity product = productJpaRepository.findById(productId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy sản phẩm."));
        return product.getTags().stream()
                .map(ProductTagEntity::getName)
                .sorted(String.CASE_INSENSITIVE_ORDER)
                .toList();
    }

    /**
     * Đặt lại toàn bộ tag của sản phẩm theo danh sách tên gửi lên. Tag chưa tồn tại
     * (theo slug suy ra từ tên) sẽ được tạo mới; tag trùng slug được tái sử dụng.
     */
    @Transactional
    public List<String> setProductTags(String productId, List<String> tagNames) {
        ProductEntity product = productJpaRepository.findById(productId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy sản phẩm."));

        Set<ProductTagEntity> resolved = new LinkedHashSet<>();
        Set<String> seenSlugs = new HashSet<>();
        if (tagNames != null) {
            for (String raw : tagNames) {
                if (raw == null || raw.isBlank()) {
                    continue;
                }
                String name = raw.trim();
                String slug = ProductSlugGenerator.toSlug(name);
                if (slug.isBlank() || !seenSlugs.add(slug)) {
                    continue;
                }
                ProductTagEntity tag = productTagJpaRepository.findBySlug(slug)
                        .orElseGet(() -> {
                            ProductTagEntity created = new ProductTagEntity();
                            created.setId("ptag-" + UUID.randomUUID());
                            created.setSlug(slug);
                            created.setName(name);
                            return productTagJpaRepository.save(created);
                        });
                resolved.add(tag);
            }
        }

        product.getTags().clear();
        product.getTags().addAll(resolved);
        productJpaRepository.save(product);

        return resolved.stream()
                .map(ProductTagEntity::getName)
                .sorted(String.CASE_INSENSITIVE_ORDER)
                .toList();
    }
}
