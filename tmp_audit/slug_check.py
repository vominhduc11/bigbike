"""Check that WP slugs exist in staging products/articles or have a redirect."""
import json
import subprocess
from pathlib import Path

OUT = Path(r"s:\project\bigbike\tmp_audit")
data = json.load(open(OUT / 'audit_data.json', encoding='utf-8'))


def psql(sql: str) -> str:
    r = subprocess.run(
        ['docker', 'exec', 'bigbike-postgres', 'psql', '-U', 'bigbike', '-d', 'bigbike',
         '-At', '-F', '\t', '-c', sql],
        capture_output=True, text=True, encoding='utf-8'
    )
    return r.stdout.strip()


# 1) 50 product slugs
sample_50 = data['sample_product_slugs']
in_clause = ','.join(f"'{s}'" for s in sample_50)
got = psql(f"SELECT slug FROM products WHERE slug IN ({in_clause});").splitlines()
in_staging = set(got)
missing_in_staging = [s for s in sample_50 if s not in in_staging]
print(f"=== 50 product slugs: {len(sample_50)-len(missing_in_staging)}/{len(sample_50)} present in products ===")
print(f"Missing slugs: {len(missing_in_staging)}")
for s in missing_in_staging[:20]:
    print(f"  {s}")

# Check redirects for missing
if missing_in_staging:
    miss_clause = ','.join(f"'/{s}.html','/{s}','{s}'" for s in missing_in_staging)
    # look up redirect by source_pattern containing the slug
    redirect_q = "SELECT source_pattern, target_url FROM redirects WHERE " + \
        " OR ".join(f"source_pattern LIKE '%{s}%'" for s in missing_in_staging)
    if missing_in_staging:
        sample_r = psql(redirect_q)
        print(f"\nRedirects matching missing slugs:")
        print(sample_r[:2000])

# 2) Top 20 view product slugs
top20 = data['top_view_product_slugs']
print(f"\n=== Top-view 20 slugs (note: WP _product_views meta absent so this is alphabetical first-20) ===")
in_clause = ','.join(f"'{s}'" for s in top20)
got_top = psql(f"SELECT slug, retail_price, image_url, category_id FROM products WHERE slug IN ({in_clause});")
print(got_top)

# 3) 20 article slugs
top_articles = data['top_article_slugs']
in_clause = ','.join(f"'{s}'" for s in top_articles)
got_a = psql(f"SELECT slug FROM articles WHERE slug IN ({in_clause});").splitlines()
miss_a = [s for s in top_articles if s not in set(got_a)]
print(f"\n=== Top-20 article slugs: {len(top_articles)-len(miss_a)}/{len(top_articles)} present ===")
for s in miss_a:
    print(f"  missing: {s}")

# Save results
result = {
    'product_slugs_checked': len(sample_50),
    'product_slugs_in_staging': len(sample_50) - len(missing_in_staging),
    'product_slugs_missing': missing_in_staging,
    'article_slugs_checked': len(top_articles),
    'article_slugs_in_staging': len(top_articles) - len(miss_a),
    'article_slugs_missing': miss_a,
    'top20_view_lookup': got_top.splitlines(),
}
with open(OUT / 'slug_check.json', 'w', encoding='utf-8') as f:
    json.dump(result, f, ensure_ascii=False, indent=2)
