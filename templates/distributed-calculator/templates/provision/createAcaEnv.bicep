@description('Specifies the location for all resources.')
param location string

@description('Specifies the name of the log analytics workspace.')
param containerAppLogAnalyticsName string

@description('Specifies the name of the container app environment.')
param containerAppEnvName string

@description('Specifies the name of the redis of the dapr component.')
param containerAppStateName string

resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2021-06-01' = {
  name: containerAppLogAnalyticsName
  location: location
  properties: {
    sku: {
      name: 'PerGB2018'
    }
  }
}

resource containerAppEnv 'Microsoft.App/managedEnvironments@2022-06-01-preview' = {
  name: containerAppEnvName
  location: location
  sku: {
    name: 'Consumption'
  }
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalytics.properties.customerId
        sharedKey: logAnalytics.listKeys().primarySharedKey
      }
    }
  }
}

module redisDeploy 'createRedis.bicep' = {
    name: 'redis-deployment'
    params: {
      location: location
    }
}

// Dapr state store component 
resource daprComponent 'Microsoft.App/managedEnvironments/daprComponents@2023-05-01' = {
  name: containerAppStateName
  parent: containerAppEnv
  properties: {
    componentType: 'state.redis'
    version: 'v1'
    ignoreErrors: false
    initTimeout: '5s'
    secrets: [
        {
          name: 'redispassword'
          value: redisDeploy.outputs.redisKey
        }
    ]
    metadata: [
      {
        name: 'redisHost'
        value: redisDeploy.outputs.redisHostName
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


output id string = containerAppEnv.id 
