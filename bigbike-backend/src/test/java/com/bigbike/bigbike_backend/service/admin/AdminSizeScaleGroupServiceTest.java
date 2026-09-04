package com.bigbike.bigbike_backend.service.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.bigbike.bigbike_backend.api.admin.dto.CreateSizeScaleGroupRequest;
import com.bigbike.bigbike_backend.api.admin.dto.SizeScaleGroupResponse;
import com.bigbike.bigbike_backend.api.admin.dto.UpdateSizeScaleGroupRequest;
import com.bigbike.bigbike_backend.api.error.ConflictException;
import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.persistence.entity.catalog.SizeScaleEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.SizeScaleGroupEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.SizeScaleGroupJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.SizeScaleJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.SizeScaleValueJpaRepository;
import com.bigbike.bigbike_backend.service.admin.support.AuditLogFactory;
import com.bigbike.bigbike_backend.service.audit.AuditLogWriter;
import com.bigbike.bigbike_backend.service.web.WebRevalidationService;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;

/**
 * Size filter groups became admin-managed on 2026-09-04 ({@code CATALOG_RULE_012}). These tests
 * pin the invariants that keep the public size filter intact: the derived key never moves, a
 * group in use cannot be deleted, and switching a group off destroys nothing.
 */
class AdminSizeScaleGroupServiceTest {

    private final SizeScaleGroupJpaRepository groups = mock(SizeScaleGroupJpaRepository.class);
    private final SizeScaleJpaRepository scales = mock(SizeScaleJpaRepository.class);
    private final SizeScaleValueJpaRepository values = mock(SizeScaleValueJpaRepository.class);
    private final ProductJpaRepository products = mock(ProductJpaRepository.class);
    private final WebRevalidationService revalidation = mock(WebRevalidationService.class);

    private final AdminSizeScaleService service = new AdminSizeScaleService(
            groups, scales, values, products,
            mock(AuditLogWriter.class), new AuditLogFactory(), revalidation);

    // ── create ────────────────────────────────────────────────────────────

    @Test
    void derivesAKebabCaseKeyFromTheVietnameseLabel() {
        when(groups.findByGroupKey(any())).thenReturn(Optional.empty());
        when(groups.findAll()).thenReturn(List.of());
        when(groups.saveAndFlush(any())).thenAnswer(i -> i.getArgument(0));

        SizeScaleGroupResponse created = service.createGroup(
                request("Cỡ quần (eo inch)", "Pants (waist inch)"), UUID.randomUUID());

        assertThat(created.key()).isEqualTo("co-quan-eo-inch");
        assertThat(created.label()).isEqualTo("Cỡ quần (eo inch)");
        assertThat(created.active()).isTrue();
    }

    @Test
    void appendsTheNewGroupAfterEveryExistingOneIncludingDeactivatedOnes() {
        when(groups.findByGroupKey(any())).thenReturn(Optional.empty());
        // pants-number is inactive but still holds sort order 30 — a new group must clear it.
        when(groups.findAll()).thenReturn(List.of(group("g1", "shoe", true, 20), group("g2", "pants-number", false, 40)));
        when(groups.saveAndFlush(any())).thenAnswer(i -> i.getArgument(0));

        assertThat(service.createGroup(request("Cỡ mũ", "Helmet"), UUID.randomUUID()).sortOrder())
                .isEqualTo(50);
    }

    @Test
    void rejectsAKeyThatCollidesWithAnActiveGroup() {
        when(groups.findByGroupKey("co-giay")).thenReturn(Optional.of(group("g1", "co-giay", true, 10)));

        assertThatThrownBy(() -> service.createGroup(request("Cỡ giày", "Shoes"), UUID.randomUUID()))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("đã tồn tại")
                .hasMessageNotContaining("đang tắt");
    }

    @Test
    void pointsTheOperatorAtTheDeactivatedGroupWhenTheKeyCollidesWithIt() {
        when(groups.findByGroupKey("co-giay")).thenReturn(Optional.of(group("g1", "co-giay", false, 10)));

        assertThatThrownBy(() -> service.createGroup(request("Cỡ giày", "Shoes"), UUID.randomUUID()))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("đang tắt")
                .hasMessageContaining("bật lại");
    }

