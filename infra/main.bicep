targetScope = 'subscription'

@minLength(1)
@maxLength(64)
@description('Name of the environment')
param environmentName string

@minLength(1)
@description('Primary location for all resources')
param location string

@secure()
@description('Azure OpenAI API Key')
param azureOpenAiApiKey string = ''

@description('Azure OpenAI Endpoint')
param azureOpenAiEndpoint string = ''

@description('Azure OpenAI Deployment name')
param azureOpenAiDeployment string = 'gpt-4o'

@description('Whisper deployment name for speech-to-text')
param whisperDeploymentName string = 'whisper'

var abbrs = loadJsonContent('./abbreviations.json')
var resourceToken = toLower(uniqueString(subscription().id, environmentName, location))
var tags = { 'azd-env-name': environmentName }

resource rg 'Microsoft.Resources/resourceGroups@2022-09-01' = {
  name: 'rg-${environmentName}'
  location: location
  tags: tags
}

module containerAppsEnv './modules/container-apps-env.bicep' = {
  name: 'container-apps-env'
  scope: rg
  params: {
    name: '${abbrs.appManagedEnvironments}${resourceToken}'
    location: location
    tags: tags
  }
}

module containerRegistry './modules/container-registry.bicep' = {
  name: 'container-registry'
  scope: rg
  params: {
    name: '${abbrs.containerRegistryRegistries}${resourceToken}'
    location: location
    tags: tags
  }
}

module openai './modules/openai.bicep' = {
  name: 'openai'
  scope: rg
  params: {
    name: '${abbrs.cognitiveServicesAccounts}${resourceToken}'
    location: location
    tags: tags
    whisperDeploymentName: whisperDeploymentName
    chatDeploymentName: azureOpenAiDeployment
  }
}

module storage './modules/storage.bicep' = {
  name: 'storage'
  scope: rg
  params: {
    cosmosAccountName: 'cosmos${resourceToken}'
    storageAccountName: 'st${resourceToken}'
    location: location
    tags: tags
  }
}

module web './modules/container-app.bicep' = {
  name: 'web'
  scope: rg
  params: {
    name: '${abbrs.appContainerApps}web-${resourceToken}'
    location: location
    tags: union(tags, { 'azd-service-name': 'web' })
    containerAppsEnvironmentName: containerAppsEnv.outputs.name
    containerRegistryName: containerRegistry.outputs.name
    env: [
      { name: 'AZURE_OPENAI_ENDPOINT', value: azureOpenAiEndpoint != '' ? azureOpenAiEndpoint : openai.outputs.endpoint }
      { name: 'AZURE_OPENAI_API_KEY', secretRef: 'azure-openai-key' }
      { name: 'AZURE_OPENAI_DEPLOYMENT', value: azureOpenAiDeployment }
      { name: 'AZURE_OPENAI_WHISPER_DEPLOYMENT', value: whisperDeploymentName }
      { name: 'STORAGE_BACKEND', value: 'cosmos' }
      { name: 'COSMOS_ENDPOINT', value: storage.outputs.cosmosEndpoint }
      { name: 'COSMOS_CONNECTION_STRING', secretRef: 'cosmos-connection-string' }
      { name: 'AZURE_STORAGE_CONNECTION_STRING', secretRef: 'azure-storage-connection-string' }
      { name: 'PORT', value: '3001' }
    ]
    secrets: [
      { name: 'azure-openai-key', value: azureOpenAiApiKey }
      { name: 'cosmos-connection-string', value: storage.outputs.cosmosConnectionString }
      { name: 'azure-storage-connection-string', value: storage.outputs.storageConnectionString }
    ]
    targetPort: 3001
  }
}

module cosmosRoleAssignment './modules/cosmos-role-assignment.bicep' = {
  name: 'cosmos-role-assignment'
  scope: rg
  params: {
    cosmosAccountName: storage.outputs.cosmosAccountName
    principalId: web.outputs.principalId
  }
}

output AZURE_CONTAINER_REGISTRY_ENDPOINT string = containerRegistry.outputs.loginServer
output WEB_URI string = web.outputs.uri
