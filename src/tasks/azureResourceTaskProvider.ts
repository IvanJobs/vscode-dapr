// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import CustomExecutionTaskProvider from "./customExecutionTaskProvider";
import { TaskDefinition } from './taskDefinition';
import { PseudoterminalWriter } from './taskPseudoterminalWriter';
import { AzureResourceManager } from '../services/azureResourceManager';
import { CancellationToken } from "vscode";

export type AzureResourceTaskProviderCallback = (definition: TaskDefinition, writer: PseudoterminalWriter, token?: CancellationToken) => Promise<void>;

export interface DaprDeployTaskDefinition extends TaskDefinition {
    type: "dapr-deploy";
    azure: Azure;
}

export interface Azure {
    subscriptionId?: string;
    resourceGroup?: string;
    containerRegistry?: string;
    containerRegistryResourceGroup?: string;
    location?: string;
}

export default class AzureResourceTaskProvider extends CustomExecutionTaskProvider {
    constructor(
        azureResourceManager: AzureResourceManager,
        callback: AzureResourceTaskProviderCallback) {
        super(
            (definition, writer, token) => {
                const daprDefinition = definition as DaprDeployTaskDefinition;
                if (!daprDefinition.azure || !daprDefinition.azure.subscriptionId || !daprDefinition.azure.resourceGroup || !daprDefinition.azure.location) {
                    writer.writeLine("[vscode-dapr] subscription or resourceGroup or location cannot be null")
                    return Promise.reject()
                }
                writer.writeLine(`[vscode-dapr] creating or reusing resourceGroup ${daprDefinition.azure.resourceGroup} in subscription ${daprDefinition.azure.subscriptionId}`)
                azureResourceManager.createResourceGroupIfNotExists(daprDefinition.azure.subscriptionId, daprDefinition.azure.resourceGroup, daprDefinition.azure.location)

                return callback(definition, writer, token)
            },
            /* isBackgroundTask: */ true,
            /* problemMatchers: */ ['$dapr']);
    }
}