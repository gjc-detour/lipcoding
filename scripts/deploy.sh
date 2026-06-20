#!/usr/bin/env bash
# deploy.sh — One-command deployment to Azure using azd CLI
# Usage: ./scripts/deploy.sh [environment-name] [location]
#
# Prerequisites:
#   - azd CLI installed (https://aka.ms/azd)
#   - Logged in: azd auth login
#   - Azure OpenAI resource provisioned separately

set -euo pipefail

ENV_NAME="${1:-dev}"
LOCATION="${2:-koreacentral}"

echo "=== LipCoding Productivity — Azure Deployment ==="
echo "Environment: $ENV_NAME"
echo "Location:    $LOCATION"
echo ""

# Ensure azd is available
if ! command -v azd &> /dev/null; then
  echo "ERROR: azd CLI not found. Install from https://aka.ms/azd"
  exit 1
fi

# Check auth
if ! azd auth login --check-status &> /dev/null; then
  echo "Not logged in. Running azd auth login..."
  azd auth login
fi

# Create or select environment
if ! azd env list | grep -q "$ENV_NAME"; then
  echo "Creating environment '$ENV_NAME'..."
  azd env new "$ENV_NAME" --location "$LOCATION"
else
  echo "Using existing environment '$ENV_NAME'"
  azd env select "$ENV_NAME"
fi

# Check required env vars
check_env_var() {
  local val
  val=$(azd env get-value "$1" 2>/dev/null || echo "")
  if [ -z "$val" ] || [ "$val" = "placeholder" ]; then
    echo "WARNING: $1 is not set or is a placeholder."
    echo "  Set it with: azd env set $1 <value>"
    return 1
  fi
}

MISSING=0
check_env_var "AZURE_OPENAI_ENDPOINT" || MISSING=1
check_env_var "AZURE_OPENAI_API_KEY" || MISSING=1

if [ "$MISSING" -eq 1 ]; then
  echo ""
  echo "Set missing values before deploying:"
  echo "  azd env set AZURE_OPENAI_ENDPOINT https://your-resource.openai.azure.com/"
  echo "  azd env set AZURE_OPENAI_API_KEY your-key"
  echo ""
  read -p "Continue anyway? (y/N) " -r
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

# Provision infrastructure
echo ""
echo "=== Provisioning Azure resources... ==="
azd provision

# Deploy application
echo ""
echo "=== Deploying application... ==="
azd deploy

echo ""
echo "=== Deployment complete! ==="
azd env get-values | grep -i "WEB_URI" || echo "(Check Azure Portal for the app URL)"
