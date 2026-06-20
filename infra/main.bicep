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

@description('Comma-separated userId:displayName:token entries')
param allowedUsers string = ''

@description('ACS connection string for reminder emails')
@secure()
param azureCommunicationConnectionString string = ''

@description('Sender email address for reminder emails')
param notificationFromEmail string = ''

@description('Recipient email address for reminder emails')
param notificationToEmail string = ''

@description('Notification worker polling interval in milliseconds')
param notificationIntervalMs string = '60000'

@description('Application log level')
param logLevel string = 'info'

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
      { name: 'ALLOWED_USERS', value: allowedUsers }
      { name: 'LOG_LEVEL', value: logLevel }
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

module worker './modules/worker.bicep' = {
  name: 'worker'
  scope: rg
  params: {
    name: '${abbrs.appContainerApps}worker-${resourceToken}'
    location: location
    tags: union(tags, { 'azd-service-name': 'worker' })
    containerAppsEnvironmentName: containerAppsEnv.outputs.name
    containerRegistryName: containerRegistry.outputs.name
    env: [
      { name: 'STORAGE_BACKEND', value: 'cosmos' }
      { name: 'COSMOS_ENDPOINT', value: storage.outputs.cosmosEndpoint }
      { name: 'COSMOS_CONNECTION_STRING', secretRef: 'cosmos-connection-string' }
      { name: 'ALLOWED_USERS', value: allowedUsers }
      { name: 'AZURE_COMMUNICATION_CONNECTION_STRING', secretRef: 'azure-communication-connection-string' }
      { name: 'NOTIFICATION_FROM_EMAIL', value: notificationFromEmail }
      { name: 'NOTIFICATION_TO_EMAIL', value: notificationToEmail }
      { name: 'NOTIFICATION_INTERVAL_MS', value: notificationIntervalMs }
      { name: 'LOG_LEVEL', value: logLevel }
      { name: 'NODE_ENV', value: 'production' }
    ]
    secrets: [
      { name: 'cosmos-connection-string', value: storage.outputs.cosmosConnectionString }
      { name: 'azure-communication-connection-string', value: azureCommunicationConnectionString }
    ]
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

module workerCosmosRoleAssignment './modules/cosmos-role-assignment.bicep' = {
  name: 'worker-cosmos-role-assignment'
  scope: rg
  params: {
    cosmosAccountName: storage.outputs.cosmosAccountName
    principalId: worker.outputs.principalId
  }
}

output AZURE_CONTAINER_REGISTRY_ENDPOINT string = containerRegistry.outputs.loginServer
output WEB_URI string = web.outputs.uri
