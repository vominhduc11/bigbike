/**
 * BigBike WP Data Extractor
 *
 * Prerequisites:
 *   npm run etl:start   — starts MariaDB container with the WP dump
 *   (wait ~2 min for dump import, check: docker logs bigbike-etl-db)
 *   npm run etl:run     — runs this script
 *   npm run etl:stop    — shuts down the container
 *
 * Output: JSON files in scripts/extract-wp-data/output/
 */

import mysql from "mysql2/promise";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const DB = {
  host: process.env.ETL_DB_HOST ?? "127.0.0.1",
  port: Number(process.env.ETL_DB_PORT ?? "3307"),
  user: process.env.ETL_DB_USER ?? "etl_user",
  password: process.env.ETL_DB_PASSWORD ?? "etl_pass",
  database: process.env.ETL_DB_NAME ?? "bigbike_wp",
  charset: "utf8mb4",
};

const OUT_DIR = join(__dirname, "output");
const PREFIX = "kd_";
const WP_UPLOADS_PREFIX = "/wp-content/uploads/";

function write(filename: string, data: unknown) {
  mkdirSync(OUT_DIR, { recursive: true });
  const path = join(OUT_DIR, filename);
  writeFileSync(path, JSON.stringify(data, null, 2), "utf8");
  console.log(`✓ ${filename} (${Array.isArray(data) ? data.length + " rows" : "object"})`);
}

function toWpUploadUrl(filePath: string | null | undefined) {
  if (!filePath || !filePath.trim()) return null;
  const normalized = filePath.replace(/^\/+/, "");
  return `${WP_UPLOADS_PREFIX}${normalized}`;
}

