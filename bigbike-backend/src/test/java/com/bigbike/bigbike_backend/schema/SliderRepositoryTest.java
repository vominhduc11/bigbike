package com.bigbike.bigbike_backend.schema;

import static org.assertj.core.api.Assertions.assertThat;

import com.bigbike.bigbike_backend.domain.catalog.ImageAsset;
import com.bigbike.bigbike_backend.persistence.entity.slider.SliderEntity;
import com.bigbike.bigbike_backend.persistence.repository.slider.SliderJpaRepository;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest
class SliderRepositoryTest {

    @Autowired
    private SliderJpaRepository sliderJpaRepository;

    @Test
    void findByLocationOrderBySortOrderAsc_returnsSeededHomeSlidersInOrder() {
        List<SliderEntity> sliders = sliderJpaRepository.findByLocationOrderBySortOrderAsc("home");

        assertThat(sliders).hasSize(8);
        assertThat(sliders).extracting(SliderEntity::getSortOrder)
                .containsExactly(0, 1, 2, 3, 4, 5, 6, 7);
        assertThat(sliders.get(0).getDesktopImage().url()).isNotBlank();
        assertThat(sliders.get(7).getProduct()).isNull();
        assertThat(sliders.get(7).getExternalLink()).isNotBlank();
    }

    @Test
    void saveAndFindByLocationAndSortOrder_persistsJsonImages() {
        String location = "test-" + UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        SliderEntity slider = new SliderEntity();
        slider.setId("slider_" + location + "_0");
        slider.setLocation(location);
        slider.setSortOrder(0);
        slider.setDesktopImage(new ImageAsset(null, "https://cdn.bigbike.local/sliders/test.jpg", "Test slide", 1200, 600, "image/jpeg"));
        slider.setMobileImage(new ImageAsset(null, "https://cdn.bigbike.local/sliders/test-mobile.jpg", "Test slide mobile", 768, 960, "image/jpeg"));
        slider.setExternalLink("https://bigbike.vn/test.html");
        slider.setCreatedAt(Instant.now());
        slider.setUpdatedAt(Instant.now());

        sliderJpaRepository.save(slider);

        SliderEntity found = sliderJpaRepository.findByLocationAndSortOrder(location, 0).orElseThrow();
        assertThat(found.getDesktopImage().url()).isEqualTo("https://cdn.bigbike.local/sliders/test.jpg");
        assertThat(found.getMobileImage().url()).isEqualTo("https://cdn.bigbike.local/sliders/test-mobile.jpg");
        assertThat(found.getExternalLink()).isEqualTo("https://bigbike.vn/test.html");
    }
}
