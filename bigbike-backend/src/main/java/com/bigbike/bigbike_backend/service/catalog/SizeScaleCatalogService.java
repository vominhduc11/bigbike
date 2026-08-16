package com.bigbike.bigbike_backend.service.catalog;

import com.bigbike.bigbike_backend.domain.catalog.SizeScale;
import com.bigbike.bigbike_backend.domain.catalog.SizeScaleGroup;
import com.bigbike.bigbike_backend.domain.catalog.SizeScaleValue;
import com.bigbike.bigbike_backend.persistence.entity.catalog.SizeScaleEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.SizeScaleGroupEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.SizeScaleValueEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.SizeScaleJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.SizeScaleValueJpaRepository;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class SizeScaleCatalogService {

    private final SizeScaleJpaRepository scaleRepository;
    private final SizeScaleValueJpaRepository valueRepository;

    @Transactional(readOnly = true)
    public SizeScaleCatalog activeCatalog() {
        return new SizeScaleCatalog(scaleRepository.findAllActiveWithGroup().stream()
                .map(scale -> toDomain(scale, valueRepository.findByScale_IdAndActiveTrueOrderBySortOrderAsc(scale.getId())))
                .toList());
    }

    @Transactional(readOnly = true)
    public List<SizeScale> listAll() {
        return scaleRepository.findAllWithGroup().stream()
                .map(scale -> toDomain(scale, valueRepository.findByScale_IdOrderBySortOrderAsc(scale.getId())))
                .toList();
    }

    @Transactional(readOnly = true)
    public SizeScaleCatalog allCatalog() {
        return new SizeScaleCatalog(listAll());
    }

    public static SizeScale toDomain(SizeScaleEntity entity, List<SizeScaleValueEntity> values) {
        SizeScaleGroupEntity group = entity.getGroup();
        SizeScaleGroup groupDomain = new SizeScaleGroup(
                group.getGroupKey(), group.getLabel(), group.getLabelEn(), group.getSortOrder(), group.isActive());
        List<SizeScaleValue> valueDomains = values.stream()
                .map(value -> new SizeScaleValue(
                        value.getValueKey(), value.getLabel(), value.getLabelEn(),
                        value.getSubgroupKey(), value.getSubgroupLabel(), value.getSubgroupLabelEn(),
                        value.getSortOrder(), value.isActive()))
                .toList();
        return new SizeScale(
                entity.getId(), entity.getCode(), entity.getName(), entity.getNameEn(), groupDomain,
                entity.getFilterNamespace(), entity.getSortOrder(), entity.isActive(), valueDomains);
    }
}
