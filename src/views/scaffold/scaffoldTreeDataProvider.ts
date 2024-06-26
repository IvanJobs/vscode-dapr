import * as vscode from 'vscode';
import TreeNode from '../treeNode';
import ScaffoldNode from './scaffoldNode';

export default class ScaffoldTreeDataProvider implements vscode.TreeDataProvider<TreeNode> {
  onDidChangeTreeData?: vscode.Event<TreeNode>;

  getTreeItem(element: TreeNode): vscode.TreeItem | Thenable<vscode.TreeItem> {
      return element.getTreeItem();
  }

  getChildren(): vscode.ProviderResult<TreeNode[]> {
      return [
        new ScaffoldNode(),
      ];
  }
}