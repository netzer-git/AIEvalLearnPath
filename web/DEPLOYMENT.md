# Deployment

Single-host, single-user setup: a Cloudflare quick tunnel fronts a local Next.js prod build, gated by a passcode. The tunnel URL is ephemeral — it changes every time `cloudflared` restarts, so the script writes the current URL to `web/data/tunnel-url.txt`.

## One-time setup

1. **Install cloudflared** (Windows):
   ```powershell
   winget install Cloudflare.cloudflared
   ```

2. **Set auth secrets.** Create `web/.env.local` with a 64-char `SESSION_PASSWORD` and the passcode you'll type on your phone:
   ```
   SESSION_PASSWORD=<64-char-hex>
   APP_PASSCODE=<your-passcode>
   ```
   Generate the password from PowerShell:
   ```powershell
   $b = New-Object byte[] 32
   [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
   ($b | ForEach-Object { $_.ToString("x2") }) -join ""
   ```

3. **Build:**
   ```powershell
   cd web
   npm run build
   ```

## Run manually

```powershell
powershell -ExecutionPolicy Bypass -File C:\clones\AIEvalLearnPath\web\scripts\start-deployment.ps1
```

The script starts both processes detached and writes the public URL to `web/data/tunnel-url.txt`. Stop with:

```powershell
powershell -File C:\clones\AIEvalLearnPath\web\scripts\stop-deployment.ps1
```

Logs land in `web/data/logs/`.

## Run on login (Windows Task Scheduler)

Register once:

```powershell
schtasks /Create `
  /TN "AIEvalLearnPath" `
  /TR "powershell.exe -WindowStyle Hidden -ExecutionPolicy Bypass -File C:\clones\AIEvalLearnPath\web\scripts\start-deployment.ps1" `
  /SC ONLOGON `
  /RU "$env:USERNAME" `
  /F
```

Useful sibling commands:

```powershell
schtasks /Run /TN "AIEvalLearnPath"     # fire it now
schtasks /Query /TN "AIEvalLearnPath" /V /FO LIST
schtasks /Delete /TN "AIEvalLearnPath" /F
```

After every reboot the tunnel URL changes — read the new one with:

```powershell
Get-Content C:\clones\AIEvalLearnPath\web\data\tunnel-url.txt
```

## Upgrading to a named tunnel later

Quick tunnels are throwaway. For a stable hostname on a domain you own in Cloudflare, replace step 1 of `start-deployment.ps1` with `cloudflared tunnel run <tunnel-name>` and follow the [named-tunnel guide](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps). The Task Scheduler entry stays the same.
