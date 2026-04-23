#!/usr/bin/env python3
"""
validate_migration.py - Post-import integrity check for BigBike WordPress migration.

Connects to the local PostgreSQL instance and runs:
  1. Row count checks (vs expected counts from dump analysis)
  2. Referential integrity checks (FK orphans)
  3. Data quality checks (null slugs, duplicate emails, price sanity)
  4. Spot-check samples (print 5 rows per domain for manual review)

Usage:
    pip install psycopg2-binary python-dotenv
    python validate_migration.py

Environment variables (or .env in project root):
    BIGBIKE_DB_URL      jdbc:postgresql://localhost:5432/bigbike  (or PG_DSN below)
    PG_DSN              postgresql://bigbike:bigbike_dev_only@localhost:5432/bigbike
    PG_HOST             localhost
    PG_PORT             5432
    PG_DB               bigbike
    PG_USER             bigbike
    PG_PASSWORD         bigbike_dev_only
"""

import os
import sys
import datetime
import textwrap
from pathlib import Path

try:
    import psycopg2
    import psycopg2.extras
except ImportError:
    sys.exit("psycopg2 not found. Run: pip install psycopg2-binary")

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent.parent.parent / ".env")
except ImportError:
    pass  # python-dotenv optional

# ---------------------------------------------------------------------------
# DB connection
# ---------------------------------------------------------------------------

def _get_conn():
    dsn = os.getenv("PG_DSN")
    if dsn:
        return psycopg2.connect(dsn)
    # Try to parse BIGBIKE_DB_URL (jdbc:postgresql://host:port/db)
    jdbc = os.getenv("BIGBIKE_DB_URL", "")
    if jdbc.startswith("jdbc:postgresql://"):
        jdbc_clean = jdbc[len("jdbc:postgresql://"):]
        host_port, db = jdbc_clean.split("/", 1)
        host, port = (host_port.split(":") + ["5432"])[:2]
        return psycopg2.connect(
            host=host, port=int(port), dbname=db,
            user=os.getenv("BIGBIKE_DB_USERNAME", os.getenv("PG_USER", "bigbike")),
            password=os.getenv("BIGBIKE_DB_PASSWORD", os.getenv("PG_PASSWORD", "bigbike_dev_only")),
        )
    return psycopg2.connect(
        host=os.getenv("PG_HOST", "localhost"),
        port=int(os.getenv("PG_PORT", "5432")),
        dbname=os.getenv("PG_DB", "bigbike"),
        user=os.getenv("PG_USER", "bigbike"),
        password=os.getenv("PG_PASSWORD", "bigbike_dev_only"),
    )


# ---------------------------------------------------------------------------
# Expected counts (from Phase 2D.3 rehearsal - adjust after each run)
# ---------------------------------------------------------------------------
EXPECTED = {
    "categories":          {"min": 50,   "max": 60},     # 50 WP + seed dev rows
    "brands":              {"min": 44,   "max": 50},     # 45 WP + seed dev rows
    "products":            {"min": 1215, "max": 1225},   # 1217 WP + seed dev rows
    "product_variants":    {"min": 4000, "max": 4025},   # 4015 WP + seed dev rows
    "media":               {"min": 12050,"max": 12060},  # 12054
    "pages":               {"min": 22,   "max": 25},     # 22 WP + seed dev rows
    "articles":            {"min": 167,  "max": 180},    # 169 WP + seed dev rows
    "menus":               {"min": 3,    "max": 8},      # 3 WP + seed dev rows
    "menu_items":          {"min": 46,   "max": 50},     # 46 WP + seed dev rows
    "redirects":           {"min": 40,   "max": 25000},  # 40 RankMath min; up to 20800+ with FG+fallback
    "customers":           {"min": 1920, "max": 1940},   # 1929
    "orders":              {"min": 1050, "max": 1070},   # 1061
    "order_line_items":    {"min": 1300, "max": 1320},   # 1309
    "order_shipping_items":{"min": 830,  "max": 840},    # 834
    "payments":            {"min": 1050, "max": 1070},   # 1061
    "coupons":             {"min": 1,    "max": 5},      # 1 WP + seed dev rows
    "product_tags":        {"min": 5740, "max": 5750},   # 5743 (5744 collected - 1 over-length)
    "reviews":             {"min": 0,    "max": 5},      # 0 — WP site had no product reviews
}

# ---------------------------------------------------------------------------
# Check functions
# ---------------------------------------------------------------------------

PASS = "[PASS]"
FAIL = "[FAIL]"
WARN = "[WARN]"
INFO = "[INFO]"


import io, sys
if sys.stdout.encoding != 'utf-8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

results = []


