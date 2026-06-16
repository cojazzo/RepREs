$scriptPath = "C:\Users\Emerson.Collazo\Documents\Antigravity\RepREs\scripts\backup.ps1"
$taskName   = "RepREs-Daily-Backup"

$action   = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NonInteractive -ExecutionPolicy Bypass -File `"$scriptPath`""
$trigger  = New-ScheduledTaskTrigger -Daily -At "02:00"
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 30) -StartWhenAvailable

if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
    Write-Host "Removed existing task."
}

$task = Register-ScheduledTask -TaskName $taskName `
    -Description "Daily PostgreSQL backup for RepREs clinical trial app." `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -RunLevel Highest `
    -Force

if ($task) {
    $nextRun = (Get-ScheduledTaskInfo -TaskName $taskName).NextRunTime
    Write-Host "SUCCESS: Task '$taskName' registered. Next run: $nextRun"
} else {
    Write-Host "ERROR: Task registration failed."
}