function parsePositiveInt(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = parseInt(String(value), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseNullableInt(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseBooleanMeta(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const normalized = String(value).trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

function productLinkFromSlug(slug: string | null | undefined) {
  return slug ? `/sp/${slug}.html` : null;
}

async function resolveAttachments(db: mysql.Connection, attachmentIds: number[]) {
  const uniqueIds = [...new Set(attachmentIds.filter((id) => Number.isFinite(id) && id > 0))];
  if (uniqueIds.length === 0) return {};

  const [rows] = await db.query(`
    SELECT
      p.ID AS id,
      p.post_title AS title,
      p.post_excerpt AS caption,
      pm.meta_value AS filePath
    FROM ${PREFIX}posts p
    LEFT JOIN ${PREFIX}postmeta pm ON pm.post_id = p.ID AND pm.meta_key = '_wp_attached_file'
    WHERE p.ID IN (?)
      AND p.post_type = 'attachment'
  `, [uniqueIds]) as [Array<{ id: number; title: string | null; caption: string | null; filePath: string | null }>, unknown];

  const found = Object.fromEntries(rows.map((row) => [
    row.id,
    {
      id: String(row.id),
      url: toWpUploadUrl(row.filePath),
      alt: row.title || row.caption || null,
      width: null,
      height: null,
      path: row.filePath ? `/${row.filePath.replace(/^\/+/, "")}` : null,
    },
  ]));

  for (const id of uniqueIds) {
    if (!found[id]) {
      console.warn(`Warning: attachment ${id} was not found; keeping image url as null.`);
      found[id] = {
        id: String(id),
        url: null,
        alt: null,
        width: null,
        height: null,
        path: null,
      };
    }
  }

  return found;
}

async function extractCategories(db: mysql.Connection) {
  const [rows] = await db.query(`
    SELECT
      t.term_id   AS id,
      t.name,
      t.slug,
      tt.description,
      tt.parent   AS parentId,
      tt.count,
      MAX(CASE WHEN tm.meta_key = 'show_on_homepage' THEN tm.meta_value END) AS showOnHomepageRaw,
      MAX(CASE WHEN tm.meta_key = 'ordering' THEN tm.meta_value END) AS sortOrderRaw
    FROM ${PREFIX}terms t
    JOIN ${PREFIX}term_taxonomy tt ON tt.term_id = t.term_id
    LEFT JOIN ${PREFIX}termmeta tm ON tm.term_id = t.term_id
    WHERE tt.taxonomy = 'product_cat'
      AND tt.count > 0
    GROUP BY t.term_id, t.name, t.slug, tt.description, tt.parent, tt.count
    ORDER BY tt.parent, t.name
  `) as [Array<Record<string, unknown>>, unknown];
  write("categories.json", rows.map((row) => {
    const { showOnHomepageRaw, sortOrderRaw, ...category } = row;
    return {
      ...category,
      showOnHomepage: parseBooleanMeta(showOnHomepageRaw),
      sortOrder: parseNullableInt(sortOrderRaw),
    };
  }));
}

async function extractBrands(db: mysql.Connection) {
  const [rows] = await db.query(`
    SELECT
      t.term_id   AS id,
      t.name,
      t.slug,
      tt.description,
      tt.count
    FROM ${PREFIX}terms t
    JOIN ${PREFIX}term_taxonomy tt ON tt.term_id = t.term_id
    WHERE tt.taxonomy = 'pwb-brand'
      AND tt.count > 0
    ORDER BY t.name
  `);
  write("brands.json", rows);
}

async function extractProducts(db: mysql.Connection) {
  // Step 1: base product posts
  const [posts] = await db.query(`
    SELECT
      p.ID         AS id,
      p.post_title AS name,
      p.post_name  AS slug,
      p.post_content AS description,
      p.post_excerpt AS shortDescription,
      p.post_status AS status,
      p.post_date   AS createdAt,
      p.post_modified AS updatedAt
    FROM ${PREFIX}posts p
    WHERE p.post_type = 'product'
      AND p.post_status = 'publish'
    ORDER BY p.ID
  `) as [Array<Record<string, unknown>>, unknown];

  // Step 2: meta for each product (batch query)
  const ids = (posts as Array<{ id: number }>).map((p) => p.id);
  if (ids.length === 0) {
    write("products.json", []);
    return;
  }

  const [metas] = await db.query(`
    SELECT post_id, meta_key, meta_value
    FROM ${PREFIX}postmeta
    WHERE post_id IN (?)
      AND meta_key IN (
        '_sku', '_regular_price', '_sale_price', '_price',
        '_stock_status', '_stock', '_thumbnail_id',
        '_product_image_gallery', '_product_attributes',
        'rating', '_rating', 'rating_count',
        'show_on_homepage', '_show_on_homepage', 'showOnHomepage', 'homepage_product'
      )
  `, [ids]) as [Array<{ post_id: number; meta_key: string; meta_value: string }>, unknown];

  // Step 3: category, brand and product visibility taxonomy
  const [taxRows] = await db.query(`
    SELECT
      tr.object_id AS productId,
      t.term_id AS termId,
      t.slug,
      t.name,
      tt.taxonomy
    FROM ${PREFIX}term_relationships tr
    JOIN ${PREFIX}term_taxonomy tt ON tt.term_taxonomy_id = tr.term_taxonomy_id
    JOIN ${PREFIX}terms t ON t.term_id = tt.term_id
    WHERE tr.object_id IN (?)
      AND tt.taxonomy IN ('product_cat', 'pwb-brand', 'product_visibility')
  `, [ids]) as [Array<{ productId: number; termId: number; slug: string; name: string; taxonomy: string }>, unknown];

  // Step 4: resolve thumbnail URLs
  const thumbIds = (metas as Array<{ post_id: number; meta_key: string; meta_value: string }>)
    .filter((m) => m.meta_key === "_thumbnail_id" && m.meta_value)
    .map((m) => parseInt(m.meta_value, 10))
    .filter((id) => !isNaN(id));

  let thumbMap: Record<number, string> = {};
  if (thumbIds.length > 0) {
    const [thumbMetas] = await db.query(`
      SELECT post_id, meta_value AS filePath
      FROM ${PREFIX}postmeta
      WHERE post_id IN (?)
        AND meta_key = '_wp_attached_file'
    `, [thumbIds]) as [Array<{ post_id: number; filePath: string }>, unknown];
    thumbMap = Object.fromEntries(
      (thumbMetas as Array<{ post_id: number; filePath: string }>)
        .map((r) => [r.post_id, r.filePath])
    );
  }

  // Assemble products
  const metaByPost: Record<number, Record<string, string>> = {};
  for (const m of metas as Array<{ post_id: number; meta_key: string; meta_value: string }>) {
    if (!metaByPost[m.post_id]) metaByPost[m.post_id] = {};
    metaByPost[m.post_id][m.meta_key] = m.meta_value;
  }

  const taxByPost: Record<number, { categories: Array<{ slug: string; name: string }>; brand?: { slug: string; name: string }; isFeatured?: boolean }> = {};
  for (const row of taxRows as Array<{ productId: number; termId: number; slug: string; name: string; taxonomy: string }>) {
    if (!taxByPost[row.productId]) taxByPost[row.productId] = { categories: [] };
    if (row.taxonomy === "product_cat") {
      taxByPost[row.productId].categories.push({ slug: row.slug, name: row.name });
    } else if (row.taxonomy === "pwb-brand") {
      taxByPost[row.productId].brand = { slug: row.slug, name: row.name };
    } else if (row.taxonomy === "product_visibility" && row.slug === "featured") {
      taxByPost[row.productId].isFeatured = true;
    }
  }

  const products = (posts as Array<Record<string, unknown>>).map((post) => {
    const meta = metaByPost[post.id as number] ?? {};
    const tax = taxByPost[post.id as number] ?? { categories: [] };
    const thumbId = meta["_thumbnail_id"] ? parseInt(meta["_thumbnail_id"], 10) : null;
    const thumbPath = thumbId ? thumbMap[thumbId] : null;

    return {
      id: String(post.id),
      name: post.name,
      slug: post.slug,
      description: post.description,
      shortDescription: post.shortDescription,
      status: post.status,
      sku: meta["_sku"] || null,
      priceRegular: meta["_regular_price"] ? parseInt(meta["_regular_price"], 10) : null,
      priceSale: meta["_sale_price"] ? parseInt(meta["_sale_price"], 10) : null,
      priceCurrent: meta["_price"] ? parseInt(meta["_price"], 10) : null,
      stockStatus: meta["_stock_status"] || "instock",
      stockQuantity: meta["_stock"] ? parseInt(meta["_stock"], 10) : null,
      thumbnailPath: thumbPath,
      isFeatured: Boolean(tax.isFeatured),
      showOnHomepage: parseBooleanMeta(meta["show_on_homepage"] || meta["_show_on_homepage"] || meta["showOnHomepage"] || meta["homepage_product"]),
      rating: meta["rating"] || meta["_rating"] ? parseFloat(meta["rating"] || meta["_rating"]) : 4.5,
      reviewCount: meta["rating_count"] ? parseInt(meta["rating_count"], 10) : 124,
      categories: tax.categories,
      brand: tax.brand ?? null,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
    };
  });

  write("products.json", products);
}

async function extractPages(db: mysql.Connection) {
  const TARGET_SLUGS = [
    "gioi-thieu",
    "huong-dan-mua-hang",
    "cach-do-size-gang-tay",
    "cach-do-size-dau",
    "chinh-sach-bao-ve-thong-tin-ca-nhan",
    "chinh-sach-bao-hanh",
    "chinh-sach-doi-tra-hang",
    "cac-dieu-kien-va-dieu-khoan",
    "lien-he",
    "huong-dan-mua-hang-online-html",
  ];

  const [rows] = await db.query(`
    SELECT ID AS id, post_title AS title, post_name AS slug, post_content AS body, post_modified AS updatedAt
    FROM ${PREFIX}posts
    WHERE post_type = 'page'
      AND post_status = 'publish'
      AND post_name IN (?)
  `, [TARGET_SLUGS]);

  write("pages.json", rows);
}

async function extractRedirects(db: mysql.Connection) {
  const [rows] = await db.query(`
    SELECT id, url_from AS source, url_to AS destination, header_code AS statusCode
    FROM ${PREFIX}rank_math_redirections
    WHERE status = 'active'
    ORDER BY id
  `).catch(() => {
    console.warn("⚠ kd_rank_math_redirections not found — skipping");
    return [[]];
  });

  write("redirects-rank-math.json", rows);
}

async function extractNavMenus(db: mysql.Connection) {
  // Get menu terms
  const [menus] = await db.query(`
    SELECT t.term_id, t.name, t.slug
    FROM ${PREFIX}terms t
    JOIN ${PREFIX}term_taxonomy tt ON tt.term_id = t.term_id
    WHERE tt.taxonomy = 'nav_menu'
  `) as [Array<{ term_id: number; name: string; slug: string }>, unknown];

  const result: Record<string, unknown[]> = {};

  for (const menu of menus as Array<{ term_id: number; name: string; slug: string }>) {
    const [items] = await db.query(`
      SELECT
        p.ID AS id,
        p.post_title AS label,
        p.menu_order AS sortOrder,
        MAX(CASE WHEN pm.meta_key = '_menu_item_url' THEN pm.meta_value END) AS url,
        MAX(CASE WHEN pm.meta_key = '_menu_item_menu_item_parent' THEN pm.meta_value END) AS parentId,
        MAX(CASE WHEN pm.meta_key = '_menu_item_target' THEN pm.meta_value END) AS target,
        MAX(CASE WHEN pm.meta_key = '_menu_item_classes' THEN pm.meta_value END) AS cssClass
      FROM ${PREFIX}posts p
      JOIN ${PREFIX}term_relationships tr ON tr.object_id = p.ID
      JOIN ${PREFIX}postmeta pm ON pm.post_id = p.ID
      WHERE p.post_type = 'nav_menu_item'
        AND p.post_status = 'publish'
        AND tr.term_taxonomy_id = (
          SELECT term_taxonomy_id FROM ${PREFIX}term_taxonomy WHERE term_id = ?
        )
      GROUP BY p.ID, p.post_title, p.menu_order
      ORDER BY p.menu_order
    `, [menu.term_id]);

    result[menu.slug] = items as unknown[];
  }

  write("navigation.json", result);
}

async function extractBrandLogos(db: mysql.Connection) {
  // Get brand logo attachment IDs from termmeta
  const [rows] = await db.query(`
    SELECT
      t.slug AS brandSlug,
      t.name AS brandName,
      pm.meta_value AS filePath
    FROM ${PREFIX}terms t
    JOIN ${PREFIX}term_taxonomy tt ON tt.term_id = t.term_id
    JOIN ${PREFIX}termmeta tm ON tm.term_id = t.term_id AND tm.meta_key = 'pwb_brand_image'
    JOIN ${PREFIX}postmeta pm ON pm.post_id = tm.meta_value AND pm.meta_key = '_wp_attached_file'
    WHERE tt.taxonomy = 'pwb-brand'
  `).catch(() => {
    console.warn("⚠ brand logos query failed — skipping");
    return [[]];
  });

  write("brand-logos.json", rows);
}

async function extractSliders(db: mysql.Connection) {
  const [metaRows] = await db.query(`
    SELECT meta_key AS metaKey, meta_value AS metaValue
    FROM ${PREFIX}postmeta
    WHERE post_id = 12
      AND meta_key REGEXP '^sliders_[0-9]+_(image|image_mobile|product|link)$'
    ORDER BY meta_key
  `) as [Array<{ metaKey: string; metaValue: string | null }>, unknown];

  const grouped = new Map<number, Record<string, string | null>>();
  for (const row of metaRows) {
    const match = row.metaKey.match(/^sliders_(\d+)_(image|image_mobile|product|link)$/);
    if (!match) continue;
    const index = parseInt(match[1], 10);
    const key = match[2];
    if (!grouped.has(index)) grouped.set(index, {});
    grouped.get(index)![key] = row.metaValue;
  }

  const imageIds = [...grouped.values()]
    .flatMap((group) => [parsePositiveInt(group.image), parsePositiveInt(group.image_mobile)])
    .filter((id): id is number => id !== null);
  const attachmentMap = await resolveAttachments(db, imageIds);

  const productIds = [...grouped.values()]
    .map((group) => parsePositiveInt(group.product))
    .filter((id): id is number => id !== null);

  let productMap: Record<number, { postId: number; slug: string; name: string; link: string | null }> = {};
  if (productIds.length > 0) {
    const [productRows] = await db.query(`
      SELECT ID AS postId, post_name AS slug, post_title AS name
      FROM ${PREFIX}posts
      WHERE ID IN (?)
        AND post_type = 'product'
    `, [[...new Set(productIds)]]) as [Array<{ postId: number; slug: string; name: string }>, unknown];

    productMap = Object.fromEntries(productRows.map((product) => [
      product.postId,
      {
        postId: product.postId,
        slug: product.slug,
        name: product.name,
        link: productLinkFromSlug(product.slug),
      },
    ]));
  }

  const sliders = [...grouped.entries()]
    .sort(([a], [b]) => a - b)
    .map(([index, group]) => {
      const imageAttachmentId = parsePositiveInt(group.image);
      const imageMobileAttachmentId = parsePositiveInt(group.image_mobile);
      const productPostId = parsePositiveInt(group.product);
      const product = productPostId ? productMap[productPostId] ?? null : null;
      const externalLink = group.link && group.link.trim() ? group.link.trim() : null;
      const finalLink = product?.link || externalLink || null;

      if (imageAttachmentId && attachmentMap[imageAttachmentId]?.url === null) {
        console.warn(`Warning: slider ${index} desktop image ${imageAttachmentId} has no resolved URL.`);
      }
      if (!imageAttachmentId) {
        console.warn(`Warning: slider ${index} has no desktop image attachment ID.`);
      }
      if (!finalLink) {
        console.warn(`Warning: slider ${index} has no product link or external link.`);
      }

      return {
        index,
        sortOrder: index,
        location: "home",
        imageAttachmentId,
        imageMobileAttachmentId,
        productPostId,
        link: externalLink,
        desktopImage: imageAttachmentId
          ? attachmentMap[imageAttachmentId]
          : { id: null, url: null, alt: null, width: null, height: null, path: null },
        mobileImage: imageMobileAttachmentId ? attachmentMap[imageMobileAttachmentId] : null,
        product,
        finalLink,
      };
    });

  write("sliders.json", sliders);
}

async function main() {
  console.log("Connecting to MariaDB on port 3307...");
  const db = await mysql.createConnection(DB);
  console.log("Connected. Starting extraction...\n");

  try {
    await extractCategories(db);
    await extractBrands(db);
    await extractBrandLogos(db);
    await extractProducts(db);
    await extractPages(db);
    await extractRedirects(db);
    await extractNavMenus(db);
    await extractSliders(db);
    console.log(`\nAll done. Output in: ${OUT_DIR}`);
  } finally {
    await db.end();
  }
}

main().catch((err) => {
  console.error("ETL failed:", err);
  process.exit(1);
});
