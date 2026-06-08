/**
 * Dịch toàn bộ nội dung tiếng Việt sang tiếng Anh cho các bảng bilingual.
 *
 * Cách dùng:
 *   node translate-en.mjs                       # dịch tất cả bảng
 *   node translate-en.mjs --table=products       # chỉ dịch bảng products
 *   node translate-en.mjs --dry-run              # xem trước, không ghi DB
 *   node translate-en.mjs --overwrite            # dịch lại cả các row đã có EN
 *
 * Yêu cầu môi trường:
 *   ANTHROPIC_API_KEY=sk-ant-...  (bắt buộc)
 *   POSTGRES_DB / POSTGRES_USER / POSTGRES_PASSWORD (đọc từ ../../.env)
 *   PostgreSQL đang chạy trên localhost:5432
 */

import pg from 'pg';
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// ── Load .env từ root repo ─────────────────────────────────────────────────
const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dir, '../../.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([^#=\s][^=]*)=(.*)$/);
    if (m && !process.env[m[1].trim()]) {
      process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
    }
  }
}

// ── Cấu hình ──────────────────────────────────────────────────────────────
const DB = {
  host:     process.env.POSTGRES_HOST     || '127.0.0.1',
  port:     parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB       || 'bigbike',
  user:     process.env.POSTGRES_USER     || 'bigbike',
  password: process.env.POSTGRES_PASSWORD || 'bigbike_dev_only',
};

const DRY_RUN   = process.argv.includes('--dry-run');
const OVERWRITE = process.argv.includes('--overwrite');
const TABLE_ARG = process.argv.find(a => a.startsWith('--table='))?.split('=')[1];

// Số row gửi Claude cùng 1 lần. Bảng có HTML dùng nhỏ hơn.
const BATCH_TEXT = 20;
const BATCH_HTML = 3;
const DELAY_MS   = 600; // tránh rate-limit

// ── Định nghĩa các bảng cần dịch ──────────────────────────────────────────
// html:true → giữ nguyên tag HTML, chỉ dịch text bên trong
const TABLES = [
  {
    name: 'products',
    pk: 'id',
    batchSize: BATCH_HTML,
    fields: [
      { vi: 'name',               en: 'name_en',               html: false },
      { vi: 'short_description',  en: 'short_description_en',  html: true  },
      { vi: 'description',        en: 'description_en',        html: true  },
      { vi: 'promotion_content',  en: 'promotion_content_en',  html: true  },
      { vi: 'installation_guide', en: 'installation_guide_en', html: true  },
      { vi: 'seo_title',          en: 'seo_title_en',          html: false },
      { vi: 'seo_description',    en: 'seo_description_en',    html: false },
    ],
  },
  {
    name: 'product_specifications',
    pk: 'id',
    batchSize: BATCH_TEXT,
    fields: [
      { vi: 'name',       en: 'name_en',       html: false },
      { vi: 'spec_value', en: 'spec_value_en', html: false },
      { vi: 'group_name', en: 'group_name_en', html: false },
    ],
  },
  {
    name: 'product_faqs',
    pk: 'id',
    batchSize: BATCH_HTML,
    fields: [
      { vi: 'question', en: 'question_en', html: false },
      { vi: 'answer',   en: 'answer_en',   html: true  },
    ],
  },
  {
    name: 'categories',
    pk: 'id',
    batchSize: BATCH_HTML,
    fields: [
      { vi: 'name',            en: 'name_en',            html: false },
      { vi: 'description',     en: 'description_en',     html: true  },
      { vi: 'seo_title',       en: 'seo_title_en',       html: false },
      { vi: 'seo_description', en: 'seo_description_en', html: false },
    ],
  },
  {
    name: 'brands',
    pk: 'id',
    batchSize: BATCH_HTML,
    fields: [
      { vi: 'name',            en: 'name_en',            html: false },
      { vi: 'description',     en: 'description_en',     html: true  },
      { vi: 'seo_title',       en: 'seo_title_en',       html: false },
      { vi: 'seo_description', en: 'seo_description_en', html: false },
    ],
  },
  {
    name: 'articles',
    pk: 'id',
    batchSize: BATCH_HTML,
    fields: [
      { vi: 'title',           en: 'title_en',           html: false },
      { vi: 'excerpt',         en: 'excerpt_en',         html: false },
      { vi: 'body',            en: 'body_en',            html: true  },
      { vi: 'seo_title',       en: 'seo_title_en',       html: false },
      { vi: 'seo_description', en: 'seo_description_en', html: false },
    ],
  },
  {
    name: 'pages',
    pk: 'id',
    batchSize: BATCH_HTML,
    fields: [
      { vi: 'title',            en: 'title_en',            html: false },
      { vi: 'body',             en: 'body_en',             html: true  },
      { vi: 'hero_title',       en: 'hero_title_en',       html: false },
      { vi: 'hero_description', en: 'hero_description_en', html: false },
      { vi: 'hero_kicker',      en: 'hero_kicker_en',      html: false },
      { vi: 'seo_title',        en: 'seo_title_en',        html: false },
      { vi: 'seo_description',  en: 'seo_description_en',  html: false },
    ],
  },
  {
    name: 'menu_items',
    pk: 'id',
    batchSize: BATCH_TEXT,
    fields: [{ vi: 'label', en: 'label_en', html: false }],
  },
  {
    name: 'home_videos',
    pk: 'id',
    batchSize: BATCH_TEXT,
    fields: [{ vi: 'title', en: 'title_en', html: false }],
  },
  {
    // Chỉ dịch các key hiển thị text, bỏ qua URL / số / config
    name: 'site_settings',
    pk: 'setting_key',
    batchSize: BATCH_TEXT,
    fields: [{ vi: 'setting_value', en: 'setting_value_en', html: false }],
    extraWhere: `
      AND setting_value IS NOT NULL
      AND setting_value <> ''
      AND setting_value !~ '^https?://'
      AND setting_value !~ '^[0-9]+(\\.[0-9]+)?$'
      AND setting_key !~* '(url|email|phone|address|password|secret|token|key|limit|count|size|id|slug|rate|number)$'
    `,
  },
  {
    name: 'attributes',
    pk: 'id',
    batchSize: BATCH_TEXT,
    fields: [{ vi: 'name', en: 'name_en', html: false }],
  },
  {
    name: 'attribute_values',
    pk: 'id',
    batchSize: BATCH_TEXT,
    fields: [{ vi: 'label', en: 'label_en', html: false }],
  },
];

