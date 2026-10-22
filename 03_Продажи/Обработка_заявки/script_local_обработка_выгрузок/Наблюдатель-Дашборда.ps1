# Background folder watcher for the Dashboard folder.
# Windows Task Scheduler starts it when the user signs in.
# It scans once at startup (important after sleep) and then watches for new XLSX files.

$ErrorActionPreference = 'Stop'
$folder = Split-Path -Parent $MyInvocation.MyCommand.Path
# Find the other PowerShell file automatically. This avoids Windows PowerShell
# encoding problems with a Cyrillic filename when the task starts in background.
$launcher = (Get-ChildItem -LiteralPath $folder -Filter '*.ps1' |
  Where-Object { $_.FullName -ne $MyInvocation.MyCommand.Path } |
  Select-Object -First 1 -ExpandProperty FullName)
$logFile = Join-Path $folder 'log.txt'

function Write-WatcherLog([string]$message) {
  $timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
  Add-Content -LiteralPath $logFile -Value "[$timestamp] Watcher: $message" -Encoding UTF8
}

function Start-Processing {
  try {
    # Wait for the download or copy operation to finish writing the file.
    Start-Sleep -Seconds 4
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $launcher
    Write-WatcherLog 'Started processing.'
  }
  catch {
    Write-WatcherLog ("ERROR: " + $_.Exception.Message)
  }
}

function Get-InputFileNames {
  # Return names of non-temporary XLSX files currently in the main folder.
  # The Dashboard itself stays in this list; only newly appearing names matter.
  return @(Get-ChildItem -LiteralPath $folder -File -Filter '*.xlsx' |
    Where-Object { -not $_.Name.StartsWith('~$') } |
    ForEach-Object { $_.Name })
}

# Scan at process start. This catches files added while the computer was asleep.
Write-WatcherLog 'Watcher started.'
Start-Processing

$watcher = New-Object System.IO.FileSystemWatcher
$watcher.Path = $folder
$watcher.Filter = '*.xlsx'
$watcher.IncludeSubdirectories = $false
$watcher.EnableRaisingEvents = $true
$knownFileNames = Get-InputFileNames

$created = Register-ObjectEvent -InputObject $watcher -EventName Created -SourceIdentifier 'DashboardFileCreated'
$renamed = Register-ObjectEvent -InputObject $watcher -EventName Renamed -SourceIdentifier 'DashboardFileRenamed'

try {
  while ($true) {
    $event = Wait-Event -Timeout 5
    if ($null -eq $event) {
      # Fallback after sleep: FileSystemWatcher can miss an event while Windows
      # sleeps, so look for a filename that appeared since the last check.
      $currentFileNames = Get-InputFileNames
      $newFileNames = @($currentFileNames | Where-Object { $_ -notin $knownFileNames })
      $knownFileNames = $currentFileNames
      if ($newFileNames.Count -gt 0) {
        Write-WatcherLog 'New XLSX file found by wake-up check.'
        Start-Processing
        $knownFileNames = Get-InputFileNames
      }
      continue
    }

    $fileName = Split-Path -Leaf $event.SourceEventArgs.FullPath
    # Ignore temporary Excel files. A normal XLSX file starts a processing run.
    if (-not $fileName.StartsWith('~$')) {
      Write-WatcherLog 'New XLSX file detected.'
      Start-Processing
      $knownFileNames = Get-InputFileNames
    }

    Remove-Event -EventIdentifier $event.EventIdentifier -ErrorAction SilentlyContinue
  }
}
finally {
  Unregister-Event -SourceIdentifier 'DashboardFileCreated' -ErrorAction SilentlyContinue
  Unregister-Event -SourceIdentifier 'DashboardFileRenamed' -ErrorAction SilentlyContinue
  $watcher.Dispose()
}
