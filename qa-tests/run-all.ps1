# BigBike QA — one-command runner (PowerShell).
# Runs: (1) live black-box suite against the running docker stack, (2) the new JUnit gap tests
# in an ephemeral Maven container. Requires the docker stack to be UP (docker compose up -d).
$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot

Write-Host "`n=== [1/2] Live black-box suite (vs http://localhost:8080) ===" -ForegroundColor Cyan
Push-Location $root
node qa-tests/live/run.mjs
$liveExit = $LASTEXITCODE
Pop-Location

Write-Host "`n=== [2/2] New JUnit gap tests (ephemeral Maven container) ===" -ForegroundColor Cyan
docker run --rm `
  -v "$root\bigbike-backend:/build" `
  -v bigbike_qa_m2:/root/.m2 `
  -w /build maven:3.9-eclipse-temurin-17 `
  mvn -B -DfailIfNoTests=false "-Dtest=com.bigbike.bigbike_backend.qa.*" test
$junitExit = $LASTEXITCODE

Write-Host "`n=== DONE — live exit=$liveExit, junit exit=$junitExit ===" -ForegroundColor Green
Write-Host "Live results: qa-tests/.artifacts/live-results.json"
Write-Host "Report: TEST_REPORT.md"
