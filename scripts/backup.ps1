# =============================================================================
# RepREs Database Backup Script
# Runs pg_dump inside the Docker container and saves a timestamped .sql file.
# Keeps the last 7 daily backups (older ones are pruned automatically).
# =============================================================================

$BACKUP_DIR    = "C:\Backups\RepREs"
$CONTAINER     = "repres-db-1"
$DB_NAME       = "repres_db"
$DB_USER       = "repres"
$RETAIN_DAYS   = 7

# --- Timestamp & filename ---------------------------------------------------
$timestamp  = Get-Date -Format "yyyy-MM-dd_HH-mm"
$backupFile = Join-Path $BACKUP_DIR "repres_$timestamp.sql"
$logFile    = Join-Path $BACKUP_DIR "backup.log"

function Log($msg) {
    $line = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $msg"
    Write-Host $line
    Add-Content -Path $logFile -Value $line
}

# --- Ensure backup directory exists -----------------------------------------
if (-not (Test-Path $BACKUP_DIR)) {
    New-Item -ItemType Directory -Path $BACKUP_DIR -Force | Out-Null
    Log "Created backup directory: $BACKUP_DIR"
}

# --- Check Docker is running -------------------------------------------------
$dockerRunning = docker ps --filter "name=$CONTAINER" --filter "status=running" -q 2>$null
if (-not $dockerRunning) {
    Log "ERROR: Container '$CONTAINER' is not running. Backup aborted."
    exit 1
}

# --- Run pg_dump inside the container ----------------------------------------
Log "Starting backup -> $backupFile"

docker exec $CONTAINER pg_dump -U $DB_USER -d $DB_NAME --no-password | Out-File -FilePath $backupFile -Encoding utf8

if ($LASTEXITCODE -ne 0 -or -not (Test-Path $backupFile) -or (Get-Item $backupFile).Length -lt 100) {
    Log "ERROR: pg_dump failed or produced an empty file. Backup aborted."
    if (Test-Path $backupFile) { Remove-Item $backupFile }
    exit 1
}

$sizeMB = [math]::Round((Get-Item $backupFile).Length / 1MB, 2)
Log "Backup complete. Size: ${sizeMB} MB -> $backupFile"

# --- Prune old backups (keep last $RETAIN_DAYS days) -------------------------
$cutoff = (Get-Date).AddDays(-$RETAIN_DAYS)
$pruned = 0
Get-ChildItem -Path $BACKUP_DIR -Filter "repres_*.sql" |
    Where-Object { $_.LastWriteTime -lt $cutoff } |
    ForEach-Object {
        Remove-Item $_.FullName
        Log "Pruned old backup: $($_.Name)"
        $pruned++
    }

if ($pruned -eq 0) {
    Log "No old backups to prune."
} else {
    Log "Pruned $pruned old backup(s)."
}

# --- Summary -----------------------------------------------------------------
$remaining = (Get-ChildItem -Path $BACKUP_DIR -Filter "repres_*.sql").Count
Log "Done. $remaining backup(s) on disk."
