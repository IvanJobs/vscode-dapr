// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { AzureResourceManager } from "../services/azureResourceManager";
import { TelemetryProvider } from "../services/telemetryProvider";
import AzureResourceTaskProvider, { DaprDeployTaskDefinition } from "./azureResourceTaskProvider";
import { IActionContext } from "@microsoft/vscode-azext-utils";
import { Process, WrittenOutputHandler } from '../util/process';
import { workspace } from "vscode";
import path from "path";


export interface DaprToAcaTaskDefinition extends DaprDeployTaskDefinition {
    apps: LocalDaprApplication[];
    environment?: string;
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
                    if (
                        !daprDefinition.azure.subscriptionId ||
                        !daprDefinition.azure.resourceGroup ||
                        !daprDefinition.azure.location
                    ) {
                        throw new Error(
                            "Azure subscriptionId or resourceGroupName or location could not be null"
                        );
                    }

                    if (!daprDefinition.environment) {
                        throw new Error(
                            "Azure container apps environment name cannot be null"
                        );
                    }

                    writer.writeLine(
                        `[vscode-dapr] creating or reusing container apps environment ${daprDefinition.environment} under resourceGroup ${daprDefinition.azure.resourceGroup}`
                    );

                    const environment = await azureResourceManager
                        .createContainerAppEnvironmentIfNotExists(
                            daprDefinition.azure.subscriptionId,
                            daprDefinition.azure.resourceGroup,
                            daprDefinition.environment ?? "",
                            daprDefinition.azure.location
                        );

                    for (const app of daprDefinition.apps) {
                        writer.writeLine(`[vscode-dapr] uploading source code from ${app.appDirPath}...`)
                        const sourceLocation = await azureResourceManager.uploadSourceCodeToBlob(
                            daprDefinition.azure.subscriptionId ?? "",
                            daprDefinition.azure.containerRegistryResourceGroup ?? daprDefinition.azure.resourceGroup ?? "",
                            daprDefinition.azure.containerRegistry ?? "",
                            path.resolve(daprDefinition.workspace??"", app.appDirPath)
                        )
                        writer.writeLine(`[vscode-dapr] source code uploaded to ${sourceLocation}`)
                        writer.writeLine(`[vscode-dapr] building image for ${app.appID}...`)
                        await azureResourceManager.buildImageWithContainerRegistry(
                            daprDefinition.azure.subscriptionId ?? "",
                            daprDefinition.azure.containerRegistryResourceGroup ?? daprDefinition.azure.resourceGroup ?? "",
                            daprDefinition.azure.containerRegistry ?? "",
                            sourceLocation,
                            app,
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
                            `${daprDefinition.azure.containerRegistry}.azurecr.io/${app.appID}`
                        );
                    }

                    return Promise.resolve()
                }
            );
        });
    }
}
