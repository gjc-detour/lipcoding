# deploy.ps1 — One-command deployment to Azure using azd CLI (Windows)
# Usage: .\scripts\deploy.ps1 [-EnvName dev] [-Location koreacentral] [-WithProvision]
#
# By default, only deploys the app (azd deploy) — infra already exists.
# Use -WithProvision to also run azd provision (creates/updates Azure resources).
# Required env vars are already set via: azd env set ...

param(
  [string]$EnvName = "dev",
  [string]$Location = "koreacentral",
  [switch]$WithProvision   # Pass to also provision infra (only needed first time)
)

$ErrorActionPreference = "Stop"

Write-Host "=== LipCoding Productivity - Azure Deployment ===" -ForegroundColor Cyan
Write-Host "Environment: $EnvName | Location: $Location | Provision: $WithProvision"
Write-Host ""

# Ensure azd is available
if (-not (Get-Command azd -ErrorAction SilentlyContinue)) {
  Write-Host "ERROR: azd CLI not found. Install from https://aka.ms/azd" -ForegroundColor Red
  exit 1
}

# Check auth
$authStatus = azd auth login --check-status 2>&1
if ($LASTEXITCODE -ne 0) {
  Write-Host "Not logged in. Running azd auth login..."
  azd auth login
}

# Select environment
$envList = azd env list 2>&1
if ($envList -notmatch $EnvName) {
  Write-Host "Creating environment '$EnvName'..."
  azd env new $EnvName --location $Location
} else {
  Write-Host "Using existing environment '$EnvName'"
  azd env select $EnvName
}

# Verify required env vars are present
$required = @("AZURE_OPENAI_ENDPOINT", "AZURE_OPENAI_API_KEY", "AZURE_OPENAI_DEPLOYMENT", "AZURE_OPENAI_WHISPER_DEPLOYMENT")
$missing = $false
foreach ($var in $required) {
  $val = azd env get-value $var 2>$null
  if (-not $val) {
    Write-Host "MISSING: $var — set with: azd env set $var <value>" -ForegroundColor Red
    $missing = $true
  } else {
    Write-Host "  ✓ $var" -ForegroundColor Green
  }
}
if ($missing) { exit 1 }

# Provision (optional — only when infra changes are needed)
if ($WithProvision) {
  Write-Host ""
  Write-Host "=== Provisioning Azure resources... ===" -ForegroundColor Cyan
  azd provision
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

# Deploy application code
Write-Host ""
Write-Host "=== Deploying application... ===" -ForegroundColor Cyan
azd deploy
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "=== Deployment complete! ===" -ForegroundColor Green
azd env get-values | Select-String "WEB_URI"


param(
  [string]$EnvName = "dev",
  [string]$Location = "koreacentral",
  [switch]$SkipProvision   # Use when infra already exists — just redeploy the app
)

$ErrorActionPreference = "Stop"

Write-Host "=== LipCoding Productivity - Azure Deployment ===" -ForegroundColor Cyan
Write-Host "Environment: $EnvName"
Write-Host "Location:    $Location"
Write-Host "SkipProvision: $SkipProvision"
Write-Host ""

# Ensure azd is available
if (-not (Get-Command azd -ErrorAction SilentlyContinue)) {
  Write-Host "ERROR: azd CLI not found. Install from https://aka.ms/azd" -ForegroundColor Red
  exit 1
}

# Check auth
$authStatus = azd auth login --check-status 2>&1
if ($LASTEXITCODE -ne 0) {
  Write-Host "Not logged in. Running azd auth login..."
  azd auth login
}

# Create or select environment
$envList = azd env list 2>&1
if ($envList -notmatch $EnvName) {
  Write-Host "Creating environment '$EnvName'..."
  azd env new $EnvName --location $Location
} else {
  Write-Host "Using existing environment '$EnvName'"
  azd env select $EnvName
}

# Check required env vars
function Test-EnvVar {
  param([string]$Name)
  $val = azd env get-value $Name 2>$null
  if (-not $val -or $val -eq "placeholder") {
    Write-Host "WARNING: $Name is not set or is a placeholder." -ForegroundColor Yellow
    Write-Host "  Set it with: azd env set $Name <value>"
    return $false
  }
  return $true
}

$missing = $false
if (-not (Test-EnvVar "AZURE_OPENAI_ENDPOINT")) { $missing = $true }
if (-not (Test-EnvVar "AZURE_OPENAI_API_KEY")) { $missing = $true }

if ($missing) {
  Write-Host ""
  Write-Host "Set missing values before deploying:" -ForegroundColor Yellow
  Write-Host "  azd env set AZURE_OPENAI_ENDPOINT https://your-resource.openai.azure.com/openai/v1"
  Write-Host "  azd env set AZURE_OPENAI_API_KEY your-key"
  Write-Host ""
  $reply = Read-Host "Continue anyway? (y/N)"
  if ($reply -ne "y" -and $reply -ne "Y") { exit 1 }
}

# Provision infrastructure (skip if flag set or infra already exists)
if (-not $SkipProvision) {
  Write-Host ""
  Write-Host "=== Provisioning Azure resources... ===" -ForegroundColor Cyan
  Write-Host "NOTE: If you already have infra deployed, use -SkipProvision to skip this step." -ForegroundColor Yellow
  azd provision
  if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Provision failed. Trying deploy-only (infra may already exist)..." -ForegroundColor Yellow
  }
}

