package db.migration;

import com.bigbike.bigbike_backend.service.content.ArticleBodyBlockBackfill;
import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;

/** Runs after table-block support is available; the migration is one transaction. */
public class V1086__BackfillMissingArticleBodyBlocks extends BaseJavaMigration {
    @Override
    public void migrate(Context context) throws Exception {
        while (ArticleBodyBlockBackfill.fillMissing(context.getConnection(), 50) > 0) {
            // Every successful batch reduces the missing set. Never overwrite existing blocks.
        }
    }
}
