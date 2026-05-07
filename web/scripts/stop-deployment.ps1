# Stops the Next.js prod server (anything listening on :3000) and any
# cloudflared processes spawned by start-deployment.ps1. Safe to run even
# if nothing is currently up — kill calls swallow ProcessNotFound.

Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue |
    ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }

Get-Process -Name "cloudflared" -ErrorAction SilentlyContinue |
    Stop-Process -Force -ErrorAction SilentlyContinue

Write-Output "Stopped."