// ── Gọi Claude để dịch một batch rows ─────────────────────────────────────
async function translateRows(ai, tableConfig, rows) {
  const hasHtml = tableConfig.fields.some(f => f.html);

  // Build payload: mỗi phần tử = { id, fields: { fieldName: "vi text", ... } }
  const payload = rows
    .map(row => {
      const fields = {};
      for (const f of tableConfig.fields) {
        const val = row[f.vi];
        if (val && String(val).trim()) fields[f.vi] = String(val);
      }
      return { id: row[tableConfig.pk], fields };
    })
    .filter(r => Object.keys(r.fields).length > 0);

  if (payload.length === 0) return [];

  const htmlNote = hasHtml
    ? '\n- Some fields contain HTML. Translate ONLY text content. Keep all HTML tags, attributes, and structure exactly as-is.'
    : '';

  const prompt = `You are a professional Vietnamese-to-English translator for BigBike, a premium Vietnamese bicycle shop.

Translate the Vietnamese text in the following JSON array to English. Rules:${htmlNote}
- Keep brand names, model numbers, and technical codes (e.g. "SL-K", "XTR", "105") unchanged
- Keep measurement units translated (e.g. "kg" stays "kg", "mm" stays "mm")
- For spec_value fields: only translate unit words, keep numbers unchanged
- For SEO fields: write concise, natural English (max 160 chars for seo_description)
- Return ONLY a JSON array with the same structure. No markdown, no explanation.

Input:
${JSON.stringify(payload)}`;

  const msg = await ai.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 8096,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = msg.content[0].text.trim();

  // Trích JSON array từ response (phòng trường hợp có markdown fence)
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) throw new Error(`Response không chứa JSON array:\n${text.slice(0, 300)}`);

  return JSON.parse(match[0]);
}

// ── Cập nhật DB với kết quả đã dịch ──────────────────────────────────────
async function applyTranslations(pool, tableConfig, translated) {
  let updated = 0;
  for (const item of translated) {
    if (!item?.fields || Object.keys(item.fields).length === 0) continue;

    const setClauses = [];
    const values = [];
    let idx = 1;

    for (const f of tableConfig.fields) {
      if (item.fields[f.vi] !== undefined) {
        setClauses.push(`${f.en} = $${idx++}`);
        values.push(item.fields[f.vi]);
      }
    }

    if (setClauses.length === 0) continue;

    values.push(item.id);
    await pool.query(
      `UPDATE ${tableConfig.name} SET ${setClauses.join(', ')} WHERE ${tableConfig.pk} = $${idx}`,
      values
    );
    updated++;
  }
  return updated;
}

