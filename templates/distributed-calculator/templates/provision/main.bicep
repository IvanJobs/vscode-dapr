@description('Specifies the location for all resources.')
param location string = resourceGroup().location

@description('Specifies the location for all resources.')
param rgName string = resourceGroup().name

@description('Specifies the name of the log analytics workspace.')
param containerAppLogAnalyticsName string = 'containerapp-log-${uniqueString(resourceGroup().id)}'

@description('Specifies the name of the container app environment.')
param containerAppEnvName string = 'containerapp-env-${uniqueString(resourceGroup().id)}'

@description('Specifies the name of the container app environment.')
param containerAppDaprStateName string = 'containerapp-state-${uniqueString(resourceGroup().id)}'

@description('Specifies the name of the container registry.')
param acrName string = 'acr${uniqueString(resourceGroup().id)}'

module acrDeployment 'createAcr.bicep' = {
  name: 'acr-deployment'
  scope: resourceGroup(rgName)
  params: {
    acrName: acrName
    location: location
  }
}

module acaEnvDeployment 'createAcaEnv.bicep' = {
  name: 'aca-env-deployment'
  scope: resourceGroup(rgName)
  params: {
    location: location
    containerAppLogAnalyticsName: containerAppLogAnalyticsName
    containerAppEnvName: containerAppEnvName
    containerAppStateName: containerAppDaprStateName
  }
  dependsOn: [acrDeployment]
}
