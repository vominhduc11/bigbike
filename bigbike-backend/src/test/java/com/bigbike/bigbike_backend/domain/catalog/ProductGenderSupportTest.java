package com.bigbike.bigbike_backend.domain.catalog;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import org.junit.jupiter.api.Test;

class ProductGenderSupportTest {

    @Test
    void flagsMapToCanonicalZeroOneOrTwoValueArrays() {
        assertThat(ProductGenderSupport.fromFlags(false, false)).isEmpty();
        assertThat(ProductGenderSupport.fromFlags(true, false)).containsExactly("Nam");
        assertThat(ProductGenderSupport.fromFlags(false, true)).containsExactly("Nữ");
        assertThat(ProductGenderSupport.fromFlags(true, true)).containsExactly("Nam", "Nữ");
    }

    @Test
    void canonicalInputIsSortedAndRejectsDuplicatesOrUnknownValues() {
        assertThat(ProductGenderSupport.normalize(List.of("Nữ", "Nam")))
                .containsExactly("Nam", "Nữ");
        assertThat(ProductGenderSupport.normalize(List.of())).isEmpty();
        assertThatThrownBy(() -> ProductGenderSupport.normalize(List.of("Nam", "Nam")))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> ProductGenderSupport.normalize(List.of("Unisex")))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void legacyImportKeepsOldValuesAndMapsRemovedUnisexToNoGender() {
        assertThat(ProductGenderSupport.fromLegacy("Nam")).containsExactly("Nam");
        assertThat(ProductGenderSupport.fromLegacy("Nữ")).containsExactly("Nữ");
        assertThat(ProductGenderSupport.fromLegacy("Unisex")).isEmpty();
        assertThat(ProductGenderSupport.fromLegacy(" ")).isEmpty();
    }

    @Test
    void repeatedLegacyPublicFilterUsesTheFirstSupportedGender() {
        assertThat(ProductGenderSupport.firstSupported(List.of("Nam", "Nữ")))
                .containsExactly("Nam");
        assertThat(ProductGenderSupport.firstSupported(List.of("legacy", "Nữ")))
                .containsExactly("Nữ");
        assertThat(ProductGenderSupport.firstSupported(List.of("legacy"))).isEmpty();
    }

    @Test
    void csvUsesPipeForBothAndBlankForNoGender() {
        assertThat(ProductGenderSupport.toCsv(List.of("Nam", "Nữ"))).isEqualTo("Nam|Nữ");
        assertThat(ProductGenderSupport.toCsv(List.of())).isEmpty();
    }
}