// ── Main ──────────────────────────────────────────────────────────────────
async function main() {
  if (!process.env.ANTHROPIC_API_KEY && !DRY_RUN) {
    console.error('Lỗi: ANTHROPIC_API_KEY chưa được set.');
    console.error('Chạy: set ANTHROPIC_API_KEY=sk-ant-... (Windows) hoặc export ANTHROPIC_API_KEY=...');
    process.exit(1);
  }

  const pool = new pg.Pool(DB);
  const ai   = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  pool.on('error', err => { console.error('DB pool error:', err.message); });

  // Kiểm tra kết nối
  try {
    await pool.query('SELECT 1');
    console.log(`Kết nối DB thành công: ${DB.host}:${DB.port}/${DB.database}`);
  } catch (err) {
    console.error(`Không kết nối được DB: ${err.message}`);
    console.error('Hãy đảm bảo PostgreSQL đang chạy (docker compose up -d db)');
    process.exit(1);
  }

  const tables = TABLE_ARG
    ? TABLES.filter(t => t.name === TABLE_ARG)
    : TABLES;

  if (tables.length === 0) {
    console.error(`Bảng không tồn tại: ${TABLE_ARG}`);
    console.error('Các bảng hợp lệ:', TABLES.map(t => t.name).join(', '));
    process.exit(1);
  }

  if (DRY_RUN) console.log('\n[DRY RUN] Không ghi gì vào DB.\n');

  let totalRows = 0;
  let totalUpdated = 0;

  for (const tbl of tables) {
    console.log(`\n${'─'.repeat(50)}`);
    console.log(`Bảng: ${tbl.name}`);

    // Lấy các row chưa có EN (hoặc tất cả nếu --overwrite)
    const enCols = tbl.fields.map(f => f.en);
    const viCols = tbl.fields.map(f => f.vi);

    const nullCondition = OVERWRITE
      ? 'TRUE'
      : `(${enCols.map(c => `${c} IS NULL`).join(' OR ')})`;

    const extra = tbl.extraWhere || '';

    const { rows } = await pool.query(`
      SELECT ${tbl.pk}, ${viCols.join(', ')}
      FROM ${tbl.name}
      WHERE ${nullCondition} ${extra}
      ORDER BY ${tbl.pk}
    `);

    console.log(`  Cần dịch: ${rows.length} rows`);
    totalRows += rows.length;

    if (rows.length === 0) continue;

    if (DRY_RUN) {
      console.log(`  Mẫu row đầu tiên:`, JSON.stringify(rows[0]).slice(0, 200));
      continue;
    }

    const batchSize = tbl.batchSize;
    const totalBatches = Math.ceil(rows.length / batchSize);

    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      process.stdout.write(`  Batch ${batchNum}/${totalBatches} (${batch.length} rows)... `);

      try {
        const translated = await translateRows(ai, tbl, batch);
        const updated = await applyTranslations(pool, tbl, translated);
        totalUpdated += updated;
        console.log(`OK (+${updated})`);
      } catch (err) {
        console.log(`LỖI: ${err.message.slice(0, 120)}`);

        // Retry từng row một nếu batch fail
        if (batch.length > 1) {
          console.log(`  → Thử lại từng row...`);
          for (const row of batch) {
            try {
              const translated = await translateRows(ai, tbl, [row]);
              const updated = await applyTranslations(pool, tbl, translated);
              totalUpdated += updated;
              process.stdout.write('.');
            } catch (e2) {
              process.stdout.write('x');
            }
            await sleep(DELAY_MS);
          }
          console.log();
        }
      }

      await sleep(DELAY_MS);
    }
  }

  await pool.end();

  console.log('\n' + '═'.repeat(50));
  console.log(`Hoàn tất! Tổng cộng: ${totalRows} rows cần dịch, ${totalUpdated} rows đã cập nhật.`);
  if (DRY_RUN) console.log('[DRY RUN] Không có thay đổi nào được ghi vào DB.');
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

main().catch(err => {
  console.error('\nLỗi nghiêm trọng:', err.message);
  process.exit(1);
});
