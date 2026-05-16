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
 * Read-only Vietnamese administrative divisions (province → district). Loaded from a JSON
 * resource at startup so storefront/mobile address pickers don't need a separate datastore.
 * Wards are not currently sourced; the wards endpoint returns an empty list to keep mobile happy.
 */
@Service
@RequiredArgsConstructor
public class VnAddressService {

    private final ObjectMapper objectMapper;

    private List<VnAddressItem> provinces = List.of();
    private Map<String, List<VnAddressItem>> districtsByProvince = Map.of();

    @PostConstruct
    void load() throws IOException {
        try (InputStream in = new ClassPathResource("vn-address.json").getInputStream()) {
            List<RawProvince> raw = objectMapper.readValue(in, new TypeReference<>() {});
            this.provinces = raw.stream()
                    .map(p -> new VnAddressItem(p.code(), p.name()))
                    .toList();
            this.districtsByProvince = raw.stream().collect(Collectors.toMap(
                    RawProvince::code,
                    p -> p.districts() == null ? List.of()
                            : p.districts().stream()
                                    .map(d -> new VnAddressItem(d.code(), d.name()))
                                    .toList(),
                    (a, b) -> a,
                    LinkedHashMap::new
            ));
        }
    }

    public List<VnAddressItem> listProvinces() {
        return provinces;
    }

    public List<VnAddressItem> listDistricts(String provinceCode) {
        List<VnAddressItem> districts = districtsByProvince.get(provinceCode);
        if (districts == null) {
            throw new NotFoundException("Province not found: " + provinceCode);
        }
        return districts;
    }

    public List<VnAddressItem> listWards(String districtCode) {
        // Ward-level data is not stored; return empty list so mobile UI degrades gracefully.
        return List.of();
    }

    private record RawProvince(String code, String name, List<RawDistrict> districts) {}
    private record RawDistrict(String code, String name) {}
}
