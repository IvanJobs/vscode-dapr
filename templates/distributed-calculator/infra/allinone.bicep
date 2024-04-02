targetScope= 'resourceGroup'

@description('Specify the name of the Azure Redis Cache to create.')
param redisCacheName string = 'redisCache-${uniqueString(resourceGroup().id)}'

@description('Acr name.')
param acrName string

@description('Aca environment name.')
param acaEnvName string

@description('Location.')
param location string

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

resource containerAppEnv 'Microsoft.App/managedEnvironments@2023-05-01' = {
  name: acaEnvName
  location: location
  properties: {
    appLogsConfiguration: {
    }
  }
}

resource redisCache 'Microsoft.Cache/Redis@2020-06-01' = {
    name: redisCacheName
    location: location
    properties: {
      enableNonSslPort: false
      minimumTlsVersion: '1.2'
      sku: {
        capacity: 1
        family: 'C'
        name: 'Standard'
      }
    }
}

// Dapr state store component 
resource daprComponent 'Microsoft.App/managedEnvironments/daprComponents@2023-05-01' = {
    name: 'redis-store'
    parent: containerAppEnv
    properties: {
      componentType: 'state.redis'
      version: 'v1'
      ignoreErrors: false
      initTimeout: '5s'
      secrets: [
          {
            name: 'redispassword'
            value: redisCache.listKeys().primaryKey
          }
      ]
      metadata: [
        {
          name: 'redisHost'
          value: '${redisCache.properties.hostName}:${redisCache.properties.sslPort}'
        }
        {
          name: 'redisPassword'
          secretRef: 'redispassword'
        }
        {
          name: 'redisDB'
          value: '0'
        }
        {
          name: 'enableTLS'
          value: 'true'
        }
      ]
    }
}
