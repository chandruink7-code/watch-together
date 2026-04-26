# ==============================================================
# Watch Together - Vercel client deploy (Windows / PowerShell)
# ==============================================================

$ErrorActionPreference = "Stop"

function Info($msg) { Write-Host $msg -ForegroundColor Cyan }
function Ok($msg)   { Write-Host "[OK] $msg" -ForegroundColor Green }
function Warn($msg) { Write-Host $msg -ForegroundColor Yellow }
function Fail($msg) { Write-Host "Error: $msg" -ForegroundColor Red; exit 1 }

Write-Host ""
Info "=== Watch Together - Vercel Client Deploy ==="
Write-Host ""

if (-not (Test-Path ".\client\package.json")) {
    Fail "Run this from the watch-together folder (the one with \client inside)."
}

# Read server URL
$serverUrl = ""
if (Test-Path ".server-url") {
    $serverUrl = (Get-Content ".server-url" -Raw).Trim()
}

if (-not $serverUrl) {
    Warn "No .server-url file found."
    Write-Host "Either run .\deploy-server.ps1 first, OR paste your server URL now:"
    $serverUrl = Read-Host "Server URL (https://...)"
}

if ($serverUrl -notmatch '^https?://') {
    Fail "Invalid URL: $serverUrl. Must start with http:// or https://"
}

Ok "Server URL: $serverUrl"
Write-Host ""

# Step 1: Install Vercel CLI
if (-not (Get-Command vercel -ErrorAction SilentlyContinue)) {
    Warn "Vercel CLI not found. Installing globally via npm..."
    npm install -g vercel
}
Ok "Vercel CLI ready"
Write-Host ""

# Step 2: Login
$loggedIn = $false
try { vercel whoami 2>&1 | Out-Null; if ($LASTEXITCODE -eq 0) { $loggedIn = $true } } catch {}

if (-not $loggedIn) {
    Warn "Logging in to Vercel..."
    Warn "Choose 'Continue with Email'. Vercel will email you a confirmation link."
    Write-Host ""
    vercel login
} else {
    Ok ("Already logged in as " + (vercel whoami))
}
Write-Host ""

Push-Location client

try {
    if (-not (Test-Path ".vercel")) {
        Warn "Linking project to Vercel..."
        try { vercel link --yes --project watch-together } catch { vercel link --yes }
    }
    Write-Host ""

    Warn "Setting VITE_SERVER_URL on Vercel..."
    try { vercel env rm VITE_SERVER_URL production --yes 2>&1 | Out-Null } catch {}
    try { vercel env rm VITE_SERVER_URL preview --yes 2>&1 | Out-Null } catch {}
    try { vercel env rm VITE_SERVER_URL development --yes 2>&1 | Out-Null } catch {}

    $serverUrl | vercel env add VITE_SERVER_URL production
    $serverUrl | vercel env add VITE_SERVER_URL preview
    $serverUrl | vercel env add VITE_SERVER_URL development
    Write-Host ""
    Ok "Env var set"
    Write-Host ""

    Warn "Deploying to production (this takes about 1 minute)..."
    $deployOutput = vercel --prod --yes 2>&1 | Out-String
    Write-Host $deployOutput

    $prodUrl = $null
    $matchResult = [regex]::Matches($deployOutput, 'https://[a-zA-Z0-9.-]+\.vercel\.app')
    if ($matchResult.Count -gt 0) {
        $prodUrl = $matchResult[$matchResult.Count - 1].Value
    }

    Pop-Location

    Write-Host ""
    Info "==============================================="
    Ok "Watch Together is live!"
    Info "==============================================="
    Write-Host ""

    if ($prodUrl) {
        Write-Host "  Share this link:"
        Write-Host ""
        Write-Host "    $prodUrl" -ForegroundColor Green
        Write-Host ""
    } else {
        Warn "Couldn't auto-detect the production URL."
        Write-Host "Check the deploy output above for a https://*.vercel.app URL."
        Write-Host ""
    }

    Write-Host "Server URL:   $serverUrl"
    Write-Host ""
    Warn "Test it:"
    Write-Host "  1. Open the link above"
    Write-Host "  2. Create a room"
    Write-Host "  3. Click 'Copy link' and send to a friend"
    Write-Host "  4. Both pick the same video file, click 'Join call' for voice"
    Write-Host ""
    Warn "Note about Railway free tier:"
    Write-Host "  Server sleeps after about 10 min of inactivity. First request"
    Write-Host "  after a sleep takes about 30s to wake up. To wake it before"
    Write-Host "  sharing, just open the server URL in a browser."
    Write-Host ""
} catch {
    Pop-Location
    throw
}
