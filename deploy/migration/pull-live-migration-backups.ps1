#requires -Version 7.0
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[A-Za-z0-9._-]+$')]
    [string]$SnapshotId,

    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[A-Za-z0-9._:-]+$')]
    [string]$VpsHost,

    [ValidatePattern('^[A-Za-z0-9._-]+$')]
    [string]$VpsUser = 'root',
    [ValidateRange(1, 65535)]
    [int]$SshPort = 22,
    [string]$IdentityFile,

    [Parameter(Mandatory = $true)]
    [ValidatePattern('^/root/myproject/bigbike-migration/[A-Za-z0-9._/-]+\.sql\.gz$')]
    [string]$SourceDumpRemotePath,

    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[0-9a-f]{64}$')]
    [string]$ExpectedSourceDumpSha256,

    [ValidatePattern('^[A-Za-z0-9._-]+$')]
    [string]$TargetMediaBucket = 'bigbike-media',

    [string]$OneDriveRoot = 'C:\Users\vomin\OneDrive\Documents\BigBike-Migration',
    [switch]$VerifyOnly,
    [switch]$ConfirmOneDriveSynced
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$destination = Join-Path $OneDriveRoot $SnapshotId
New-Item -ItemType Directory -Force -Path $destination | Out-Null

function New-BaseProcessInfo {
    param([string]$FileName)
    $info = [System.Diagnostics.ProcessStartInfo]::new()
    $info.FileName = $FileName
    $info.UseShellExecute = $false
    $info.CreateNoWindow = $true
    $info.RedirectStandardOutput = $true
    $info.RedirectStandardError = $true
    return $info
}

function Add-SshTransportArguments {
    param([System.Diagnostics.ProcessStartInfo]$Info)
    $Info.ArgumentList.Add('-o')
    $Info.ArgumentList.Add('BatchMode=yes')
    $Info.ArgumentList.Add('-o')
    $Info.ArgumentList.Add('ServerAliveInterval=30')
    $Info.ArgumentList.Add('-p')
    $Info.ArgumentList.Add($SshPort.ToString())
    if ($IdentityFile) {
        $Info.ArgumentList.Add('-i')
        $Info.ArgumentList.Add($IdentityFile)
    }
}

function Invoke-SshBinaryStream {
    param(
        [Parameter(Mandatory = $true)][string]$RemoteCommand,
        [Parameter(Mandatory = $true)][string]$DestinationPath
    )
    $partial = "$DestinationPath.partial"
    $info = New-BaseProcessInfo -FileName 'ssh'
    Add-SshTransportArguments -Info $info
    $info.ArgumentList.Add("$VpsUser@$VpsHost")
    $encodedCommand = [Convert]::ToBase64String(
        [System.Text.Encoding]::UTF8.GetBytes($RemoteCommand))
    $info.ArgumentList.Add("printf '%s' '$encodedCommand' | base64 -d | LC_ALL=C bash")
    $process = [System.Diagnostics.Process]::new()
    $process.StartInfo = $info
    if (-not $process.Start()) { throw "Cannot start ssh for $DestinationPath" }
    $stderrTask = $process.StandardError.ReadToEndAsync()
    try {
        $file = [System.IO.File]::Open(
            $partial,
            [System.IO.FileMode]::Create,
            [System.IO.FileAccess]::Write,
            [System.IO.FileShare]::None)
        try {
            $process.StandardOutput.BaseStream.CopyTo($file)
        } finally {
            $file.Dispose()
        }
        $process.WaitForExit()
        $stderr = $stderrTask.GetAwaiter().GetResult()
        if ($process.ExitCode -ne 0) {
            throw "ssh stream failed with exit $($process.ExitCode): $stderr"
        }
        Move-Item -Path $partial -Destination $DestinationPath
    } finally {
        $process.Dispose()
    }
}

function Invoke-ScpExistingFile {
    param(
        [Parameter(Mandatory = $true)][string]$RemotePath,
        [Parameter(Mandatory = $true)][string]$DestinationPath
    )
    $partial = "$DestinationPath.partial"
    $info = New-BaseProcessInfo -FileName 'scp'
    $info.ArgumentList.Add('-o')
    $info.ArgumentList.Add('BatchMode=yes')
    $info.ArgumentList.Add('-P')
    $info.ArgumentList.Add($SshPort.ToString())
    if ($IdentityFile) {
        $info.ArgumentList.Add('-i')
        $info.ArgumentList.Add($IdentityFile)
    }
    $info.ArgumentList.Add("${VpsUser}@${VpsHost}:$RemotePath")
    $info.ArgumentList.Add($partial)
    $process = [System.Diagnostics.Process]::new()
    $process.StartInfo = $info
    if (-not $process.Start()) { throw "Cannot start scp for $RemotePath" }
    $stdoutTask = $process.StandardOutput.ReadToEndAsync()
    $stderrTask = $process.StandardError.ReadToEndAsync()
    $process.WaitForExit()
    $stdout = $stdoutTask.GetAwaiter().GetResult()
    $stderr = $stderrTask.GetAwaiter().GetResult()
    $exitCode = $process.ExitCode
    $process.Dispose()
    if ($exitCode -ne 0) {
        throw "scp failed with exit ${exitCode}: $stdout $stderr"
    }
    Move-Item -Path $partial -Destination $DestinationPath
}

