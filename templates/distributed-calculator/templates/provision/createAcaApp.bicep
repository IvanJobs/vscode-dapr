@description('Specifies the name of the container app.')
param containerAppName string = 'app-${uniqueString(resourceGroup().id)}'

@description('Specifies the location for all resources.')
param location string = resourceGroup().location

@description('Minimum number of replicas that will be deployed')
@minValue(0)
@maxValue(25)
param minReplica int = 1

@description('Maximum number of replicas that will be deployed')
@minValue(0)
@maxValue(25)
param maxReplica int = 3

param acrName string

param umiId string

param contaierAppEnvId string

resource containerApp 'Microsoft.App/containerApps@2022-06-01-preview' = {
  name: containerAppName
  location: location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${umiId}': {}
    }
  }
  properties: {
    managedEnvironmentId: contaierAppEnvId
    configuration: {
      ingress: {
        external: true
        targetPort: 80
        allowInsecure: false
        traffic: [
          {
            latestRevision: true
            weight: 100
          }
        ]
      }
      registries: [
        {
          identity: umiId
          server: '${acrName}.azurecr.io'
        }
      ]
    }
    template: {
      revisionSuffix: 'firstrevision'
      containers: [
        {
          name: 'front'
          image: '${acrName}.azurecr.io/frontendapp:latest'
          resources: {
            cpu: json('.25')
            memory: '.5Gi'
          }
        }
        // {
        //   name: 'add'
        //   image: '${acrName}.azurecr.io/addapp:latest'
        //   resources: {
        //     cpu: json('.25')
        //     memory: '.5Gi'
        //   }
        // }
        // {
        //   name: 'sub'
        //   image: '${acrName}.azurecr.io/substractapp:latest'
        //   resources: {
        //     cpu: json('.25')
        //     memory: '.5Gi'
        //   }
        // }
        // {
        //   name: 'multi'
        //   image: '${acrName}.azurecr.io/multiplyapp:latest'
        //   resources: {
        //     cpu: json('.25')
        //     memory: '.5Gi'
        //   }
        // }
        // {
        //   name: 'divide'
        //   image: '${acrName}.azurecr.io/divideapp:latest'
        //   resources: {
        //     cpu: json('.25')
        //     memory: '.5Gi'
        //   }
        // }
      ]
      scale: {
        minReplicas: minReplica
        maxReplicas: maxReplica
        rules: [
          {
            name: 'http-requests'
            http: {
              metadata: {
                concurrentRequests: '10'
              }
            }
          }
        ]
      }
    }
  }
}

output id string = containerApp.id 