def _log(status, message):
    line = f"{status}  {message}"
    results.append(line)
    print(line, flush=True)


def check_counts(cur):
    print("\n=== 1. ROW COUNT CHECKS ===")
    for table, bounds in EXPECTED.items():
        try:
            cur.execute(f"SELECT COUNT(*) FROM {table}")  # noqa: S608
            count = cur.fetchone()[0]
            ok = bounds["min"] <= count <= bounds["max"]
            status = PASS if ok else FAIL
            _log(status, f"{table}: {count} (expected {bounds['min']}-{bounds['max']})")
        except psycopg2.Error as e:
            _log(FAIL, f"{table}: query failed - {e}")


def check_integrity(cur):
    print("\n=== 2. REFERENTIAL INTEGRITY ===")

    checks = [
        ("products.image_id -> media (UUID rows only)",
         "SELECT COUNT(*) FROM products p "
         "WHERE p.image_id IS NOT NULL "
         "AND p.image_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' "
         "AND NOT EXISTS (SELECT 1 FROM media m WHERE m.id = p.image_id::uuid)"),

        ("product_variants.product_id -> products",
         "SELECT COUNT(*) FROM product_variants pv "
         "WHERE NOT EXISTS (SELECT 1 FROM products p WHERE p.id = pv.product_id)"),

        ("orders.customer_id -> customers (nullable)",
         "SELECT COUNT(*) FROM orders o "
         "WHERE o.customer_id IS NOT NULL "
         "AND NOT EXISTS (SELECT 1 FROM customers c WHERE c.id = o.customer_id)"),

        ("order_line_items.order_id -> orders",
         "SELECT COUNT(*) FROM order_line_items li "
         "WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.id = li.order_id)"),

        ("order_shipping_items.order_id -> orders",
         "SELECT COUNT(*) FROM order_shipping_items si "
         "WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.id = si.order_id)"),

        ("menu_items.menu_id -> menus",
         "SELECT COUNT(*) FROM menu_items mi "
         "WHERE NOT EXISTS (SELECT 1 FROM menus m WHERE m.id = mi.menu_id)"),

        ("product_tags.product_id -> products",
         "SELECT COUNT(*) FROM product_tags pt "
         "WHERE NOT EXISTS (SELECT 1 FROM products p WHERE p.id = pt.product_id)"),

        ("reviews.product_id -> products",
         "SELECT COUNT(*) FROM reviews r "
         "WHERE NOT EXISTS (SELECT 1 FROM products p WHERE p.id = r.product_id)"),
    ]

    for name, sql in checks:
        try:
            cur.execute(sql)
            orphans = cur.fetchone()[0]
            status = PASS if orphans == 0 else FAIL
            _log(status, f"{name}: {orphans} orphan(s)")
        except psycopg2.Error as e:
            _log(WARN, f"{name}: query failed - {e}")


def check_quality(cur):
    print("\n=== 3. DATA QUALITY ===")

    quality_checks = [
        ("products: null or blank slug",
         "SELECT COUNT(*) FROM products WHERE slug IS NULL OR slug = ''",
         0, FAIL),

        ("products: duplicate slug",
         "SELECT COUNT(*) FROM (SELECT slug FROM products GROUP BY slug HAVING COUNT(*) > 1) t",
         0, FAIL),

        ("products: null retail_price",
         "SELECT COUNT(*) FROM products WHERE retail_price IS NULL",
         None, INFO),

        ("products: negative retail_price",
         "SELECT COUNT(*) FROM products WHERE retail_price < 0",
         0, FAIL),

        ("categories: null or blank slug",
         "SELECT COUNT(*) FROM categories WHERE slug IS NULL OR slug = ''",
         0, FAIL),

        ("brands: null or blank slug",
         "SELECT COUNT(*) FROM brands WHERE slug IS NULL OR slug = ''",
         0, FAIL),

        ("customers: duplicate email (non-null)",
         "SELECT COUNT(*) FROM (SELECT email FROM customers WHERE email IS NOT NULL AND email != '' GROUP BY email HAVING COUNT(*) > 1) t",
         0, FAIL),

        ("media: null file_path",
         "SELECT COUNT(*) FROM media WHERE file_path IS NULL OR file_path = ''",
         None, INFO),

        ("redirects: self-loop (source=target)",
         "SELECT COUNT(*) FROM redirects WHERE source_pattern = target_url",
         0, FAIL),

        ("redirects: duplicate enabled source",
         "SELECT COUNT(*) FROM (SELECT source_pattern FROM redirects WHERE enabled=true GROUP BY source_pattern HAVING COUNT(*) > 1) t",
         0, FAIL),

        ("orders: null order_number",
         "SELECT COUNT(*) FROM orders WHERE order_number IS NULL OR order_number = ''",
         0, FAIL),

        ("reviews: rating out of 1-5 range",
         "SELECT COUNT(*) FROM reviews WHERE rating < 1 OR rating > 5",
         0, FAIL),

        ("product_tags: blank tag",
         "SELECT COUNT(*) FROM product_tags WHERE tag IS NULL OR tag = ''",
         0, FAIL),
    ]

    for name, sql, expected_zero, fail_level in quality_checks:
        try:
            cur.execute(sql)
            count = cur.fetchone()[0]
            if expected_zero is None:
                _log(INFO, f"{name}: {count}")
            elif count == expected_zero:
                _log(PASS, f"{name}: {count}")
            else:
                _log(fail_level, f"{name}: {count} (expected {expected_zero})")
        except psycopg2.Error as e:
            _log(WARN, f"{name}: query failed - {e}")


