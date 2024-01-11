@description('Provide a location for the registry.')
param location string = resourceGroup().location

@description('Provide the name for the registry.')
param acrName string

resource containerRegistry 'Microsoft.ContainerRegistry/registries@2023-01-01-preview' = {
  name: acrName
  location: location
  sku: {
    name: 'Standard'
  }
  properties: {
    adminUserEnabled: false
    anonymousPullEnabled: true
  }
}
