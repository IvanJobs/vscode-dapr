// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { IActionContext } from '@microsoft/vscode-azext-utils';
import { getLocalizationPathForFile } from '../../util/localization';
import * as nls from 'vscode-nls';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as glob from 'glob';
import * as yaml from 'js-yaml';
import DaprBuildTaskProvider, {DaprBuildTaskDefinition} from '../../tasks/daprBuildTaskProvider';
import { Azure } from '../../tasks/azureResourceTaskProvider';

const localize = nls.loadMessageBundle(getLocalizationPathForFile(__filename));

export interface Project {
    version?: string
    name: string
    symbol: string
    microservices: Microservices
    azure: Azure
}

export interface Microservices {
    root?: string
    daprResourcesPath?: string
}

export interface Microservice {
    version?: string
    name: string
    symbol: string
    daprResourcesPath?: string
    build?: BuildCommand
    run?: RunCommand
    dependsOn?: string
    path: string
}

export interface BuildCommand {
    appPath: string
    command: string
    outputPath?: string
}

export interface RunCommand {
    command: string
    servicePort: number
    sidecarHttpPort: number
}  

interface DaprBuildConfiguration {
    apps?: DaprAppBuild[]
}

interface DaprAppBuild {
    appID?: string
    appDirPath?: string;
    buildCommands?: string[]
}

export async function startBuild(runTemplateFile: string, taskProvider: DaprBuildTaskProvider): Promise<void> {
    var yamlString = fs.readFileSync(runTemplateFile, 'utf8');
    const projectRoot = path.dirname(runTemplateFile)
    // Parse the YAML string into an object
    var data = yaml.load(yamlString);

    var project = data as Project
    if (!project.microservices.root) {
        return Promise.reject("micro service project root should defined")
    }

    var buildExecutions: Promise<vscode.TaskExecution>[] = []    
    var microservices = scanFolderForMicroservice(path.resolve(projectRoot, project.microservices.root))
    for (const ms of microservices) {
        if (!ms.path || !ms.build?.command) {
            continue
        }
        var cwd = ms.path;
        const taskDefinition: DaprBuildTaskDefinition = {
            type: "dapr-build",
            cwd: cwd,
            buildCommands: [ms.build.command]
        }
        
        const resolvedTask = await taskProvider.resolveTask(
            new vscode.Task(
                taskDefinition,
                vscode.TaskScope.Workspace,
                `${localize("vscode-dapr.builds.building", "building")} ${ms.symbol}`,
                "Dapr"
            )
        );

        if (!resolvedTask) {
            throw new Error(localize('commands.applications.startRun.unresolvedTask', 'Unable to resolve a task for the build.'));
        }
        buildExecutions.push(new Promise((resolve, reject) => {
            vscode.tasks.executeTask(resolvedTask).then(resolve, reject)
        }))
    }

    await Promise.all(buildExecutions)
}

const createBuildAppCommand = (taskProvider: DaprBuildTaskProvider) => (context: IActionContext, uri: vscode.Uri): Promise<void> => {
    const folder = vscode.workspace.workspaceFolders?.[0];

    if (folder === undefined) {
        throw new Error(localize('commands.applications.startRun.noWorkspaceFolder', 'Build Dapr apps requires an open workspace.'));
    }

    return startBuild(uri.fsPath, taskProvider);
}

export const scanFolderForMicroservice = (folder: string): Microservice[] => {
    var files = findFilesRecursively(folder, /.*\.microservice\.yaml/);
    var microservices: Microservice[] = []
    files.forEach((f: string) => {
        var yamlString = fs.readFileSync(f, 'utf8');
        var data = yaml.load(yamlString);
        var ms = data as Microservice;
        ms.path = path.dirname(f)
        microservices.push(ms)
    })

    return microservices;
}

function findFilesRecursively(directory: string, pattern: RegExp): string[] {
    const files: string[] = [];
  
    // Synchronously read the contents of a directory
    const entries = fs.readdirSync(directory);
  
    entries.forEach((entry) => {
      const entryPath = path.join(directory, entry);
      // Check if the entry is a directory
      if (fs.statSync(entryPath).isDirectory()) {
        // Recursively search for files in the subdirectory
        const subdirectoryFiles = findFilesRecursively(entryPath, pattern);
        files.push(...subdirectoryFiles);
      } else {
        // Check if the entry matches the specified pattern
        if (pattern.test(path.basename(entryPath))) {
          files.push(entryPath);
        }
      }
    });
  
    return files;
  }

export default createBuildAppCommand;