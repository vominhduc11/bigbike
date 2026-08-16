package com.bigbike.bigbike_backend.service.chat;

import java.sql.Date;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.ConnectionCallback;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

/** Atomic daily budget gate for one logical assistant response. Contains no chat or identity data. */
@Service
@RequiredArgsConstructor
public class ChatAiQuotaService {

    private static final ZoneId VN_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    private final JdbcTemplate jdbcTemplate;
    private final PlatformTransactionManager transactionManager;
    private final Object h2ReservationMonitor = new Object();

    /**
     * Reserves one slot in a short independent transaction. A committed reservation is not
     * refunded when the provider fails, which keeps the paid ceiling conservative.
     */
    public boolean tryReserve(int dailyLimit) {
        if (dailyLimit <= 0) return false;
        LocalDate date = LocalDate.now(VN_ZONE);
        if (isH2()) {
            // The monitor surrounds the commit as well as the statements. This is only used by
            // H2 tests because H2 does not implement PostgreSQL's atomic ON CONFLICT statement.
            synchronized (h2ReservationMonitor) {
                return inNewTransaction(() -> tryReserveForH2Tests(date, dailyLimit));
            }
        }
        return inNewTransaction(() -> tryReserveForPostgres(date, dailyLimit));
    }

    private boolean tryReserveForPostgres(LocalDate date, int dailyLimit) {
        List<Integer> rows = jdbcTemplate.query(
                """
                insert into chat_ai_daily_usage (usage_date, used_count, created_at, updated_at)
                values (?, 1, now(), now())
                on conflict (usage_date) do update
                set used_count = chat_ai_daily_usage.used_count + 1,
                    updated_at = now()
                where chat_ai_daily_usage.used_count < ?
                returning used_count
                """,
                (resultSet, rowNumber) -> resultSet.getInt(1),
                Date.valueOf(date),
                dailyLimit);
        return !rows.isEmpty();
    }

    /** H2 has no PostgreSQL ON CONFLICT; serialization is test-runtime-only. */
    private boolean tryReserveForH2Tests(LocalDate date, int dailyLimit) {
        int updated = jdbcTemplate.update(
                """
                update chat_ai_daily_usage
                set used_count = used_count + 1, updated_at = current_timestamp
                where usage_date = ? and used_count < ?
                """,
                Date.valueOf(date), dailyLimit);
        if (updated == 1) return true;
        Integer existing = jdbcTemplate.queryForObject(
                "select count(*) from chat_ai_daily_usage where usage_date = ?",
                Integer.class,
                Date.valueOf(date));
        if (existing != null && existing > 0) return false;
        jdbcTemplate.update(
                """
                insert into chat_ai_daily_usage
                    (usage_date, used_count, created_at, updated_at)
                values (?, 1, current_timestamp, current_timestamp)
                """,
                Date.valueOf(date));
        return true;
    }

    private boolean inNewTransaction(java.util.function.BooleanSupplier work) {
        TransactionTemplate template = new TransactionTemplate(transactionManager);
        template.setPropagationBehavior(Propagation.REQUIRES_NEW.value());
        return Boolean.TRUE.equals(template.execute(status -> work.getAsBoolean()));
    }

    private boolean isH2() {
        Boolean result = jdbcTemplate.execute((ConnectionCallback<Boolean>) connection ->
                "H2".equalsIgnoreCase(connection.getMetaData().getDatabaseProductName()));
        return Boolean.TRUE.equals(result);
    }

    @Transactional(readOnly = true)
    public long usedToday() {
        return usedOn(LocalDate.now(VN_ZONE));
    }

    @Transactional(readOnly = true)
    public long usedOn(LocalDate date) {
        if (date == null) return 0L;
        Long result = jdbcTemplate.queryForObject(
                "select coalesce((select used_count from chat_ai_daily_usage where usage_date = ?), 0)",
                Long.class,
                Date.valueOf(date));
        return result == null ? 0L : result;
    }
}
