// infra/modules/openai.bicep
// Provisions Azure OpenAI account with Whisper (STT) and a chat model deployment

@description('Name for the Azure OpenAI resource')
param name string

@description('Azure region — must support Whisper Standard deployment')
param location string

@description('Resource tags')
param tags object = {}

@description('Deployment name for Whisper speech-to-text')
param whisperDeploymentName string = 'whisper'

@description('Deployment name for the chat/completion model')
param chatDeploymentName string = 'gpt-4o'

@description('Chat model name (e.g. gpt-4o, gpt-4o-mini)')
param chatModelName string = 'gpt-4o'

@description('Chat model version')
param chatModelVersion string = '2024-11-20'

// ── Azure OpenAI Account ──────────────────────────────────────────────────────
resource openAiAccount 'Microsoft.CognitiveServices/accounts@2024-10-01' = {
  name: name
  location: location
  tags: tags
  kind: 'OpenAI'
  sku: {
    name: 'S0'
  }
  properties: {
    publicNetworkAccess: 'Enabled'
    customSubDomainName: name // Required — sets {name}.openai.azure.com endpoint
  }
}

// ── Whisper Model Deployment ──────────────────────────────────────────────────
// Whisper is Standard (regional) only — GlobalStandard not available
resource whisperDeployment 'Microsoft.CognitiveServices/accounts/deployments@2024-10-01' = {
  parent: openAiAccount
  name: whisperDeploymentName
  sku: {
    name: 'Standard'
    capacity: 1 // 1 unit = 1 req/min base; increase via Azure quota request
  }
  properties: {
    model: {
      format: 'OpenAI'
      name: 'whisper-1'
      version: '1'
    }
    versionUpgradeOption: 'NoAutoUpgrade'
    raiPolicyName: 'Microsoft.Default'
  }
}

// ── Chat Model Deployment ─────────────────────────────────────────────────────
// Deployments within same account must be sequential (dependsOn required)
resource chatDeployment 'Microsoft.CognitiveServices/accounts/deployments@2024-10-01' = {
  parent: openAiAccount
  name: chatDeploymentName
  dependsOn: [whisperDeployment]
  sku: {
    name: 'GlobalStandard'
    capacity: 10
  }
  properties: {
    model: {
      format: 'OpenAI'
      name: chatModelName
      version: chatModelVersion
    }
    versionUpgradeOption: 'NoAutoUpgrade'
    raiPolicyName: 'Microsoft.Default'
  }
}

// ── Outputs ───────────────────────────────────────────────────────────────────
output endpoint string = openAiAccount.properties.endpoint
output id string = openAiAccount.id
output name string = openAiAccount.name
