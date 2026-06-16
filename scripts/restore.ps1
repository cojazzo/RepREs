# =============================================================================
# RepREs Database Restore Script
# Usage: .\restore.ps1                         <- restores the latest backup
#        .\restore.ps1 -BackupFile "path\to\repres_2026-06-12_02-00.sql"
# =============================================================================

param(
    [string]$BackupFile = ""
)

$BACKUP_DIR  = "C:\Backups\RepREs"
$CONTAINER   = "repres-db-1"
$DB_NAME     = "repres_db"
$DB_USER     = "repres"

function Log($msg) {
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] $msg"
}

# --- Resolve which file to restore ------------------------------------------
if ($BackupFile -eq "") {
    $latest = Get-ChildItem -Path $BACKUP_DIR -Filter "repres_*.sql" |
              Sort-Object LastWriteTime -Descending |
              Select-Object -First 1

    if (-not $latest) {
        Log "ERROR: No backup files found in $BACKUP_DIR"
        exit 1
    }
    $BackupFile = $latest.FullName
    Log "No file specified. Using latest: $($latest.Name)"
}

if (-not (Test-Path $BackupFile)) {
    Log "ERROR: File not found: $BackupFile"
    exit 1
}

# --- Safety confirmation ----------------------------------------------------
Write-Host ""
Write-Host "  ⚠️  WARNING: This will REPLACE all data in '$DB_NAME' with:" -ForegroundColor Yellow
Write-Host "     $BackupFile" -ForegroundColor Cyan
Write-Host ""
$confirm = Read-Host "  Type 'yes' to continue, anything else to cancel"
if ($confirm -ne "yes") {
    Log "Restore cancelled."
    exit 0
}

# --- Check Docker is running ------------------------------------------------
$dockerRunning = docker ps --filter "name=$CONTAINER" --filter "status=running" -q 2>$null
if (-not $dockerRunning) {
    Log "ERROR: Container '$CONTAINER' is not running. Start Docker first."
    exit 1
}

# --- Drop & recreate the database -------------------------------------------
Log "Dropping existing database..."
docker exec $CONTAINER psql -U $DB_USER -d postgres -c "DROP DATABASE IF EXISTS $DB_NAME;" 2>&1
docker exec $CONTAINER psql -U $DB_USER -d postgres -c "CREATE DATABASE $DB_NAME;" 2>&1

# --- Restore from dump -------------------------------------------------------
Log "Restoring from $BackupFile ..."
Get-Content $BackupFile | docker exec -i $CONTAINER psql -U $DB_USER -d $DB_NAME -q

if ($LASTEXITCODE -ne 0) {
    Log "ERROR: Restore encountered errors. Check output above."
    exit 1
}

Log "Restore complete. Database '$DB_NAME' is ready."
