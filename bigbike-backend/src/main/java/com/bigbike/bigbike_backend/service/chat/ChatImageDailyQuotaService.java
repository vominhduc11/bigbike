package com.bigbike.bigbike_backend.service.chat;

import java.sql.Date;
import java.time.LocalDate;
import java.time.ZoneId;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ChatImageDailyQuotaService {

    private static final ZoneId VN_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private final JdbcTemplate jdbcTemplate;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean tryReserve(int limit) {
        if (limit <= 0) return false;
        LocalDate today = LocalDate.now(VN_ZONE);
        int changed = jdbcTemplate.update("""
                insert into chat_image_daily_usage(usage_date, used_count, created_at, updated_at)
                values (?, 1, now(), now())
                on conflict (usage_date) do update
                  set used_count = chat_image_daily_usage.used_count + 1,
                      updated_at = now()
                where chat_image_daily_usage.used_count < ?
                """, Date.valueOf(today), limit);
        return changed == 1;
    }
}
