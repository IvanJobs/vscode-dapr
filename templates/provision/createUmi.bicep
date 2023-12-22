@description('Provide a location for the registry.')
param location string = resourceGroup().location

param acrName string

param umiName string

resource containerRegistry 'Microsoft.ContainerRegistry/registries@2023-01-01-preview' existing = {
  name: acrName
}

resource umi 'Microsoft.ManagedIdentity/userAssignedIdentities@2022-01-31-preview' = {
  name: umiName
  location: location
}

resource acrPull 'Microsoft.Authorization/roleDefinitions@2022-04-01' existing = {
  scope: containerRegistry
  name: '7f951dda-4ed3-4680-a7ca-43fe172d538d'
}

@description('This allows the managed identity of the container app to access the registry, note scope is applied to the wider ResourceGroup not the ACR')
resource roleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(containerRegistry.id, acrPull.id)
  scope: containerRegistry
  properties: {
    roleDefinitionId: acrPull.id
    principalId: umi.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

output id string = umi.id

