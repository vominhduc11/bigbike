package com.bigbike.bigbike_backend.service.chat;

import java.sql.Date;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
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

    /** One transaction owns both the daily counter and the durable per-image reservation. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public Reservation reserveImages(List<UUID> imageIds, int limit) {
        LocalDate today = LocalDate.now(VN_ZONE);
        jdbcTemplate.update("""
                insert into chat_image_daily_usage(usage_date, used_count, created_at, updated_at)
                values (?, 0, now(), now()) on conflict (usage_date) do nothing
                """, Date.valueOf(today));
        Integer used = jdbcTemplate.queryForObject(
                "select used_count from chat_image_daily_usage where usage_date = ? for update",
                Integer.class, Date.valueOf(today));
        int remaining = Math.max(0, limit - (used == null ? 0 : used));
        List<UUID> reserved = new ArrayList<>();
        int added = 0;
        for (UUID id : imageIds) {
            List<Date> dates = jdbcTemplate.query(
                    "select quota_reserved_on from chat_images where id = ? for update",
                    (row, index) -> row.getDate(1), id);
            if (dates.isEmpty()) continue;
            if (dates.get(0) != null) {
                reserved.add(id);
            } else if (remaining > 0) {
                jdbcTemplate.update("update chat_images set quota_reserved_on = ? where id = ?",
                        Date.valueOf(today), id);
                reserved.add(id);
                remaining--;
                added++;
            }
        }
        if (added > 0) jdbcTemplate.update("""
                update chat_image_daily_usage set used_count = used_count + ?, updated_at = now()
                where usage_date = ?
                """, added, Date.valueOf(today));
        return new Reservation(List.copyOf(reserved), today);
    }

    @Transactional(readOnly = true)
    public long usedOn(LocalDate date) {
        List<Long> values = jdbcTemplate.query("select used_count from chat_image_daily_usage where usage_date = ?",
                (row, index) -> row.getLong(1), Date.valueOf(date));
        return values.isEmpty() ? 0 : values.get(0);
    }

    public record Reservation(List<UUID> imageIds, LocalDate date) {}

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
