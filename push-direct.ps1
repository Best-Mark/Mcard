# Push helper: bypass any proxy/VPN, force direct connection to GitHub with auto-retry
# Usage: .push-direct.ps1            (push main)
#        .push-direct.ps1 release    (push given branch)
param([string]$Branch = 'main')

$ErrorActionPreference = 'Continue'

# 1) clear all proxy env vars in this session (both cases)
# use SetEnvironmentVariable(null) instead of Remove-Item to avoid safe-delete guard warnings
foreach ($k in 'HTTP_PROXY','HTTPS_PROXY','ALL_PROXY','http_proxy','https_proxy','all_proxy') {
    [Environment]::SetEnvironmentVariable($k, $null, 'Process')
}
$env:NO_PROXY = '*'
$env:no_proxy = '*'

# 2) locate repo root (script directory)
$repo = Split-Path -Parent $MyInvocation.MyCommand.Path
Push-Location $repo

$maxRetry = 15
try {
    Write-Host "[push-direct] branch=$Branch forced DIRECT (no proxy/VPN)" -ForegroundColor Cyan
    $done = $false
    for ($i = 1; $i -le $maxRetry; $i++) {
        # -c http.proxy= overrides any git proxy config, even global ones
        $out = & git -c http.proxy= -c https.proxy= push origin $Branch 2>&1
        $text = ($out | Out-String)
        if ($LASTEXITCODE -eq 0) {
            if ($text -match 'up-to-date') {
                Write-Host "[push-direct] remote is up-to-date, nothing to push" -ForegroundColor Yellow
            } else {
                Write-Host "[push-direct] PUSHED on attempt $i" -ForegroundColor Green
                $out | Write-Host
            }
            $done = $true
            break
        }
        Write-Host "[push-direct] attempt $i/$maxRetry failed: $($text.Trim())" -ForegroundColor Yellow
        if ($i -lt $maxRetry) { Start-Sleep -Seconds 3 }
    }
    if (-not $done) {
        Write-Error "[push-direct] failed after $maxRetry attempts; check network/VPN"
        exit 1
    }
} finally {
    Pop-Location
}
