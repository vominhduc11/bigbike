#!/usr/bin/env python3
"""
generate_seo_redirect_map.py — Export redirects từ PostgreSQL sang SEO_REDIRECT_MAP.csv.

Output CSV có thể dùng để:
  - Cấu hình nginx map file
  - Upload lên CDN/Cloudflare redirect rules
  - Import vào Google Search Console change-of-address
  - Kiểm tra với crawler (Screaming Frog, Sitebulb)

Usage:
    python generate_seo_redirect_map.py [--output SEO_REDIRECT_MAP.csv] [--enabled-only]

Columns:
    source_pattern, target_url, status_code, source_type, enabled

Requires: psycopg2-binary, python-dotenv (optional)
"""

import argparse
import csv
import datetime
import os
import sys
from pathlib import Path

try:
    import psycopg2
except ImportError:
    sys.exit("psycopg2 not found. Run: pip install psycopg2-binary")

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent.parent.parent / ".env")
except ImportError:
    pass


def _get_conn():
    dsn = os.getenv("PG_DSN")
    if dsn:
        return psycopg2.connect(dsn)
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


def main():
    parser = argparse.ArgumentParser(description="Export redirect map to CSV")
    parser.add_argument("--output", default="SEO_REDIRECT_MAP.csv",
                        help="Output CSV file path (default: SEO_REDIRECT_MAP.csv)")
    parser.add_argument("--enabled-only", action="store_true", default=False,
                        help="Only export enabled=true redirects (default: export all)")
    args = parser.parse_args()

    output_path = Path(args.output)

    try:
        conn = _get_conn()
        conn.set_session(readonly=True, autocommit=True)
    except Exception as e:
        sys.exit(f"Cannot connect to PostgreSQL: {e}")

    where = "WHERE enabled = true" if args.enabled_only else ""

    query = f"""
        SELECT
            source_pattern,
            target_url,
            status_code,
            COALESCE(source_type, 'redirect') AS source_type,
            enabled,
            created_at
        FROM redirects
        {where}
        ORDER BY
            CASE status_code WHEN 301 THEN 1 WHEN 302 THEN 2 ELSE 3 END,
            source_pattern
    """  # noqa: S608

    with conn.cursor() as cur:
        try:
            cur.execute(query)
        except psycopg2.Error as e:
            # Try without source_type if column doesn't exist
            query_fallback = f"""
                SELECT source_pattern, target_url, status_code,
                       'redirect' AS source_type, enabled, created_at
                FROM redirects {where}
                ORDER BY source_pattern
            """  # noqa: S608
            print(f"[WARN] source_type column not found, using fallback: {e}")
            cur.execute(query_fallback)

        rows = cur.fetchall()

    conn.close()

    fieldnames = ["source_pattern", "target_url", "status_code",
                  "source_type", "enabled", "created_at"]

    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow({
                "source_pattern": row[0],
                "target_url": row[1],
                "status_code": row[2],
                "source_type": row[3],
                "enabled": row[4],
                "created_at": row[5].isoformat() if row[5] else "",
            })

    enabled_count = sum(1 for r in rows if r[4])
    disabled_count = len(rows) - enabled_count
    codes = {}
    for r in rows:
        codes[r[2]] = codes.get(r[2], 0) + 1

    print(f"✅ Exported {len(rows)} redirects → {output_path}")
    print(f"   Enabled: {enabled_count}  |  Disabled: {disabled_count}")
    print(f"   Status codes: {dict(sorted(codes.items()))}")
    print()
    print("Nginx map snippet (first 5):")
    print("  map $request_uri $redirect_uri {")
    for row in rows[:5]:
        print(f'    "{row[0]}"  "{row[1]}";')
    print("    ...")
    print("  }")
    print()
    print("To generate nginx map file:")
    print("  python generate_seo_redirect_map.py --enabled-only --output nginx_redirect.csv")
    print("  Then convert with: awk -F',' 'NR>1{print \"\\\"\"$1\"\\\"  \\\"\"$2\"\\\";\"}' nginx_redirect.csv")


if __name__ == "__main__":
    main()
