package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.admin.dto.CreateSizeScaleGroupRequest;
import com.bigbike.bigbike_backend.api.admin.dto.SizeScaleGroupResponse;
import com.bigbike.bigbike_backend.api.admin.dto.SizeScaleResponse;
import com.bigbike.bigbike_backend.api.admin.dto.SizeScaleValueResponse;
import com.bigbike.bigbike_backend.api.admin.dto.UpdateSizeScaleGroupRequest;
import com.bigbike.bigbike_backend.api.admin.dto.UpsertSizeScaleRequest;
import com.bigbike.bigbike_backend.api.admin.dto.UpsertSizeScaleValueRequest;
import com.bigbike.bigbike_backend.api.error.ConflictException;
import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.persistence.entity.catalog.SizeScaleEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.SizeScaleGroupEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.SizeScaleValueEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.SizeScaleGroupJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.SizeScaleJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.SizeScaleValueJpaRepository;
import com.bigbike.bigbike_backend.service.admin.support.AuditLogFactory;
import com.bigbike.bigbike_backend.service.audit.AuditLogWriter;
import com.bigbike.bigbike_backend.service.catalog.SizeScaleCatalog;
import com.bigbike.bigbike_backend.service.web.WebRevalidationService;
import com.bigbike.bigbike_backend.util.ProductSlugGenerator;
import java.text.Normalizer;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AdminSizeScaleService {

    private final SizeScaleGroupJpaRepository groupRepository;
    private final SizeScaleJpaRepository scaleRepository;
    private final SizeScaleValueJpaRepository valueRepository;
    private final ProductJpaRepository productRepository;
    private final AuditLogWriter auditLogWriter;
    private final AuditLogFactory auditLogFactory;
    private final WebRevalidationService webRevalidationService;

    @Transactional(readOnly = true)
    public List<SizeScaleGroupResponse> listGroups() {
        return listGroups(false);
    }

    /**
     * @param includeInactive the scale form must only offer live groups, but the group manager
     *     needs the switched-off ones too — otherwise a deactivated group is unreachable and can
     *     never be turned back on.
     */
    @Transactional(readOnly = true)
    public List<SizeScaleGroupResponse> listGroups(boolean includeInactive) {
        List<SizeScaleGroupEntity> groups = includeInactive
                ? groupRepository.findAllByOrderBySortOrderAscGroupKeyAsc()
                : groupRepository.findAllByActiveTrueOrderBySortOrderAscGroupKeyAsc();
        return groups.stream().map(AdminSizeScaleService::toGroupResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<SizeScaleResponse> listScales() {
        return scaleRepository.findAllWithGroup().stream().map(this::toResponse).toList();
    }

    /**
     * Create a public size filter group.
     *
     * <p>The key is derived once from the Vietnamese label and then frozen — it is copied into
     * every scale's {@code filterNamespace}, so a moving key would silently invalidate public
     * filter links customers may have saved ({@code CATALOG_RULE_012}).
     */
    @Transactional
    public SizeScaleGroupResponse createGroup(CreateSizeScaleGroupRequest request, UUID adminId) {
        String label = request.getLabel().trim();
        String labelEn = request.getLabelEn().trim();
        String key = buildGroupKey(label);

        groupRepository.findByGroupKey(key).ifPresent(existing -> {
            throw new ConflictException(existing.isActive()
                    ? "Nhóm lọc cỡ này đã tồn tại."
                    : "Nhóm lọc cỡ này đã tồn tại nhưng đang tắt, hãy bật lại thay vì tạo mới.");
        });

        SizeScaleGroupEntity entity = new SizeScaleGroupEntity();
        entity.setId("size-group-" + UUID.randomUUID());
        entity.setGroupKey(key);
        entity.setLabel(label);
        entity.setLabelEn(labelEn);
        entity.setSortOrder(nextGroupSortOrder());
        entity.setActive(true);

        SizeScaleGroupEntity saved;
        try {
            saved = groupRepository.saveAndFlush(entity);
        } catch (DataIntegrityViolationException e) {
            // Two concurrent creates deriving the same key: report it like the checked collision.
            throw new ConflictException("Nhóm lọc cỡ này đã tồn tại.");
        }

        auditLogWriter.save(auditLogFactory.build(
                "ADMIN", adminId, "SIZE_SCALE_GROUP_CREATED", "SIZE_SCALE_GROUP",
                null, null, groupSnapshot(saved)));
        webRevalidationService.revalidate("products");
        return toGroupResponse(saved);
    }

    /**
     * Update a group's display labels and on/off state. Every field is optional: omitted stays
     * unchanged. Switching a group off keeps all of its scales and values — it only removes the
     * group from the public size facet, and product saves keep working because the save-time
     * guard reads the unfiltered catalog.
     */
    @Transactional
    public SizeScaleGroupResponse updateGroup(String id, UpdateSizeScaleGroupRequest request, UUID adminId) {
        SizeScaleGroupEntity entity = requireGroup(id);
        String before = groupSnapshot(entity);

        if (request.getLabel() != null) {
            String label = request.getLabel().trim();
            if (label.isBlank()) {
                throw ValidationException.fromField(
                        "label", "REQUIRED", "Tên nhóm lọc cỡ không được để trống.");
            }
            entity.setLabel(label);
        }
        if (request.getLabelEn() != null) {
            String labelEn = request.getLabelEn().trim();
            if (labelEn.isBlank()) {
                throw ValidationException.fromField(
                        "labelEn", "REQUIRED", "Tên tiếng Anh của nhóm lọc cỡ không được để trống.");
            }
            entity.setLabelEn(labelEn);
        }
        if (request.getActive() != null) {
            entity.setActive(request.getActive());
        }
        // groupKey is deliberately never touched here.

        SizeScaleGroupEntity saved = groupRepository.save(entity);
        auditLogWriter.save(auditLogFactory.build(
                "ADMIN", adminId, "SIZE_SCALE_GROUP_UPDATED", "SIZE_SCALE_GROUP",
                null, before, groupSnapshot(saved)));
        webRevalidationService.revalidate("products");
        return toGroupResponse(saved);
    }

    /** Delete a group. Refused while any scale still points at it. */
    @Transactional
    public void deleteGroup(String id, UUID adminId) {
        SizeScaleGroupEntity entity = requireGroup(id);
        long usedScaleCount = scaleRepository.countByGroup_Id(entity.getId());
        if (usedScaleCount > 0) {
            throw new ConflictException("Nhóm lọc cỡ này đang được " + usedScaleCount
                    + " bảng cỡ sử dụng, không xóa được.");
        }
        String before = groupSnapshot(entity);
        groupRepository.delete(entity);
        groupRepository.flush();
        auditLogWriter.save(auditLogFactory.build(
                "ADMIN", adminId, "SIZE_SCALE_GROUP_DELETED", "SIZE_SCALE_GROUP",
                null, before, null));
        webRevalidationService.revalidate("products");
    }

    @Transactional
    public SizeScaleResponse createScale(UpsertSizeScaleRequest request) {
        SizeScaleGroupEntity group = requireAssignableGroup(request.getGroupId(), null);
        List<ParsedValue> values = parseValues(request.getValues());
        String code = buildScaleCode(request.getName());
        if (scaleRepository.findByCode(code).isPresent()) {
            throw new ConflictException("Bảng cỡ này đã tồn tại.");
        }

        SizeScaleEntity entity = new SizeScaleEntity();
        entity.setId("size-scale-" + UUID.randomUUID());
        applyScale(entity, request.getName(), group, code, nextSortOrder());
        scaleRepository.save(entity);
        replaceValues(entity, values);
        return toResponse(entity);
    }

    @Transactional
    public SizeScaleResponse updateScale(String id, UpsertSizeScaleRequest request) {
        SizeScaleEntity entity = requireScale(id);
        SizeScaleGroupEntity group =
                requireAssignableGroup(request.getGroupId(), entity.getGroup().getId());
        List<ParsedValue> values = parseValues(request.getValues());
        long usedProductCount = productRepository.countBySizeScaleId(id);

        if (usedProductCount > 0 && !Objects.equals(entity.getGroup().getId(), group.getId())) {
            throw new ConflictException("Bảng cỡ này đang được " + usedProductCount
                    + " sản phẩm sử dụng, không thể đổi nhóm lọc.");
        }

        applyScale(entity, request.getName(), group, entity.getCode(), entity.getSortOrder());
        replaceValues(entity, values);
        return toResponse(scaleRepository.save(entity));
    }

    /**
     * Compatibility endpoint for older admin clients. The simplified manager
     * writes the complete ordered list through create/update scale instead.
     */
    @Transactional
    public SizeScaleValueResponse createValue(String scaleId, UpsertSizeScaleValueRequest request) {
        SizeScaleEntity scale = requireScale(scaleId);
        String key = normalizeValueKey(request.getValueKey());
        if (key.isBlank()) {
            throw ValidationException.fromField("valueKey", "REQUIRED", "Giá trị cỡ không được để trống.");
        }
        if (valueRepository.findByScale_IdAndValueKey(scaleId, key).isPresent()) {
            throw new ConflictException("Cỡ này đã có trong bảng cỡ.");
        }
        SizeScaleValueEntity entity = new SizeScaleValueEntity();
        entity.setId("size-value-" + UUID.randomUUID());
        entity.setScale(scale);
        applyValue(entity, request, key);
        return toValueResponse(valueRepository.save(entity));
    }

    /** Compatibility endpoint retained for existing integrations. */
    @Transactional
    public SizeScaleValueResponse updateValue(String id, UpsertSizeScaleValueRequest request) {
        SizeScaleValueEntity entity = valueRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy cỡ trong bảng cỡ."));
        String key = normalizeValueKey(request.getValueKey());
        if (productRepository.countBySizeScaleId(entity.getScale().getId()) > 0
                && !entity.getValueKey().equals(key)) {
            throw new ConflictException("Không thể đổi mã cỡ đang được sản phẩm sử dụng.");
        }
        valueRepository.findByScale_IdAndValueKey(entity.getScale().getId(), key)
                .filter(other -> !other.getId().equals(id)).ifPresent(other -> {
                    throw new ConflictException("Cỡ này đã có trong bảng cỡ.");
                });
        applyValue(entity, request, key);
        return toValueResponse(valueRepository.save(entity));
    }

    @Transactional
    public void deleteScale(String id) {
        SizeScaleEntity entity = requireScale(id);
        long usedProductCount = productRepository.countBySizeScaleId(id);
        if (usedProductCount > 0) {
            throw new ConflictException("Bảng cỡ này đang được " + usedProductCount
                    + " sản phẩm sử dụng, không xóa được.");
        }

        valueRepository.deleteAll(valueRepository.findByScale_IdOrderBySortOrderAsc(id));
        valueRepository.flush();
        scaleRepository.delete(entity);
        scaleRepository.flush();
    }

    /** Compatibility endpoint retained for existing integrations. */
    @Transactional
    public void deleteValue(String id) {
        SizeScaleValueEntity entity = valueRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy cỡ trong bảng cỡ."));
        if (productRepository.countBySizeScaleId(entity.getScale().getId()) > 0) {
            throw new ConflictException("Không thể xoá cỡ đang được sản phẩm sử dụng.");
        }
        valueRepository.delete(entity);
    }

    private void applyScale(
            SizeScaleEntity entity,
            String rawName,
            SizeScaleGroupEntity group,
            String code,
            int sortOrder) {
        String name = rawName.trim();
        entity.setCode(code);
        entity.setName(name);
        entity.setNameEn(name);
        entity.setGroup(group);
        entity.setFilterNamespace(group.getGroupKey());
        entity.setSortOrder(sortOrder);
        entity.setActive(true);
    }

    private void replaceValues(SizeScaleEntity scale, List<ParsedValue> parsedValues) {
        List<SizeScaleValueEntity> existingValues = valueRepository.findByScale_IdOrderBySortOrderAsc(scale.getId());
        Map<String, SizeScaleValueEntity> existingByKey = existingValues.stream()
                .collect(Collectors.toMap(SizeScaleValueEntity::getValueKey, value -> value, (left, right) -> left));
        Set<String> submittedKeys = parsedValues.stream().map(ParsedValue::key).collect(Collectors.toSet());

        Map<String, String> usedLabelsByKey = productRepository.findSizeOptionValuesBySizeScaleId(scale.getId()).stream()
                .filter(Objects::nonNull)
                .map(String::trim)
                .filter(value -> !value.isBlank())
                .collect(Collectors.toMap(
                        AdminSizeScaleService::normalizeValueKey,
                        value -> value,
                        (left, right) -> left,
                        HashMap::new));
        for (Map.Entry<String, String> used : usedLabelsByKey.entrySet()) {
            if (!submittedKeys.contains(used.getKey())) {
                throw new ConflictException("Không thể bỏ cỡ " + used.getValue()
                        + " vì đang được sản phẩm sử dụng.");
            }
        }

        List<SizeScaleValueEntity> removedValues = existingValues.stream()
                .filter(value -> !submittedKeys.contains(normalizeValueKey(value.getValueKey())))
                .toList();
        if (!removedValues.isEmpty()) {
            valueRepository.deleteAll(removedValues);
            valueRepository.flush();
        }

        for (int index = 0; index < parsedValues.size(); index++) {
            ParsedValue parsed = parsedValues.get(index);
            SizeScaleValueEntity value = existingByKey.get(parsed.key());
            if (value == null) {
                value = new SizeScaleValueEntity();
                value.setId("size-value-" + UUID.randomUUID());
                value.setScale(scale);
            }
            value.setValueKey(parsed.key());
            value.setLabel(parsed.label());
            value.setLabelEn(parsed.label());
            value.setSubgroupKey(null);
            value.setSubgroupLabel(null);
            value.setSubgroupLabelEn(null);
            value.setSortOrder((index + 1) * 10);
            value.setActive(true);
            valueRepository.save(value);
        }
    }

    private void applyValue(SizeScaleValueEntity entity, UpsertSizeScaleValueRequest request, String key) {
        String label = request.getLabel().trim();
        entity.setValueKey(key);
        entity.setLabel(label);
        entity.setLabelEn(label);
        entity.setSubgroupKey(null);
        entity.setSubgroupLabel(null);
        entity.setSubgroupLabelEn(null);
        entity.setSortOrder(request.getSortOrder() == null ? 100 : request.getSortOrder());
        entity.setActive(request.getActive() == null || request.getActive());
    }

    /**
     * Resolve the group a scale is being saved into.
     *
     * <p>Groups became switchable, so "active only" is no longer a safe filter: a scale whose own
     * group was switched off would resend that same group id on every save and get a 404, leaving
     * the scale permanently uneditable. The scale's current group is therefore always accepted;
     * only <em>moving into</em> a disabled group is refused, with a message that says why.
     *
     * @param currentGroupId the group the scale already belongs to, or {@code null} when creating
     */
    private SizeScaleGroupEntity requireAssignableGroup(String rawId, String currentGroupId) {
        String id = rawId == null ? "" : rawId.trim();
        SizeScaleGroupEntity group = groupRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy nhóm lọc cỡ."));
        if (!group.isActive() && !group.getId().equals(currentGroupId)) {
            throw new ConflictException("Không thể chuyển bảng cỡ vào nhóm lọc đang tắt.");
        }
        return group;
    }

    private SizeScaleGroupEntity requireGroup(String rawId) {
        String id = rawId == null ? "" : rawId.trim();
        return groupRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy nhóm lọc cỡ."));
    }

    private SizeScaleEntity requireScale(String id) {
        return scaleRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy bảng cỡ."));
    }

    private int nextGroupSortOrder() {
        // Includes switched-off groups so a new group never lands on top of a hidden one.
        return groupRepository.findAll().stream()
                .mapToInt(SizeScaleGroupEntity::getSortOrder)
                .max()
                .orElse(0) + 10;
    }

    private static String groupSnapshot(SizeScaleGroupEntity entity) {
        return "key=" + entity.getGroupKey()
                + ";label=" + entity.getLabel()
                + ";labelEn=" + entity.getLabelEn()
                + ";sortOrder=" + entity.getSortOrder()
                + ";active=" + entity.isActive();
    }

    /**
     * Derive the immutable public key from the Vietnamese label. Reuses the shared product slug
     * generator (also used for attribute codes) rather than the scale-code helper, because it
     * collapses repeated separators.
     */
    private static String buildGroupKey(String rawLabel) {
        String key = ProductSlugGenerator.toSlug(rawLabel == null ? "" : rawLabel.trim());
        if (key.isBlank()) {
            throw ValidationException.fromField("label", "INVALID_KEY",
                    "Tên nhóm không tạo được mã hợp lệ. Vui lòng dùng chữ hoặc số.");
        }
        return key.length() <= 64 ? key : key.substring(0, 64).replaceAll("-+$", "");
    }

    private int nextSortOrder() {
        return scaleRepository.findAllWithGroup().stream()
                .mapToInt(SizeScaleEntity::getSortOrder)
                .max()
                .orElse(0) + 10;
    }

    private List<ParsedValue> parseValues(List<String> rawValues) {
        if (rawValues == null || rawValues.isEmpty()) {
            throw ValidationException.fromField("values", "REQUIRED", "Phải nhập ít nhất một cỡ.");
        }
        Map<String, String> seen = new HashMap<>();
        java.util.ArrayList<ParsedValue> parsed = new java.util.ArrayList<>();
        for (String rawValue : rawValues) {
            String label = rawValue == null ? "" : rawValue.trim();
            String key = normalizeValueKey(label);
            if (label.isBlank() || key.isBlank()) {
                throw ValidationException.fromField("values", "INVALID_SIZE_VALUE", "Cỡ không được để trống.");
            }
            if (key.length() > 64) {
                throw ValidationException.fromField("values", "INVALID_SIZE_VALUE", "Cỡ không được vượt quá 64 ký tự.");
            }
            if (seen.containsKey(key)) {
                throw ValidationException.fromField("values", "DUPLICATE_SIZE_VALUE", "Cỡ " + label + " bị lặp lại");
            }
            seen.put(key, label);
            parsed.add(new ParsedValue(key, label));
        }
        return List.copyOf(parsed);
    }

    private static String buildScaleCode(String rawName) {
        String code = Normalizer.normalize(rawName.trim(), Normalizer.Form.NFD)
                .replace("đ", "d")
                .replace("Đ", "D")
                .replaceAll("\\p{M}+", "")
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("^-+|-+$", "");
        if (code.isBlank()) return "size-scale-" + UUID.randomUUID();
        return code.length() <= 64 ? code : code.substring(0, 64).replaceAll("-+$", "");
    }

    private static String normalizeValueKey(String raw) {
        return SizeScaleCatalog.normalizeValue(raw);
    }

    private SizeScaleResponse toResponse(SizeScaleEntity entity) {
        return new SizeScaleResponse(
                entity.getId(), entity.getCode(), entity.getName(), entity.getNameEn(),
                toGroupResponse(entity.getGroup()), entity.getFilterNamespace(), entity.getSortOrder(),
                entity.isActive(), valueRepository.findByScale_IdOrderBySortOrderAsc(entity.getId()).stream()
                        .map(AdminSizeScaleService::toValueResponse).toList());
    }

    private static SizeScaleGroupResponse toGroupResponse(SizeScaleGroupEntity entity) {
        return new SizeScaleGroupResponse(entity.getId(), entity.getGroupKey(), entity.getLabel(), entity.getLabelEn(),
                entity.getSortOrder(), entity.isActive());
    }

    private static SizeScaleValueResponse toValueResponse(SizeScaleValueEntity entity) {
        return new SizeScaleValueResponse(entity.getId(), entity.getValueKey(), entity.getLabel(), entity.getLabelEn(),
                entity.getSubgroupKey(), entity.getSubgroupLabel(), entity.getSubgroupLabelEn(), entity.getSortOrder(), entity.isActive());
    }

    private record ParsedValue(String key, String label) {
    }
}