    @Test
    void rejectsALabelThatProducesNoUsableKey() {
        assertThatThrownBy(() -> service.createGroup(request("!!!", "???"), UUID.randomUUID()))
                .isInstanceOf(ValidationException.class);
    }

    @Test
    void translatesAConcurrentUniqueViolationIntoTheSameConflict() {
        when(groups.findByGroupKey(any())).thenReturn(Optional.empty());
        when(groups.findAll()).thenReturn(List.of());
        when(groups.saveAndFlush(any())).thenThrow(new DataIntegrityViolationException("uq"));

        assertThatThrownBy(() -> service.createGroup(request("Cỡ mũ", "Helmet"), UUID.randomUUID()))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("đã tồn tại");
    }

    // ── update ────────────────────────────────────────────────────────────

    @Test
    void renamingNeverMovesTheGroupKeyEvenWhenNoScaleUsesTheGroup() {
        SizeScaleGroupEntity entity = group("g1", "pants-waist", true, 30);
        when(groups.findById("g1")).thenReturn(Optional.of(entity));
        when(groups.save(entity)).thenReturn(entity);
        when(scales.countByGroup_Id("g1")).thenReturn(0L);

        SizeScaleGroupResponse updated = service.updateGroup(
                "g1", update("Cỡ quần dài", "Long pants", null), UUID.randomUUID());

        assertThat(updated.label()).isEqualTo("Cỡ quần dài");
        // The key is copied into every scale's public filter namespace — it must not follow the label.
        assertThat(updated.key()).isEqualTo("pants-waist");
    }

    @Test
    void patchWithOnlyTheActiveFlagLeavesBothLabelsUntouched() {
        SizeScaleGroupEntity entity = group("g1", "shoe", true, 20);
        when(groups.findById("g1")).thenReturn(Optional.of(entity));
        when(groups.save(entity)).thenReturn(entity);

        SizeScaleGroupResponse updated = service.updateGroup(
                "g1", update(null, null, false), UUID.randomUUID());

        assertThat(updated.active()).isFalse();
        assertThat(updated.label()).isEqualTo("Nhãn shoe");
        assertThat(updated.labelEn()).isEqualTo("Label shoe");
    }

    @Test
    void rejectsABlankLabelWithoutTouchingTheStoredOne() {
        SizeScaleGroupEntity entity = group("g1", "shoe", true, 20);
        when(groups.findById("g1")).thenReturn(Optional.of(entity));

        assertThatThrownBy(() -> service.updateGroup("g1", update("   ", null, null), UUID.randomUUID()))
                .isInstanceOf(ValidationException.class);
        assertThat(entity.getLabel()).isEqualTo("Nhãn shoe");
    }

    @Test
    void reportsAnUnknownGroup() {
        when(groups.findById("nope")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.updateGroup("nope", update("x", null, null), UUID.randomUUID()))
                .isInstanceOf(NotFoundException.class);
    }

    // ── delete ────────────────────────────────────────────────────────────

    @Test
    void blocksDeletingAGroupThatScalesStillPointAtAndNamesTheCount() {
        SizeScaleGroupEntity entity = group("g1", "clothing-letter", true, 10);
        when(groups.findById("g1")).thenReturn(Optional.of(entity));
        when(scales.countByGroup_Id("g1")).thenReturn(3L);

        assertThatThrownBy(() -> service.deleteGroup("g1", UUID.randomUUID()))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("3 bảng cỡ");
        verify(groups, never()).delete(any());
    }

    @Test
    void deletesAGroupNoScaleReferences() {
        SizeScaleGroupEntity entity = group("g1", "spare", true, 50);
        when(groups.findById("g1")).thenReturn(Optional.of(entity));
        when(scales.countByGroup_Id("g1")).thenReturn(0L);

        service.deleteGroup("g1", UUID.randomUUID());

        verify(groups).delete(entity);
        // Nothing else may be removed — scales and values are never cascaded from a group.
        verify(scales, never()).delete(any());
        verify(values, never()).delete(any());
        verify(values, never()).deleteAll(any());
    }

