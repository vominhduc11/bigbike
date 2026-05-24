# =============================================================================
# BigBike Product Data Audit & Fill - Master Script
# Usage:
#   .\run.ps1                      # dry-run only (safe, no changes)
#   .\run.ps1 -Mode apply          # create backup, audit, fill, verify
#   .\run.ps1 -Mode apply -SkipBackup  # skip backup (faster, use when re-running)
# =============================================================================

param(
  [ValidateSet('dry-run', 'apply')]
  [string]$Mode = 'dry-run',
  [switch]$SkipBackup
)

$ErrorActionPreference = 'Stop'
$ScriptDir = $PSScriptRoot
$ProjectRoot = Resolve-Path (Join-Path $ScriptDir '..\..')

function Invoke-Psql {
  param([string]$SqlFile)
  $content = Get-Content $SqlFile -Raw -Encoding UTF8
  $content | docker exec -i bigbike-postgres psql -U bigbike -d bigbike
  if ($LASTEXITCODE -ne 0) {
    throw "psql failed for $SqlFile (exit code $LASTEXITCODE)"
  }
}

Write-Host ""
Write-Host "============================================================"
Write-Host "BigBike Product Data Audit & Fill"
Write-Host "Mode: $Mode | $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Host "============================================================"

# Step 0: Verify Docker container is running
Write-Host ""
Write-Host "[0] Checking Docker container..."
$running = docker ps --filter "name=bigbike-postgres" --filter "status=running" -q
if (-not $running) {
  Write-Error "bigbike-postgres is not running. Start it with: docker compose up -d postgres"
  exit 1
}
Write-Host "    bigbike-postgres is running."

# Step 1: Backup (only in apply mode, unless skipped)
if ($Mode -eq 'apply' -and -not $SkipBackup) {
  Write-Host ""
  Write-Host "[1] Creating backup..."
  $ts = Get-Date -Format "yyyyMMdd-HHmmss"
  $backupDir = Join-Path $ProjectRoot "backups\product-data-audit"
  New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
  $backupPath = Join-Path $backupDir "$ts-before-fill.sql"

  docker exec bigbike-postgres pg_dump -U bigbike -d bigbike `
    --no-owner --no-acl `
    -t products -t product_variants -t product_gallery_images `
    -t product_variant_gallery_images -t product_videos `
    -t product_specifications -t product_faqs `
    -t product_tags -t product_tag_map -t product_related_product_map `
    -t brands -t categories -t media `
    -t attributes -t attribute_values -t reviews `
    > $backupPath

  $sizeMb = [math]::Round((Get-Item $backupPath).Length / 1MB, 2)
  Write-Host "    Backup: $backupPath ($sizeMb MB)"
  Write-Host ""
  Write-Host "    Rollback command:"
  Write-Host "    Get-Content '$backupPath' | docker exec -i bigbike-postgres psql -U bigbike -d bigbike"
} elseif ($Mode -eq 'apply' -and $SkipBackup) {
  Write-Host ""
  Write-Host "[1] Skipping backup (-SkipBackup flag set)"
} else {
  Write-Host ""
  Write-Host "[1] Skipping backup (dry-run mode)"
}

# Step 2: Audit (read-only)
Write-Host ""
Write-Host "[2] Running audit (read-only)..."
Invoke-Psql (Join-Path $ScriptDir 'audit.sql')

# Step 3: Dry-run preview
Write-Host ""
Write-Host "[3] Running fill dry-run (preview only)..."
Invoke-Psql (Join-Path $ScriptDir 'fill-dry-run.sql')

if ($Mode -eq 'dry-run') {
  Write-Host ""
  Write-Host "============================================================"
  Write-Host "DRY-RUN COMPLETE. No changes were made."
  Write-Host "To apply changes: .\run.ps1 -Mode apply"
  Write-Host "============================================================"
  exit 0
}

# Step 4: Apply
Write-Host ""
Write-Host "[4] Applying fill (in transaction)..."
Invoke-Psql (Join-Path $ScriptDir 'fill-apply.sql')

# Step 5: Verify
Write-Host ""
Write-Host "[5] Running verification..."
Invoke-Psql (Join-Path $ScriptDir 'verify.sql')

Write-Host ""
Write-Host "============================================================"
Write-Host "APPLY COMPLETE."
Write-Host "See docs/audits/PRODUCT_DATA_COMPLETENESS_AUDIT.md for report."
Write-Host "============================================================"
