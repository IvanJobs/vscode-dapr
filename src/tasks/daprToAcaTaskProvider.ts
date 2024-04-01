// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { AzureResourceManager } from "../services/azureResourceManager";
import { TelemetryProvider } from "../services/telemetryProvider";
import AzureResourceTaskProvider, { DaprDeployTaskDefinition } from "./azureResourceTaskProvider";
import { IActionContext } from "@microsoft/vscode-azext-utils";
import path from "path";


export interface DaprToAcaTaskDefinition extends DaprDeployTaskDefinition {
    app: LocalDaprApplication;
    workspace?: string;
}

export interface LocalDaprApplication {
    appID: string;
    command: string;
    appPort: number | undefined;
    appDirPath: string;
    daprHTTPPort: number;
    dockerfile: string | undefined;
    ingress: boolean;
}

export default class DaprToAcaTaskProvider extends AzureResourceTaskProvider {
    constructor(
        telemetryProvider: TelemetryProvider,
        azureResourceManager: AzureResourceManager
    ) {
        super(azureResourceManager, (definition, writer, token) => {
            return telemetryProvider.callWithTelemetry<void>(
                "vscode-dapr.tasks.deploy",
                async (context: IActionContext) => {
                    const daprDefinition = definition as DaprToAcaTaskDefinition;
                    if (!daprDefinition.azure.subscriptionId || !daprDefinition.azure.resourceGroup ) {
                        throw new Error(
                            "Azure subscriptionId or resourceGroupName or location could not be null"
                        );
                    }

                    if (!daprDefinition.environment) {
                        throw new Error(
                            "Azure container apps environment name cannot be null"
                        );
                    }

                    var environment = await azureResourceManager.getContainerAppEnvironment(daprDefinition.azure.subscriptionId, daprDefinition.azure.resourceGroup, daprDefinition.azure.containerAppEnvName)

                    var app = daprDefinition.app;
                    writer.writeLine(`[vscode-dapr] uploading source code from ${app.appDirPath}...`)
                    const sourceLocation = await azureResourceManager.uploadSourceCodeToBlob(
                        daprDefinition.azure.subscriptionId ?? "",
                        daprDefinition.azure.resourceGroup ?? "",
                        daprDefinition.azure.containerRegistryName ?? "",
                        path.resolve(daprDefinition.workspace??"", app.appDirPath)
                    )
                    writer.writeLine(`[vscode-dapr] source code uploaded to ${sourceLocation}`)
                    writer.writeLine(`[vscode-dapr] building image for ${app.appID}...`)
                    var imageName = `${app.appID}:${Date.now()}`
                    await azureResourceManager.buildImageWithContainerRegistry(
                        daprDefinition.azure.subscriptionId ?? "",
                        daprDefinition.azure.resourceGroup ?? "",
                        daprDefinition.azure.containerRegistryName ?? "",
                        sourceLocation,
                        imageName,
                        writer
                    )
                    writer.writeLine(`[vscode-dapr] build finished ${app.appID}`)

                    writer.writeLine(
                        `[vscode-dapr] deploying to container apps ${app.appID} in ${daprDefinition.environment}...`
                    );
                    await azureResourceManager.createOrUpdateContainerApp(
                        daprDefinition.azure.subscriptionId ?? "",
                        daprDefinition.azure.resourceGroup ?? "",
                        environment,
                        app,
                        `${daprDefinition.azure.containerRegistryName}.azurecr.io/${imageName}`
                    );

                    writer.writeLine(
                        `[vscode-dapr] Container apps ${app.appID} in ${daprDefinition.environment} deployment completed`
                    );
                    return Promise.resolve()
                }
            );
        });
    }
}
