targetScope= 'resourceGroup'

param location string = 'southeastasia'
param resourcePrefix string = 'ksdmm'

var minReplicaCount = 1
var maxReplicaCount = 3

@description('Specify the name of the Azure Redis Cache to create.')
param redisCacheName string = 'redisCache-${uniqueString(resourceGroup().id)}'

@description('Acr name.')
param acrName string

@description('Aca environment name.')
param acaEnvName string

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

resource userManagedIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2022-01-31-preview' = {
  name: '${resourcePrefix}umsi'
  location: location
}

resource acrPullRole 'Microsoft.Authorization/roleDefinitions@2022-04-01' existing = {
  scope: containerRegistry
  name: '7f951dda-4ed3-4680-a7ca-43fe172d538d'
}

resource roleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(containerRegistry.id, containerAppEnv.id)
  scope: containerRegistry
  properties: {
    roleDefinitionId: acrPullRole.id
    principalId: userManagedIdentity.properties.principalId
    principalType: 'ServicePrincipal'
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
    name: 'test-container-app-comp'
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
          value: redisCache.properties.hostName
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

// resource calculatorApp 'Microsoft.App/containerApps@2023-05-01' = {
//   name: '${resourcePrefix}calculatorapp'
//   location: location
//   identity: {
//     type: 'UserAssigned'
//     userAssignedIdentities: {
//       '${userManagedIdentity.id}': {}
//     }
//   }
//   properties: {
//     environmentId: containerAppEnv.id
//     configuration: {
//       dapr: {
//         appId: 'calculatorapp'
//         appPort: 8080
//         enabled: true
//       }
//       ingress: {
//         external: true
//         targetPort: 8080
//         allowInsecure: false
//         traffic: [
//           {
//             latestRevision: true
//             weight: 100
//           }
//         ]
//       }
//       registries: [
//         {
//           identity: userManagedIdentity.id
//           server: '${acrName}.azurecr.io'
//         }
//       ]
//     }
//     template: {
//       revisionSuffix: 'firstrevision'
//       containers: [
//         {
//           name: 'calculatorapp'
//           image: '${acrName}.azurecr.io/calculatorapp:latest'
//           resources: {
//             cpu: json('.25')
//             memory: '.5Gi'
//           }
//         }
//       ]
//       scale: {
//         minReplicas: minReplicaCount
//         maxReplicas: maxReplicaCount
//         rules: [
//           {
//             name: 'http-requests'
//             http: {
//               metadata: {
//                 concurrentRequests: '10'
//               }
//             }
//           }
//         ]
//       }
//     }
//   }
// }

// resource additionApp 'Microsoft.App/containerApps@2023-05-01' = {
//   name: '${resourcePrefix}additionapp'
//   location: location
//   identity: {
//     type: 'UserAssigned'
//     userAssignedIdentities: {
//       '${userManagedIdentity.id}': {}
//     }
//   }
//   properties: {
//     environmentId: containerAppEnv.id
//     configuration: {
//       dapr: {
//         appId: 'additionapp'
//         appPort: 4000
//         enabled: true
//       }
//       ingress: {
//         external: true
//         targetPort: 4000
//         allowInsecure: false
//         traffic: [
//           {
//             latestRevision: true
//             weight: 100
//           }
//         ]
//       }
//       registries: [
//         {
//           identity: userManagedIdentity.id
//           server: '${acrName}.azurecr.io'
//         }
//       ]
//     }
//     template: {
//       revisionSuffix: 'firstrevision'
//       containers: [
//         {
//           name: 'additionapp'
//           image: '${acrName}.azurecr.io/additionapp:latest'
//           resources: {
//             cpu: json('.25')
//             memory: '.5Gi'
//           }
//         }
//       ]
//       scale: {
//         minReplicas: minReplicaCount
//         maxReplicas: maxReplicaCount
//         rules: [
//           {
//             name: 'http-requests'
//             http: {
//               metadata: {
//                 concurrentRequests: '10'
//               }
//             }
//           }
//         ]
//       }
//     }
//   }
// }

// resource subtractionApp 'Microsoft.App/containerApps@2023-05-01' = {
//   name: '${resourcePrefix}subtractionapp'
//   location: location
//   identity: {
//     type: 'UserAssigned'
//     userAssignedIdentities: {
//       '${userManagedIdentity.id}': {}
//     }
//   }
//   dependsOn: [
//     roleAssignment
//   ]
//   properties: {
//     environmentId: containerAppEnv.id
//     configuration: {
//       dapr: {
//         appId: 'subtractionapp'
//         appPort: 5000
//         enabled: true
//       }
//       ingress: {
//         external: true
//         targetPort: 5000
//         allowInsecure: false
//         traffic: [
//           {
//             latestRevision: true
//             weight: 100
//           }
//         ]
//       }
//       registries: [
//         {
//           identity: userManagedIdentity.id
//           server: '${acrName}.azurecr.io'
//         }
//       ]
//     }
//     template: {
//       revisionSuffix: 'firstrevision'
//       containers: [
//         {
//           name: 'subtractionapp'
//           image: '${acrName}.azurecr.io/subtractionapp:latest'
//           resources: {
//             cpu: json('.25')
//             memory: '.5Gi'
//           }
//         }
//       ]
//       scale: {
//         minReplicas: minReplicaCount
//         maxReplicas: maxReplicaCount
//         rules: [
//           {
//             name: 'http-requests'
//             http: {
//               metadata: {
//                 concurrentRequests: '10'
//               }
//             }
//           }
//         ]
//       }
//     }
//   }
// }
