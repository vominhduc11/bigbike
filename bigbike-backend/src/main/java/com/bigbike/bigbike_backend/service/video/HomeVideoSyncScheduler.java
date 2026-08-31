package com.bigbike.bigbike_backend.service.video;

import com.bigbike.bigbike_backend.service.video.YouTubeHomeVideoSyncService.SyncResult;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class HomeVideoSyncScheduler {

    private final YouTubeHomeVideoSyncService syncService;

    @Scheduled(cron = "0 10 4 * * *", zone = "Asia/Ho_Chi_Minh")
    public void syncOfficialYouTubeChannel() {
        SyncResult result = syncService.sync();
        log.info(
                "Homepage YouTube sync outcome={} added={} disabled={} existing={}",
                result.outcome(),
                result.added(),
                result.disabled(),
                result.duplicateOrExisting()
        );
    }
}