def check_spot_samples(cur):
    print("\n=== 4. SPOT SAMPLES (5 rows each) ===")

    samples = {
        "products (name, slug, price)":
            "SELECT name, slug, retail_price FROM products ORDER BY RANDOM() LIMIT 5",
        "customers (email, first_name, created_at)":
            "SELECT email, first_name, created_at FROM customers ORDER BY RANDOM() LIMIT 5",
        "orders (order_number, status, total_amount, created_at)":
            "SELECT order_number, status, total_amount, created_at FROM orders ORDER BY RANDOM() LIMIT 5",
        "redirects (source_pattern, target_url, status_code)":
            "SELECT source_pattern, target_url, status_code FROM redirects LIMIT 5",
        "articles (slug, title, published_at)":
            "SELECT slug, title, published_at FROM articles ORDER BY RANDOM() LIMIT 5",
        "product_tags (product_id, tag)":
            "SELECT product_id, tag FROM product_tags ORDER BY RANDOM() LIMIT 5",
    }

    for label, sql in samples.items():
        print(f"\n  >> {label}")
        try:
            cur.execute(sql)
            rows = cur.fetchall()
            col_names = [desc[0] for desc in cur.description]
            print(f"     {' | '.join(col_names)}")
            print(f"     {'-' * 60}")
            for row in rows:
                print(f"     {' | '.join(str(v)[:30] for v in row)}")
        except psycopg2.Error as e:
            print(f"     [query failed: {e}]")


def check_media_storage(cur):
    print("\n=== 5. MEDIA STORAGE STATUS ===")
    try:
        cur.execute(
            "SELECT storage_provider, COUNT(*) FROM media GROUP BY storage_provider ORDER BY COUNT(*) DESC"
        )
        rows = cur.fetchall()
        for provider, cnt in rows:
            note = "(files still on WP server - run Phase 5 media copy)" if provider == "LEGACY_WP" else ""
            _log(INFO, f"media.storage_provider={provider}: {cnt} {note}")
    except psycopg2.Error as e:
        _log(WARN, f"media storage check failed: {e}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    log_dir = Path(__file__).parent / "logs"
    log_dir.mkdir(exist_ok=True)
    log_file = log_dir / f"validation-{datetime.date.today()}.txt"

    print("=" * 70)
    print("BigBike Migration Validation")
    print(f"Timestamp: {datetime.datetime.now().isoformat()}")
    print("=" * 70)

    try:
        conn = _get_conn()
        conn.set_session(readonly=True, autocommit=True)
    except Exception as e:
        sys.exit(f"Cannot connect to PostgreSQL: {e}\n"
                 "Set PG_DSN or BIGBIKE_DB_URL / PG_HOST / PG_USER / PG_PASSWORD.")

    with conn.cursor() as cur:
        check_counts(cur)
        check_integrity(cur)
        check_quality(cur)
        check_media_storage(cur)
        check_spot_samples(cur)

    conn.close()

    # Summary
    failures = [r for r in results if r.startswith("[FAIL]")]
    warnings = [r for r in results if r.startswith("[WARN]")]

    print("\n" + "=" * 70)
    print(f"SUMMARY: {len(results)} checks -- "
          f"{len(failures)} FAIL, {len(warnings)} WARN, "
          f"{len(results) - len(failures) - len(warnings)} PASS/INFO")
    if failures:
        print("\nFAILURES:")
        for f in failures:
            print(f"  {f}")
    print("=" * 70)

    # Write log file
    with open(log_file, "w", encoding="utf-8") as f:
        f.write(f"BigBike Migration Validation - {datetime.datetime.now().isoformat()}\n\n")
        f.write("\n".join(results))
        f.write(f"\n\nSUMMARY: {len(failures)} FAIL, {len(warnings)} WARN\n")
    print(f"\nLog written: {log_file}")

    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
