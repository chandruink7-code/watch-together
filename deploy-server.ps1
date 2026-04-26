# ==============================================================
# Watch Together - Railway server deploy (Windows / PowerShell)
# ==============================================================

$ErrorActionPreference = "Stop"

function Info($msg) { Write-Host $msg -ForegroundColor Cyan }
function Ok($msg)   { Write-Host "[OK] $msg" -ForegroundColor Green }
function Warn($msg) { Write-Host $msg -ForegroundColor Yellow }
function Fail($msg) { Write-Host "Error: $msg" -ForegroundColor Red; exit 1 }

Write-Host ""
Info "=== Watch Together - Railway Server Deploy ==="
Write-Host ""

if (-not (Test-Path ".\server\package.json")) {
    Fail "Run this from the watch-together folder (the one with \server inside)."
}

# Step 1: Install Railway CLI if missing
if (-not (Get-Command railway -ErrorAction SilentlyContinue)) {
    Warn "Railway CLI not found. Installing via npm..."
    npm install -g @railway/cli
    if ($LASTEXITCODE -ne 0) {
        Fail "Could not install Railway CLI. Install Node.js from nodejs.org first."
    }
}
Ok "Railway CLI ready"
Write-Host ""

# Step 2: Login
$loggedIn = $false
try { railway whoami 2>&1 | Out-Null; if ($LASTEXITCODE -eq 0) { $loggedIn = $true } } catch {}

if (-not $loggedIn) {
    Warn "Opening browser to log you in to Railway..."
    Warn "Sign up with email/Google if you don't have an account yet."
    Write-Host ""
    railway login
} else {
    Ok ("Already logged in as " + (railway whoami))
}
Write-Host ""

Push-Location server

try {
    $linked = $false
    try { railway status 2>&1 | Out-Null; if ($LASTEXITCODE -eq 0) { $linked = $true } } catch {}

    if (-not $linked) {
        Warn "Creating Railway project..."
        try { railway init --name "watch-together-server" } catch { railway init }
    } else {
        Ok "Project already linked"
    }
    Write-Host ""

    Warn "Deploying server (this takes 1-2 minutes)..."
    railway up --detach
    Write-Host ""
    Ok "Deploy started"
    Write-Host ""

    Warn "Generating public URL..."
    $domainOutput = railway domain 2>&1 | Out-String
    Write-Host $domainOutput

    $serverUrl = $null
    if ($domainOutput -match 'https?://[a-zA-Z0-9.-]+\.up\.railway\.app') {
        $serverUrl = $matches[0]
        if ($serverUrl -notmatch '^https?://') { $serverUrl = "https://$serverUrl" }
    } elseif ($domainOutput -match '[a-zA-Z0-9.-]+\.up\.railway\.app') {
        $serverUrl = "https://" + $matches[0]
    }

    Pop-Location

    Write-Host ""
    Info "==============================================="
    if ($serverUrl) {
        Ok "Server is being deployed to:"
        Write-Host ""
        Write-Host "    $serverUrl" -ForegroundColor Green
        Write-Host ""
        Warn "Wait 30-60 seconds, then test it by opening that URL in your browser."
        Warn "You should see: { ok: true, service: watch-together-server }"
        Write-Host ""
        $serverUrl | Out-File -FilePath "..\.server-url" -Encoding ASCII -NoNewline
        Ok "URL saved to .server-url for the next step."
    } else {
        Warn "Couldn't auto-detect the URL."
        Write-Host "Run this manually inside server\:"
        Write-Host "  railway domain"
        Write-Host "Then save the output to .server-url at the project root."
    }
    Info "==============================================="
    Write-Host ""
    Write-Host "Next: run " -NoNewline
    Write-Host ".\deploy-client.ps1" -ForegroundColor Green -NoNewline
    Write-Host " to deploy the frontend."
    Write-Host ""
} catch {
    Pop-Location
    throw
}
