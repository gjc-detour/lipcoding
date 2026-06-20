@description('Cosmos DB account name')
param cosmosAccountName string

@description('Principal ID to grant Cosmos DB data contributor access')
param principalId string

resource cosmosAccount 'Microsoft.DocumentDB/databaseAccounts@2024-11-15' existing = {
  name: cosmosAccountName
}

resource cosmosDataContributorRole 'Microsoft.DocumentDB/databaseAccounts/sqlRoleAssignments@2024-11-15' = {
  parent: cosmosAccount
  name: guid(cosmosAccount.name, principalId, 'cosmos-data-contributor')
  properties: {
    principalId: principalId
    roleDefinitionId: '${cosmosAccount.id}/sqlRoleDefinitions/00000000-0000-0000-0000-000000000002'
    scope: cosmosAccount.id
  }
}
