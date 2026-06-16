# =============================================================================
# Registers a Windows Scheduled Task to run the RepREs backup every day at 2 AM.
# Run this script ONCE as Administrator to set it up.
# =============================================================================

$scriptPath = "$PSScriptRoot\backup.ps1"
$taskName   = "RepREs-Daily-Backup"
$taskDesc   = "Daily PostgreSQL backup for the RepREs clinical trial application."
$runAt      = "02:00"

# Resolve absolute path in case PSScriptRoot is empty (direct execution)
if (-not $scriptPath -or -not (Test-Path $scriptPath)) {
    $scriptPath = "C:\Users\Emerson.Collazo\Documents\Antigravity\RepREs\scripts\backup.ps1"
}

$action  = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-NonInteractive -ExecutionPolicy Bypass -File `"$scriptPath`""

$trigger = New-ScheduledTaskTrigger -Daily -At $runAt

$settings = New-ScheduledTaskSettingsSet `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 30) `
    -StartWhenAvailable         # runs at next opportunity if the machine was off at 2 AM

# Remove existing task if present
if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
    Write-Host "Removed existing task '$taskName'."
}

Register-ScheduledTask `
    -TaskName    $taskName `
    -Description $taskDesc `
    -Action      $action `
    -Trigger     $trigger `
    -Settings    $settings `
    -RunLevel    Highest

Write-Host ""
Write-Host "✅ Scheduled Task '$taskName' registered successfully!" -ForegroundColor Green
Write-Host "   Runs daily at $runAt. Backups saved to C:\Backups\RepREs\"
Write-Host ""
Write-Host "To run a backup immediately:"
Write-Host "   powershell -ExecutionPolicy Bypass -File `"$scriptPath`""
Write-Host ""
Write-Host "To view the task in Task Scheduler: taskschd.msc"
