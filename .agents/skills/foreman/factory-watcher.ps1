<# factory-watcher.ps1 - polls GitHub for new issues and pokes the foreman agent

Setup:
  herdr pane split --current --direction down --cwd $PWD --no-focus
  herdr pane run <pane-id> "powershell -File .agents/skills/foreman/factory-watcher.ps1"
#>

param(
    [int]$Interval = 60,
    [string]$Foreman = "foreman",
    [switch]$Quiet
)

$env:GITHUB_TOKEN = gh auth token 2>$null
if (-not $env:GITHUB_TOKEN) {
    Write-Error "GITHUB_TOKEN not available"
    exit 1
}

# Read github owner/repo from bd config
$ghOwner = (bd config get github.owner 2>$null).Trim()
$ghRepo = (bd config get github.repo 2>$null).Trim()
if (-not $ghOwner -or -not $ghRepo) {
    Write-Error "github.owner/repo not configured in bd"
    exit 1
}

Write-Host "[watcher] Started, polling every ${Interval}s, foreman=${Foreman}, repo=${ghOwner}/${ghRepo}"

# Build set of known GitHub issue numbers from beads
function Get-KnownGitHubNumbers {
    $nums = @{}
    try {
        $issues = bd list --json 2>$null | ConvertFrom-Json -Depth 10
        foreach ($i in @($issues)) {
            if ($i.external_ref -match '/issues/(\d+)$') {
                $nums[$Matches[1]] = $true
            }
        }
    } catch {}
    return $nums
}

$known = Get-KnownGitHubNumbers
Write-Host "[watcher] Baseline: $($known.Count) known GitHub issues"

while ($true) {
    Start-Sleep -Seconds $Interval
    $env:GITHUB_TOKEN = gh auth token 2>$null

    # List open GitHub issue numbers via gh
    $ghNumbers = @()
    try {
        $ghIssues = gh issue list --repo "${ghOwner}/${ghRepo}" --state open --json number 2>$null | ConvertFrom-Json
        $ghNumbers = @($ghIssues | ForEach-Object { $_.number.ToString() })
    } catch {}

    # Find new ones not in beads
    $newNumbers = @()
    foreach ($n in $ghNumbers) {
        if (-not $known.ContainsKey($n)) {
            $newNumbers += $n
        }
    }

    if ($newNumbers.Count -gt 0) {
        $ts = Get-Date -Format "HH:mm:ss"
        Write-Host "[watcher] $ts - $($newNumbers.Count) new GitHub issues: $($newNumbers -join ', ')"

        # Pull each new issue into beads
        foreach ($n in $newNumbers) {
            Write-Host "[watcher] Pulling issue #$n..."
            bd github pull $n 2>$null | Out-Null
            $known[$n] = $true
        }

        $readyCount = 0
        try {
            $r = bd ready --json 2>$null | ConvertFrom-Json
            $readyCount = @($r).Count
        } catch {}

        herdr notification show "Factory: $($newNumbers.Count) new issues" --body "$readyCount ready" --sound request 2>$null | Out-Null

        # Poke foreman if idle
        $state = "missing"
        try {
            $raw = herdr agent get $Foreman 2>$null | Out-String
            if ($raw -match '"agent_status"\s*:\s*"([^"]+)"') {
                $state = $Matches[1]
            }
        } catch {}

        if ($state -eq "idle" -or $state -eq "done") {
            Write-Host "[watcher] Poking foreman..."
            herdr agent prompt $Foreman "/factory" 2>$null | Out-Null
            Write-Host "[watcher] Foreman poked"
        } else {
            Write-Host "[watcher] Foreman is $state, skipping"
        }
    } else {
        if (-not $Quiet) {
            $ts = Get-Date -Format "HH:mm:ss"
            Write-Host "[watcher] $ts - no new issues"
        }
    }
}
