// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { IActionContext } from '@microsoft/vscode-azext-utils';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import { getLocalizationPathForFile } from '../../util/localization';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import DaprToAcaTaskProvider, { DaprToAcaTaskDefinition, LocalDaprApplication } from '../../tasks/daprToAcaTaskProvider';
import { Project, scanFolderForMicroservice } from './buildApp';

const localize = nls.loadMessageBundle(getLocalizationPathForFile(__filename));

export async function deployToAca(runTemplateFile: string, taskProvider: DaprToAcaTaskProvider): Promise<void> {
  var yamlString = fs.readFileSync(runTemplateFile, 'utf8');
  // Parse the YAML string into an object
  var data = yaml.load(yamlString, {});

  var project = data as Project
  if (!project.microservices.root) {
      return Promise.reject("micro service project root should defined")
  }

  var deployExecutions: Promise<vscode.TaskExecution>[] = []    
  var microservices = scanFolderForMicroservice(path.resolve(path.dirname(runTemplateFile), project.microservices.root))
  for (const ms of microservices) {
    var local: LocalDaprApplication = {
      appID: ms.symbol,
      command: ms.run?.command ?? "",
      appPort: ms.run?.servicePort,
      appDirPath: ms.path,
      daprHTTPPort: ms.run?.sidecarHttpPort?? 8000,
      dockerfile: path.resolve(ms.path, "Dockerfile"),
      ingress: true 
    }
    var taskDefinition: DaprToAcaTaskDefinition = {
      type: "dapr-deploy",
      azure: project.azure,
      app: local,
      environment: vscode.workspace.name,
      workspace: path.dirname(runTemplateFile)
    }
    const resolvedTask = await taskProvider.resolveTask(
      new vscode.Task(
        taskDefinition,
        vscode.TaskScope.Workspace,
        `${localize("vscode-dapr.builds.deploying", "deploying")} ${ms.symbol}`,
        "Dapr"
      )
    );
  
    if (!resolvedTask) {
      throw new Error(localize('commands.applications.startRun.unresolvedTask', 'Unable to resolve a task for the deploy.'));
    }
    
    deployExecutions.push(new Promise((resolve, reject) => {
      vscode.tasks.executeTask(resolvedTask).then(resolve, reject)
    }));
  }

  await Promise.all(deployExecutions);
}

const createDeployToAcaCommand = (daprToAcaTaskProvider: DaprToAcaTaskProvider) => (context: IActionContext, uri: vscode.Uri): Promise<void> => {
  const folder = vscode.workspace.workspaceFolders?.[0];

  if (folder === undefined) {
    throw new Error(localize('commands.applications.startRun.noWorkspaceFolder', 'Starting a Dapr run requires an open workspace.'));
  }

  return deployToAca(uri.fsPath, daprToAcaTaskProvider);
}

export default createDeployToAcaCommand