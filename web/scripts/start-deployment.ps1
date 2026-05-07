# Launches the Next.js prod server and a cloudflared quick tunnel as
# detached background processes, then writes the public *.trycloudflare.com
# URL to web/data/tunnel-url.txt so it's easy to find after a reboot.
#
# Designed to be triggered by a Task Scheduler "At log on" task — see
# web/DEPLOYMENT.md for the schtasks command that registers it.

$ErrorActionPreference = "Stop"

# Resolve repo paths relative to this script's location.
$webRoot = Split-Path -Parent $PSScriptRoot
$logDir = Join-Path $webRoot "data\logs"
$urlFile = Join-Path $webRoot "data\tunnel-url.txt"
$webLog = Join-Path $logDir "web.log"
$webErr = Join-Path $logDir "web.err.log"
$tunnelLog = Join-Path $logDir "tunnel.log"
$tunnelErr = Join-Path $logDir "tunnel.err.log"

New-Item -Path $logDir -ItemType Directory -Force | Out-Null

# Free port 3000 if a stale process is squatting on it.
Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue |
    ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }

# Start Next.js prod server. npm.cmd lives on PATH for any user with Node installed.
Start-Process -FilePath "npm.cmd" `
    -ArgumentList "run", "start" `
    -WorkingDirectory $webRoot `
    -WindowStyle Hidden `
    -RedirectStandardOutput $webLog `
    -RedirectStandardError $webErr | Out-Null

# Start cloudflared quick tunnel pointing at the local prod server.
$cloudflared = "C:\Program Files (x86)\cloudflared\cloudflared.exe"
if (-not (Test-Path $cloudflared)) {
    throw "cloudflared not found at $cloudflared. Install with: winget install Cloudflare.cloudflared"
}
Start-Process -FilePath $cloudflared `
    -ArgumentList "tunnel", "--url", "http://localhost:3000", "--no-autoupdate" `
    -WindowStyle Hidden `
    -RedirectStandardOutput $tunnelLog `
    -RedirectStandardError $tunnelErr | Out-Null

# Poll the tunnel log for the public URL (cloudflared prints it once on connect).
$found = $null
for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 2
    if (Test-Path $tunnelErr) {
        $match = Select-String -Path $tunnelErr `
            -Pattern "https://[a-z0-9-]+\.trycloudflare\.com" `
            -ErrorAction SilentlyContinue |
            Select-Object -First 1
        if ($match) { $found = $match.Matches[0].Value; break }
    }
}

if ($found) {
    Set-Content -Path $urlFile -Value $found -Encoding utf8 -NoNewline
    Write-Output "Tunnel URL: $found"
} else {
    Write-Output "Tunnel URL not detected within 60s. Check $tunnelErr."
    exit 1
}
