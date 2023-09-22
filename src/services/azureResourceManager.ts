// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as fs from 'fs';
import * as path from 'path';
import * as tar from 'tar'
import { TokenCredential } from "@azure/identity";
import { ManagedEnvironment, ContainerAppsAPIClient, ContainerApp } from "@azure/arm-appcontainers";
import { ResourceGroup, ResourceManagementClient } from '@azure/arm-resources';
import { LocalDaprApplication } from "../tasks/daprToAcaTaskProvider";
import { ContainerRegistryManagementClient, DockerBuildRequest, RegistriesGetBuildSourceUploadUrlResponse } from "@azure/arm-containerregistry";
import { BlockBlobClient } from "@azure/storage-blob";
import axios from 'axios';
import { PseudoterminalWriter } from '../tasks/taskPseudoterminalWriter';


export interface AzureResourceManager {
    createResourceGroupIfNotExists(subscriptionId: string, resourceGroupName: string, location: string): Promise<ResourceGroup>
    createContainerAppEnvironmentIfNotExists(subscriptionId: string, resourceGroupName: string, environmentName: string, location: string): Promise<ManagedEnvironment>
    createOrUpdateContainerApp(subscriptionId: string, resourceGroupName: string, environment: ManagedEnvironment, app: LocalDaprApplication, image: string): Promise<ContainerApp>
    uploadSourceCodeToBlob(subscriptionId: string, resourceGroupName: string, registryName: string, workspace: string): Promise<string>
    buildImageWithContainerRegistry(subscriptionId: string, resourceGroupName: string, registryName: string, sourceLocation: string, app: LocalDaprApplication, writer: PseudoterminalWriter): Promise<void>
}

export default class DefaultAzureResourceManager implements AzureResourceManager {
    
    constructor(private readonly credential: TokenCredential) {
    }

    createContainerAppEnvironmentIfNotExists(subscriptionId: string, resourceGroupName: string, environmentName: string, location: string): Promise<ManagedEnvironment> {
        const client = new ContainerAppsAPIClient(this.credential, subscriptionId);
        const environmentEnvelope: ManagedEnvironment = {
            infrastructureResourceGroup: resourceGroupName,
            location: location,
            zoneRedundant: false
        };

        const onExists = (managedEnvironment: ManagedEnvironment): Promise<ManagedEnvironment> => {
            return Promise.resolve(managedEnvironment);
        };

        const onMissing = (): Promise<ManagedEnvironment> => {
            return client.managedEnvironments.beginCreateOrUpdateAndWait(
                resourceGroupName,
                environmentName,
                environmentEnvelope
            )
        };

        return client.managedEnvironments.get(resourceGroupName, environmentName).then(onExists, onMissing);
    }

    createResourceGroupIfNotExists(subscriptionId: string, resourceGroupName: string, location: string): Promise<ResourceGroup> {
        const resourceGroupParameters = {
            location: location,
        };

        const resourceManagement = new ResourceManagementClient(
            this.credential,
            subscriptionId
        );

        const onExists = (resourceGroup: ResourceGroup): Promise<ResourceGroup> => {
            return Promise.resolve(resourceGroup)
        };

        const onMissing = (): Promise<ResourceGroup> => {
            return resourceManagement.resourceGroups.createOrUpdate(
                resourceGroupName,
                resourceGroupParameters
            );
        };

        return resourceManagement.resourceGroups.get(resourceGroupName).then(onExists).catch(onMissing);
    }

    createOrUpdateContainerApp(subscriptionId: string, resourceGroupName: string, environment: ManagedEnvironment, app: LocalDaprApplication, image: string): Promise<ContainerApp> {
        const client = new ContainerAppsAPIClient(this.credential, subscriptionId);

        const envelope: ContainerApp = {
            name: app.appID,
            environmentId: environment.id,
            location: environment.location,
            configuration: {
                dapr: {
                    appId: app.appID,
                    appProtocol: "http",
                    enabled: true,
                    appPort: app.appPort,
                },
            },
            template: {
                containers: [
                    {
                      name: app.appID,
                      image: image,
                    }
                ]
            }
        }
        if (app.ingress && envelope.configuration) {
            envelope.configuration.ingress = {
                external: app.ingress ?? false,
                targetPort: app.appPort,
                allowInsecure: true,
            }

        }
        return client.containerApps.beginCreateOrUpdateAndWait(resourceGroupName, app.appID, envelope)
    }

    uploadSourceCodeToBlob(subscriptionId: string, resourceGroupName: string, registryName: string, sourceLocation: string): Promise<string> {
        const client = new ContainerRegistryManagementClient(
            this.credential,
            subscriptionId
        );

        const onUploadSucceeded = (blobResponse: RegistriesGetBuildSourceUploadUrlResponse): Promise<string> => {
            const blockBlobClient = new BlockBlobClient(blobResponse.uploadUrl?? "");
            return new Promise<string> (
                (resolve, reject) => {
                    blockBlobClient.uploadStream(
                        tar.c({gzip: true, cwd: path.resolve(sourceLocation)}, fs.readdirSync(path.resolve(sourceLocation))),
                        4 * 1024 * 1024
                    ).then(() => resolve(blobResponse.relativePath ?? ""))  
                    .catch(reason => reject(reason))       
                }
            )
        }

        const onUploadFailed = (reason: any) => {
            return Promise.reject(reason)
        }
        
        return client.registries.getBuildSourceUploadUrl(
            resourceGroupName,
            registryName
        )
        .then(onUploadSucceeded)
        .catch(onUploadFailed)
    }

    async buildImageWithContainerRegistry(subscriptionId: string, resourceGroupName: string, registryName: string, sourceLocation: string, app: LocalDaprApplication, writer: PseudoterminalWriter): Promise<void> {
        const client = new ContainerRegistryManagementClient(
            this.credential,
            subscriptionId
        );
        
        const runRequest: DockerBuildRequest = {
            type: "DockerBuildRequest",
            agentConfiguration: { cpu: 2 },
            platform: { architecture: "amd64", os: "Linux" },
            arguments: [
            ],
            dockerFilePath: `Dockerfile`,
            sourceLocation: sourceLocation,
            imageNames: [`${app.appID}:latest`],
            isPushEnabled: true,
            noCache: true
        };
        const run = await client.registries.beginScheduleRunAndWait(
            resourceGroupName,
            registryName,
            runRequest
        )
        const logsas = await client.runs.getLogSasUrl(resourceGroupName, registryName, run.name??"")
        
        return this.tailRemoteURL(logsas.logLink??"", writer)
    }

    private tailRemoteURL(url: string, writer: PseudoterminalWriter, pollingInterval: number=1): Promise<void> {
        let lastPosition = 0;
        
        return new Promise(async (resolve, reject) => {
            while (true) {
                try {
                    const response = await axios.get(url, {
                        headers: {
                            Range: `bytes=${lastPosition}-`,
                        },
                    })
                    if (response.status === 206 && response.data) {
                    const newData = response.data;
                    writer.write(newData)
                    lastPosition += newData.length;
        
                    if (new RegExp("Run ID:.+was successful after").test(newData)) {
                        resolve();
                    }
                    } else if (response.status === 416) {
                        // If the server returns 416 Range Not Satisfiable, it means we reached the end of the file
                        reject()
                    } 
                }catch(error) {
                    // console.log(error)
                }   
            }      
        })
    }
}