# Deploy application
Write-Host ""
Write-Host "=== Deploying application... ===" -ForegroundColor Cyan
azd deploy
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "=== Deployment complete! ===" -ForegroundColor Green
azd env get-values | Select-String "WEB_URI"


$ErrorActionPreference = "Stop"

Write-Host "=== LipCoding Productivity - Azure Deployment ===" -ForegroundColor Cyan
Write-Host "Environment: $EnvName"
Write-Host "Location:    $Location"
Write-Host ""

# Ensure azd is available
if (-not (Get-Command azd -ErrorAction SilentlyContinue)) {
  Write-Host "ERROR: azd CLI not found. Install from https://aka.ms/azd" -ForegroundColor Red
  exit 1
}

# Check auth
$authStatus = azd auth login --check-status 2>&1
if ($LASTEXITCODE -ne 0) {
  Write-Host "Not logged in. Running azd auth login..."
  azd auth login
}

# Create or select environment
$envList = azd env list 2>&1
if ($envList -notmatch $EnvName) {
  Write-Host "Creating environment '$EnvName'..."
  azd env new $EnvName --location $Location
} else {
  Write-Host "Using existing environment '$EnvName'"
  azd env select $EnvName
}

# Check required env vars
function Test-EnvVar {
  param([string]$Name)
  $val = azd env get-value $Name 2>$null
  if (-not $val -or $val -eq "placeholder") {
    Write-Host "WARNING: $Name is not set or is a placeholder." -ForegroundColor Yellow
    Write-Host "  Set it with: azd env set $Name <value>"
    return $false
  }
  return $true
}

$missing = $false
if (-not (Test-EnvVar "AZURE_OPENAI_ENDPOINT")) { $missing = $true }
if (-not (Test-EnvVar "AZURE_OPENAI_API_KEY")) { $missing = $true }

if ($missing) {
  Write-Host ""
  Write-Host "Set missing values before deploying:" -ForegroundColor Yellow
  Write-Host "  azd env set AZURE_OPENAI_ENDPOINT https://your-resource.openai.azure.com/"
  Write-Host "  azd env set AZURE_OPENAI_API_KEY your-key"
  Write-Host ""
  $reply = Read-Host "Continue anyway? (y/N)"
  if ($reply -ne "y" -and $reply -ne "Y") { exit 1 }
}

# Provision infrastructure
Write-Host ""
Write-Host "=== Provisioning Azure resources... ===" -ForegroundColor Cyan
azd provision
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

# Deploy application
Write-Host ""
Write-Host "=== Deploying application... ===" -ForegroundColor Cyan
azd deploy
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "=== Deployment complete! ===" -ForegroundColor Green
azd env get-values | Select-String "WEB_URI"
