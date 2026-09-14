# factory-dashboard.ps1 — live-refreshing wrapper around factory-dashboard.js (Windows/herdr panes)
#
# Usage:
#   powershell -File .agents/tools/factory-dashboard.ps1
#   powershell -File .agents/tools/factory-dashboard.ps1 -Signals
#   powershell -File .agents/tools/factory-dashboard.ps1 -Interval 10
#
# Ctrl-C to quit.
param(
  [int]$Interval = 5,
  [switch]$Signals,
  [switch]$Once
)

$ErrorActionPreference = "Stop"

# Force UTF-8 so emoji / box-drawing / status dots render (default PS code page mangles them).
try {
  [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
  $OutputEncoding = [System.Text.Encoding]::UTF8
  chcp 65001 > $null 2>&1
} catch {}

$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
$js  = Join-Path $dir "factory-dashboard.js"
$jsArgs = @()
if ($Signals) { $jsArgs += "--signals" }

if ($Once) {
  node $js @jsArgs
  exit $LASTEXITCODE
}

try {
  while ($true) {
    $out = node $js @jsArgs 2>&1 | Out-String
    Clear-Host
    Write-Host $out.TrimEnd()
    Write-Host "  refresh ${Interval}s - Ctrl-C to quit" -ForegroundColor DarkGray
    Start-Sleep -Seconds $Interval
  }
} finally {
  [Console]::CursorVisible = $true
}
