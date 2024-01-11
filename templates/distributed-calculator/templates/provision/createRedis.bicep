@description('Specify the name of the Azure Redis Cache to create.')
param redisCacheName string = 'redisCache-${uniqueString(resourceGroup().id)}'

@description('Location of all resources')
param location string

@description('Specify the pricing tier of the new Azure Redis Cache.')
@allowed([
  'Basic'
  'Standard'
  'Premium'
])
param redisCacheSKU string = 'Standard'

@description('Specify the family for the sku. C = Basic/Standard, P = Premium.')
@allowed([
  'C'
  'P'
])
param redisCacheFamily string = 'C'

@description('Specify the size of the new Azure Redis Cache instance. Valid values: for C (Basic/Standard) family (0, 1, 2, 3, 4, 5, 6), for P (Premium) family (1, 2, 3, 4)')
@allowed([
  0
  1
  2
  3
  4
  5
  6
])
param redisCacheCapacity int = 1

@description('Specify a boolean value that indicates whether to allow access via non-SSL ports.')
param enableNonSslPort bool = false

@description('Specify a boolean value that indicates whether diagnostics should be saved to the specified storage account.')
param diagnosticsEnabled bool = false

// @description('Specify the name of an existing storage account for diagnostics.')
// param existingDiagnosticsStorageAccountName string

// @description('Specify the resource group name of an existing storage account for diagnostics.')
// param existingDiagnosticsStorageAccountResourceGroup string

// module saDeployment 'createSa.bicep' = {
//   name: 'sa-deployment'
//   params: {
//     storageAccountName: 'sasktest'
//     location: location
//   }
// }

resource redisCache 'Microsoft.Cache/Redis@2020-06-01' = {
  name: redisCacheName
  location: location
  properties: {
    enableNonSslPort: enableNonSslPort
    minimumTlsVersion: '1.2'
    sku: {
      capacity: redisCacheCapacity
      family: redisCacheFamily
      name: redisCacheSKU
    }
  }
}

// resource Microsoft_Insights_diagnosticsettings_redisCacheName 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
//   scope: redisCache
//   name: redisCache.name
//   properties: {
//     // storageAccountId: saDeployment.outputs.storageAccountId
//     metrics: [
//       {
//         timeGrain: 'AllMetrics'
//         enabled: diagnosticsEnabled
//         retentionPolicy: {
//           days: 90
//           enabled: diagnosticsEnabled
//         }
//       }
//     ]
//   }
// }

output redisHostName string = redisCache.properties.hostName
output redisKey string = listKeys(redisCache.id, '2019-07-01').primaryKey 
