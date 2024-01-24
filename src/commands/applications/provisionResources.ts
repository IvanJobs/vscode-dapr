// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { IActionContext } from '@microsoft/vscode-azext-utils';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import { getLocalizationPathForFile } from '../../util/localization';
import DaprToAcaTaskProvider, { DaprToAcaTaskDefinition, LocalDaprApplication } from '../../tasks/daprToAcaTaskProvider';
import * as path from 'path';
const util = require('node:util');
const exec = util.promisify(require('node:child_process').exec);

const localize = nls.loadMessageBundle(getLocalizationPathForFile(__filename));

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
    let fileName = "createRg.bicep";
    let fileFullPath = workspace.uri.fsPath + "\\templates\\provision\\" + fileName;
    const rgName = "testAcaRg1";

    // creating a resource group
    let command = "az deployment sub create" +
        " --name createAcaRgTestDeploy" + 
        " --location southeastasia" + 
        " --template-file " + fileFullPath +
        " --parameters resourceGroupName=" + rgName + 
        " resourceGroupLocation=southeastasia --debug";

    console.log("Begin to create resource group... \n");
    if (! await execCmd(command)) {
      console.error("Creating resource group unsuccessfully! \n");
      return;
    }
    
    console.log("Begin to create all provisioning resources... \n");
    fileName = "main.bicep";
    fileFullPath = workspace.uri.fsPath + "\\templates\\provision\\" + fileName;
    //creating a container registry
    command = "az deployment group create " + 
        " --name provisionResourcesDeploy " + 
        " --resource-group " + rgName +
        " --template-file " + fileFullPath;

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