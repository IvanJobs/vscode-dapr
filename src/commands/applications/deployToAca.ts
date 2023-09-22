// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { IActionContext } from '@microsoft/vscode-azext-utils';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import { getLocalizationPathForFile } from '../../util/localization';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import DaprToAcaTaskProvider, { DaprToAcaTaskDefinition } from '../../tasks/daprToAcaTaskProvider';

const localize = nls.loadMessageBundle(getLocalizationPathForFile(__filename));

export async function deployToAca(runTemplateFile: string, taskProvider: DaprToAcaTaskProvider): Promise<void> {
  var yamlString = fs.readFileSync(runTemplateFile, 'utf8');
  // Parse the YAML string into an object
  var data = yaml.load(yamlString, {});

  var taskDefinition = data as DaprToAcaTaskDefinition
  taskDefinition.environment = vscode.workspace.name
  taskDefinition.workspace = path.dirname(runTemplateFile)
  const resolvedTask = await taskProvider.resolveTask(
    new vscode.Task(
      taskDefinition,
      vscode.TaskScope.Workspace,
      `${localize("vscode-dapr.builds.deploying", "deploying")} ${taskDefinition.environment}`,
      "Dapr"
    )
  );

  if (!resolvedTask) {
    throw new Error(localize('commands.applications.startRun.unresolvedTask', 'Unable to resolve a task for the build.'));
  }

  await vscode.tasks.executeTask(resolvedTask);
}

const createDeployToAcaCommand = (daprToAcaTaskProvider: DaprToAcaTaskProvider) => (context: IActionContext, uri: vscode.Uri): Promise<void> => {
  const folder = vscode.workspace.workspaceFolders?.[0];

  if (folder === undefined) {
    throw new Error(localize('commands.applications.startRun.noWorkspaceFolder', 'Starting a Dapr run requires an open workspace.'));
  }

  return deployToAca(uri.fsPath, daprToAcaTaskProvider);
}

export default createDeployToAcaCommand