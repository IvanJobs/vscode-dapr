@description('Name of the project or solution')
@minLength(3)
@maxLength(22)
param storageAccountName string

@description('Deployment Location')
@allowed([
  'eastus'
  'northeurope'
])
param location string

@allowed([
  'Standard_LRS'
  'Standard_GRS'
  'Standard_RAGRS'
  'Standard_ZRS'
  'Premium_LRS'
  'Premium_ZRS'
  'Standard_GZRS'
  'Standard_RAGZRS'
])
param stSKU string = 'Standard_LRS'

resource sa 'Microsoft.Storage/storageAccounts@2022-09-01' = {
  name: storageAccountName
  location: location
  sku: {
    name: stSKU
  }
  kind: 'StorageV2'
   properties: {
     accessTier: 'Hot'
   }
}

output storageAccountId string = sa.id
output storageAccountName string = sa.name