function Test-GzipReadable {
    param([Parameter(Mandatory = $true)][string]$Path)
    $input = [System.IO.File]::OpenRead($Path)
    try {
        $gzip = [System.IO.Compression.GZipStream]::new(
            $input, [System.IO.Compression.CompressionMode]::Decompress)
        try {
            $buffer = [byte[]]::new(1MB)
            [long]$total = 0
            while (($read = $gzip.Read($buffer, 0, $buffer.Length)) -gt 0) {
                $total += $read
            }
            if ($total -le 0) { throw "Gzip payload is empty: $Path" }
        } finally {
            $gzip.Dispose()
        }
    } finally {
        $input.Dispose()
    }
    return $true
}

function Test-TarGzipReadable {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$ExpectedEntry
    )
    $info = New-BaseProcessInfo -FileName 'tar'
    $info.ArgumentList.Add('-tzf')
    $info.ArgumentList.Add($Path)
    $process = [System.Diagnostics.Process]::new()
    $process.StartInfo = $info
    if (-not $process.Start()) { throw "Cannot start tar verification for $Path" }
    $stdoutTask = $process.StandardOutput.ReadToEndAsync()
    $stderrTask = $process.StandardError.ReadToEndAsync()
    $process.WaitForExit()
    $entries = $stdoutTask.GetAwaiter().GetResult()
    $stderr = $stderrTask.GetAwaiter().GetResult()
    $exitCode = $process.ExitCode
    $process.Dispose()
    if ($exitCode -ne 0) { throw "tar verification failed: $stderr" }
    if (-not $entries.Contains($ExpectedEntry)) {
        throw "Archive $Path does not contain required entry $ExpectedEntry"
    }
    return $true
}

function Test-JsonLinesGzipReadable {
    param([Parameter(Mandatory = $true)][string]$Path)
    $input = [System.IO.File]::OpenRead($Path)
    try {
        $gzip = [System.IO.Compression.GZipStream]::new(
            $input, [System.IO.Compression.CompressionMode]::Decompress)
        try {
            $reader = [System.IO.StreamReader]::new($gzip, [System.Text.Encoding]::UTF8)
            try {
                [int]$lines = 0
                while (($line = $reader.ReadLine()) -ne $null) {
                    if ([string]::IsNullOrWhiteSpace($line)) { continue }
                    $document = [System.Text.Json.JsonDocument]::Parse($line)
                    $document.Dispose()
                    $lines++
                }
                if ($lines -lt 2) { throw "Media metadata JSONL is incomplete: $Path" }
            } finally {
                $reader.Dispose()
            }
        } finally {
            $gzip.Dispose()
        }
    } finally {
        $input.Dispose()
    }
    return $true
}

$files = [ordered]@{
    SOURCE_DATABASE      = Join-Path $destination 'source-database.sql.gz'
    SOURCE_UPLOADS       = Join-Path $destination 'source-uploads.tar.gz'
    TARGET_DATABASE      = Join-Path $destination 'target-database.sql.gz'
    TARGET_MEDIA_METADATA = Join-Path $destination 'target-media-metadata.jsonl.gz'
    NGINX_CONFIG         = Join-Path $destination 'nginx-config.tar.gz'
    DEPLOYMENT_CONFIG    = Join-Path $destination 'deployment-config.tar.gz'
}

