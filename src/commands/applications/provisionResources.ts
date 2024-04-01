// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { IActionContext } from '@microsoft/vscode-azext-utils';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import { getLocalizationPathForFile } from '../../util/localization';
import DaprToAcaTaskProvider, { DaprToAcaTaskDefinition, LocalDaprApplication } from '../../tasks/daprToAcaTaskProvider';
import * as path from 'path';
import * as fs from 'fs';
import * as yaml from 'js-yaml';

const util = require('node:util');
const exec = util.promisify(require('node:child_process').exec);

const localize = nls.loadMessageBundle(getLocalizationPathForFile(__filename));

export interface Solution {
  version?: string
  name: string
  symbol: string
  microservices: Microservices
  infra: Infra
  azure: Azure
}

export interface Microservices {
  root?: string
  daprResourcesPath?: string
}

export interface Infra {
  root?: string
  kind?: string
}

export interface Azure {
  subscriptionId?: string
  resourceGroup?: string
  containerRegistryName?: string
  containerAppEnvName?: string
}


async function execCmd(command: string) {
  const { stdout, stderr } = await exec(command);

  if(stdout) {
    console.log("Excuting command : [" + command + "] successfully : \n", stdout);
    return true;
  }

  if(stderr) {
    console.error("Excuting command : [" + command + "] unsuccessfully : \n", stderr);
    return false;
  }
}

export async function provisioningResources(runTemplateFile: string, taskProvider: DaprToAcaTaskProvider): Promise<void> {
    const workspace = vscode.workspace.workspaceFolders?.[0];

    const solutionFileName = workspace?.uri.fsPath + "\\distributed-calculator.solution";
    const yamlString = fs.readFileSync(solutionFileName, 'utf8');
    // Parse the YAML string into an object
    const data = yaml.load(yamlString);

    const solution = data as Solution
    if (!solution.azure) {
        return Promise.reject("no enough definitions of provisioning resources in solution files")
    }

    const rgName=solution.azure.resourceGroup;

    // creating a resource group
    let command = "az group create --name " + rgName + " --location southeastasia";

    console.log("Begin to create resource group... \n");
    if (! await execCmd(command)) {
      console.error("Creating resource group unsuccessfully! \n");
      return;
    }
    
    console.log("Begin to create all provisioning resources... \n");
    const fileName = "allinone.bicep";
    const fileFullPath = workspace?.uri.fsPath + "\\infra\\" + fileName;
    const acrName = solution.azure.containerRegistryName;
    const acaEnvName = solution.azure.containerAppEnvName;
    //creating a container registry
    command = "az deployment group create " + 
        " --name provisionResourcesDeploy " + 
        " --resource-group " + rgName +
        " --template-file " + fileFullPath + 
        " --parameters acrName=" + acrName + 
        " acaEnvName=" + acaEnvName + " --debug";

    if (! await execCmd(command)) {
      console.error("Creating container registry unsuccessfully! \n");
      return;
    }

    console.log("Provisioning successfully!");
}

const createProvisioningCommand = (daprToAcaTaskProvider: DaprToAcaTaskProvider) => (context: IActionContext, uri: vscode.Uri): Promise<void> => {
  const folder = vscode.workspace.workspaceFolders?.[0];

  if (folder === undefined) {
    throw new Error(localize('commands.applications.startRun.noWorkspaceFolder', 'Starting a Dapr run requires an open workspace.'));
  }

  return provisioningResources(uri.fsPath, daprToAcaTaskProvider);
}

export default createProvisioningCommand