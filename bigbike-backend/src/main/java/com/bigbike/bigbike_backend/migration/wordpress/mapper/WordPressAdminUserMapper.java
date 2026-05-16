package com.bigbike.bigbike_backend.migration.wordpress.mapper;

import com.bigbike.bigbike_backend.domain.auth.AdminRole;
import com.bigbike.bigbike_backend.migration.wordpress.model.WpUser;
import com.bigbike.bigbike_backend.migration.wordpress.model.WpUserMeta;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Maps a WordPress user row into a {@link MappedAdminUser} when the user's
 * wp_capabilities indicate a privileged role (editor / shop_manager /
 * administrator / seo editor). Non-privileged users should be handled by
 * {@link WordPressCustomerMapper} instead.
 */
@Component
@RequiredArgsConstructor
public class WordPressAdminUserMapper {

    private final CapabilityMapper capabilityMapper;

    public record MappedAdminUser(
            long sourceId,
            String email,
            String legacyPasswordHash,
            String displayName,
            Set<AdminRole> roles,
            String status,
            List<String> warnings
    ) {}

    public MappedAdminUser map(WpUser user, List<WpUserMeta> userMetas, String tablePrefix) {
        List<String> warnings = new ArrayList<>();

        Map<String, String> meta = userMetas.stream()
                .filter(m -> m.userId() == user.id())
                .filter(m -> m.metaKey() != null)
                .collect(Collectors.toMap(
                        WpUserMeta::metaKey,
                        m -> m.metaValue() != null ? m.metaValue() : "",
                        (a, b) -> a
                ));

        String capKey = (tablePrefix != null && !tablePrefix.isBlank())
                ? tablePrefix + "capabilities"
                : "wp_capabilities";
        String serialized = meta.getOrDefault(capKey, meta.getOrDefault("wp_capabilities", null));

        CapabilityMapper.Mapped mapped = capabilityMapper.map(serialized);
        if (mapped.isEmpty()) {
            return null;  // caller should fall through to customer mapping
        }

        String email = user.userEmail();
        if (email == null || email.isBlank()) {
            warnings.add("Missing email for admin user id=" + user.id());
        }

        String status = "0".equals(user.userStatus()) || user.userStatus() == null
                ? "ACTIVE" : "DISABLED";

        String displayName = user.displayName() != null && !user.displayName().isBlank()
                ? user.displayName() : user.userLogin();

        return new MappedAdminUser(
                user.id(),
                email,
                user.userPass(),
                displayName,
                mapped.roles(),
                status,
                warnings
        );
    }

    public MappedAdminUser map(WpUser user, List<WpUserMeta> userMetas) {
        return map(user, userMetas, "kd_");
    }
}
