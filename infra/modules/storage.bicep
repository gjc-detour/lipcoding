@description('Cosmos DB account name')
param cosmosAccountName string

@description('Storage account name')
param storageAccountName string

@description('Location for the resources')
param location string

@description('Tags for the resources')
param tags object = {}

resource cosmosAccount 'Microsoft.DocumentDB/databaseAccounts@2024-11-15' = {
  name: cosmosAccountName
  location: location
  tags: tags
  kind: 'GlobalDocumentDB'
  properties: {
    databaseAccountOfferType: 'Standard'
    publicNetworkAccess: 'Enabled'
    enableFreeTier: true
    locations: [
      {
        locationName: location
        failoverPriority: 0
        isZoneRedundant: false
      }
    ]
    consistencyPolicy: {
      defaultConsistencyLevel: 'Session'
    }
    capabilities: [
      {
        name: 'EnableServerless'
      }
    ]
  }
}

resource cosmosDatabase 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2024-11-15' = {
  parent: cosmosAccount
  name: 'lipcoding'
  properties: {
    resource: {
      id: 'lipcoding'
    }
  }
}

resource inboxItemsContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-11-15' = {
  parent: cosmosDatabase
  name: 'inbox_items'
  properties: {
    resource: {
      id: 'inbox_items'
      partitionKey: {
        paths: [
          '/userId'
        ]
        kind: 'Hash'
      }
    }
    options: {}
  }
}

resource scheduledEventsContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-11-15' = {
  parent: cosmosDatabase
  name: 'scheduled_events'
  properties: {
    resource: {
      id: 'scheduled_events'
      partitionKey: {
        paths: [
          '/userId'
        ]
        kind: 'Hash'
      }
    }
    options: {}
  }
}

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageAccountName
  location: location
  tags: tags
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    allowBlobPublicAccess: false
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
  }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: storageAccount
  name: 'default'
}

resource uploadsContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobService
  name: 'lipcoding-uploads'
  properties: {
    publicAccess: 'None'
  }
}

var cosmosConnectionString = cosmosAccount.listConnectionStrings().connectionStrings[0].connectionString
var storageAccountKey = storageAccount.listKeys().keys[0].value
var storageConnectionString = 'DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};AccountKey=${storageAccountKey};EndpointSuffix=${environment().suffixes.storage}'

output cosmosAccountId string = cosmosAccount.id
output cosmosAccountName string = cosmosAccount.name
output cosmosEndpoint string = cosmosAccount.properties.documentEndpoint
output cosmosConnectionString string = cosmosConnectionString
output storageConnectionString string = storageConnectionString
output blobContainerName string = uploadsContainer.name
