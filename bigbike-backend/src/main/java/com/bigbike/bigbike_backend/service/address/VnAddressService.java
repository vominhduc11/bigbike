package com.bigbike.bigbike_backend.service.address;

import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.api.public_.dto.VnAddressItem;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import java.io.IOException;
import java.io.InputStream;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

/**
 * Read-only Vietnamese administrative divisions (province → ward), loaded from a JSON resource
 * at startup so storefront/mobile address pickers don't need a separate datastore. Reflects the
 * 2025 administrative reform (Nghị quyết 202/2025/QH15 + 1654-1687/NQ-UBTVQH15): the district
 * tier was abolished nationwide from 01/07/2025, so this service only ever exposes 2 levels.
 */
@Service
@RequiredArgsConstructor
public class VnAddressService {

    private final ObjectMapper objectMapper;

    private List<VnAddressItem> provinces = List.of();
    private Map<String, List<VnAddressItem>> wardsByProvince = Map.of();

    @PostConstruct
    void load() throws IOException {
        try (InputStream in = new ClassPathResource("vn-address.json").getInputStream()) {
            List<RawProvince> raw = objectMapper.readValue(in, new TypeReference<>() {});
            this.provinces = raw.stream()
                    .map(p -> new VnAddressItem(p.code(), p.name()))
                    .toList();
            this.wardsByProvince = raw.stream().collect(Collectors.toMap(
                    RawProvince::code,
                    p -> p.wards() == null ? List.of()
                            : p.wards().stream()
                                    .map(w -> new VnAddressItem(w.code(), w.name()))
                                    .toList(),
                    (a, b) -> a,
                    LinkedHashMap::new
            ));
        }
    }

    public List<VnAddressItem> listProvinces() {
        return provinces;
    }

    public List<VnAddressItem> listWards(String provinceCode) {
        List<VnAddressItem> wards = wardsByProvince.get(provinceCode);
        if (wards == null) {
            throw new NotFoundException("Province not found: " + provinceCode);
        }
        return wards;
    }

    private record RawProvince(String code, String name, List<RawWard> wards) {}
    private record RawWard(String code, String name) {}
}