    // ── listing ───────────────────────────────────────────────────────────

    @Test
    void listsActiveGroupsByDefaultAndEverythingWhenAsked() {
        when(groups.findAllByActiveTrueOrderBySortOrderAscGroupKeyAsc())
                .thenReturn(List.of(group("g1", "shoe", true, 20)));
        when(groups.findAllByOrderBySortOrderAscGroupKeyAsc())
                .thenReturn(List.of(group("g1", "shoe", true, 20), group("g2", "pants-number", false, 30)));

        assertThat(service.listGroups(false)).hasSize(1);
        // Without this the operator could switch a group off and never reach it again.
        assertThat(service.listGroups(true)).hasSize(2);
    }

    // ── scale-side regression: a disabled group must not strand its scales ──

    @Test
    void aScaleStaysEditableAfterItsOwnGroupIsSwitchedOff() {
        SizeScaleGroupEntity disabled = group("g1", "shoe", false, 20);
        SizeScaleEntity scale = new SizeScaleEntity();
        scale.setId("size-scale-shoe-eu");
        scale.setCode("shoe-eu");
        scale.setSortOrder(40);
        scale.setGroup(disabled);
        when(scales.findById("size-scale-shoe-eu")).thenReturn(Optional.of(scale));
        when(groups.findById("g1")).thenReturn(Optional.of(disabled));
        when(products.countBySizeScaleId("size-scale-shoe-eu")).thenReturn(0L);
        when(scales.save(any())).thenAnswer(i -> i.getArgument(0));
        when(values.findByScale_IdOrderBySortOrderAsc(any())).thenReturn(List.of());

        var request = new com.bigbike.bigbike_backend.api.admin.dto.UpsertSizeScaleRequest();
        request.setName("Cỡ giày châu Âu");
        request.setGroupId("g1");
        request.setValues(List.of("36", "37"));

        assertThat(service.updateScale("size-scale-shoe-eu", request).name())
                .isEqualTo("Cỡ giày châu Âu");
    }

    @Test
    void refusesMovingAScaleIntoASwitchedOffGroup() {
        SizeScaleGroupEntity liveGroup = group("g1", "shoe", true, 20);
        SizeScaleGroupEntity disabled = group("g2", "pants-number", false, 30);
        SizeScaleEntity scale = new SizeScaleEntity();
        scale.setId("size-scale-shoe-eu");
        scale.setGroup(liveGroup);
        when(scales.findById("size-scale-shoe-eu")).thenReturn(Optional.of(scale));
        when(groups.findById("g2")).thenReturn(Optional.of(disabled));

        var request = new com.bigbike.bigbike_backend.api.admin.dto.UpsertSizeScaleRequest();
        request.setName("Cỡ giày châu Âu");
        request.setGroupId("g2");
        request.setValues(List.of("36"));

        assertThatThrownBy(() -> service.updateScale("size-scale-shoe-eu", request))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("đang tắt");
    }

    // ── helpers ───────────────────────────────────────────────────────────

    private static CreateSizeScaleGroupRequest request(String label, String labelEn) {
        CreateSizeScaleGroupRequest r = new CreateSizeScaleGroupRequest();
        r.setLabel(label);
        r.setLabelEn(labelEn);
        return r;
    }

    private static UpdateSizeScaleGroupRequest update(String label, String labelEn, Boolean active) {
        UpdateSizeScaleGroupRequest r = new UpdateSizeScaleGroupRequest();
        r.setLabel(label);
        r.setLabelEn(labelEn);
        r.setActive(active);
        return r;
    }

    private static SizeScaleGroupEntity group(String id, String key, boolean active, int sortOrder) {
        SizeScaleGroupEntity g = new SizeScaleGroupEntity();
        g.setId(id);
        g.setGroupKey(key);
        g.setLabel("Nhãn " + key);
        g.setLabelEn("Label " + key);
        g.setSortOrder(sortOrder);
        g.setActive(active);
        return g;
    }
}