if (-not $VerifyOnly) {
    foreach ($entry in $files.GetEnumerator()) {
        if (Test-Path -LiteralPath $entry.Value) {
            throw "Refusing to overwrite existing backup artifact: $($entry.Value). Use a new SnapshotId or -VerifyOnly."
        }
    }
    Invoke-ScpExistingFile -RemotePath $SourceDumpRemotePath -DestinationPath $files.SOURCE_DATABASE
    Invoke-SshBinaryStream -DestinationPath $files.SOURCE_UPLOADS -RemoteCommand 'set -euo pipefail; tar -C /root/myproject/bigbike-wp-legacy/files/wp-content -czf - uploads'

    $targetDatabaseCommand = @'
set -euo pipefail
docker exec bigbike-postgres sh -lc 'PGPASSWORD="$POSTGRES_PASSWORD" pg_dump --clean --if-exists --no-owner --no-acl --format=plain --username="$POSTGRES_USER" "$POSTGRES_DB"' | gzip -c
'@
    Invoke-SshBinaryStream -DestinationPath $files.TARGET_DATABASE -RemoteCommand $targetDatabaseCommand

    $mediaCommandTemplate = @'
set -euo pipefail
{
  printf '%s\n' '{"recordType":"section","name":"target_media_table"}'
  docker exec bigbike-postgres sh -lc 'PGPASSWORD="$POSTGRES_PASSWORD" psql --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" --no-align --tuples-only --command="select json_build_object('"'"'recordType'"'"','"'"'database_media'"'"','"'"'data'"'"',row_to_json(m))::text from media m order by id"'
  printf '%s\n' '{"recordType":"section","name":"minio_inventory"}'
  docker exec bigbike-minio sh -lc 'mc alias set local http://127.0.0.1:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null; mc ls --recursive --json local/__TARGET_MEDIA_BUCKET__'
} | gzip -c
'@
    $mediaCommand = $mediaCommandTemplate.Replace('__TARGET_MEDIA_BUCKET__', $TargetMediaBucket)
    Invoke-SshBinaryStream -DestinationPath $files.TARGET_MEDIA_METADATA -RemoteCommand $mediaCommand

    Invoke-SshBinaryStream -DestinationPath $files.NGINX_CONFIG -RemoteCommand 'set -euo pipefail; tar -C / -czf - etc/nginx/nginx.conf etc/nginx/conf.d etc/nginx/sites-available etc/nginx/sites-enabled'
    Invoke-SshBinaryStream -DestinationPath $files.DEPLOYMENT_CONFIG -RemoteCommand 'set -euo pipefail; tar -C /root/myproject/bigbike -czf - docker-compose.yaml .env.vps deploy bigbike-backend/Dockerfile bigbike-web/Dockerfile bigbike-admin/Dockerfile bigbike-admin/nginx.conf'
}

foreach ($entry in $files.GetEnumerator()) {
    if (-not (Test-Path -LiteralPath $entry.Value -PathType Leaf)) {
        throw "Missing required local artifact: $($entry.Key)"
    }
}

$archiveChecks = [ordered]@{}
$archiveChecks.SOURCE_DATABASE = Test-GzipReadable -Path $files.SOURCE_DATABASE
$archiveChecks.SOURCE_UPLOADS = Test-TarGzipReadable -Path $files.SOURCE_UPLOADS -ExpectedEntry 'uploads/'
$archiveChecks.TARGET_DATABASE = Test-GzipReadable -Path $files.TARGET_DATABASE
$archiveChecks.TARGET_MEDIA_METADATA = Test-JsonLinesGzipReadable -Path $files.TARGET_MEDIA_METADATA
$archiveChecks.NGINX_CONFIG = Test-TarGzipReadable -Path $files.NGINX_CONFIG -ExpectedEntry 'etc/nginx/nginx.conf'
$archiveChecks.DEPLOYMENT_CONFIG = Test-TarGzipReadable -Path $files.DEPLOYMENT_CONFIG -ExpectedEntry 'docker-compose.yaml'

$sourceHash = (Get-FileHash -LiteralPath $files.SOURCE_DATABASE -Algorithm SHA256).Hash.ToLowerInvariant()
if ($sourceHash -ne $ExpectedSourceDumpSha256) {
    throw "SOURCE_DATABASE SHA-256 does not equal the final preflight dump hash"
}

$verifiedAt = [DateTimeOffset]::UtcNow
$retentionUntil = $verifiedAt.AddDays(31)
$artifacts = @()
foreach ($entry in $files.GetEnumerator()) {
    $file = Get-Item -LiteralPath $entry.Value
    $hash = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
    $artifacts += [ordered]@{
        kind = $entry.Key
        fileName = $file.Name
        bytes = $file.Length
        sha256 = $hash
        archiveReadable = [bool]$archiveChecks[$entry.Key]
        location = "onedrive://Documents/BigBike-Migration/$SnapshotId/$($file.Name)"
        verifiedReadable = [bool]($archiveChecks[$entry.Key] -and $ConfirmOneDriveSynced)
    }
}

$result = [ordered]@{
    version = 1
    snapshotId = $SnapshotId
    verifiedReadableAt = $verifiedAt.ToString('o')
    sourceDumpSha256 = $sourceHash
    oneDriveSyncConfirmedByOwner = [bool]$ConfirmOneDriveSynced
    retentionUntil = $retentionUntil.ToString('o')
    artifacts = $artifacts
}
$resultPath = Join-Path $destination 'offsite-backup-verification.json'
$result | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $resultPath -Encoding utf8NoBOM

if (-not $ConfirmOneDriveSynced) {
    Write-Warning 'Local hashes/readability passed, but OneDrive sync/read-back is NOT confirmed.'
    Write-Host 'After OneDrive finishes syncing and the files can be opened/read again, rerun with -VerifyOnly -ConfirmOneDriveSynced.'
} else {
    Write-Host 'Owner attested OneDrive sync/read-back; verification metadata is ready for VPS manifest validation.'
}
Write-Host "Verification result: $resultPath"
