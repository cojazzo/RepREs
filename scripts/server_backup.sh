#!/bin/bash
# server_backup.sh
# Runs a pg_dump of the RepREs database and keeps the last 7 days of backups.

# Configuration
BACKUP_DIR="$HOME/backups/repres"
DB_NAME="repres_db"
DB_USER="repres"
export PGPASSWORD="repres_secret"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Generate filename with timestamp
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M")
BACKUP_FILE="$BACKUP_DIR/repres_$TIMESTAMP.sql"
LOG_FILE="$BACKUP_DIR/backup.log"

echo "[$(date)] Starting backup -> $BACKUP_FILE" >> "$LOG_FILE"

# Run pg_dump
pg_dump -h localhost -U "$DB_USER" -d "$DB_NAME" -f "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo "[$(date)] Backup successful. Size: $SIZE" >> "$LOG_FILE"
else
    echo "[$(date)] ERROR: Backup failed!" >> "$LOG_FILE"
fi

# Prune backups older than 7 days
find "$BACKUP_DIR" -type f -name "repres_*.sql" -mtime +7 -delete
echo "[$(date)] Old backups pruned. Current backup count: $(ls -1 "$BACKUP_DIR"/repres_*.sql 2>/dev/null | wc -l)" >> "$LOG_FILE"
