// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { initializeDebuggerFunctionalities } from './debugger_functionalities';
import { initializeLinkingsFunctionalities } from './linkings_functionalities';
import { initializeGroundingSolvingFunctionalities } from './grounding_solving_functionalities';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	initializeDebuggerFunctionalities(context);
	initializeLinkingsFunctionalities(context);
	initializeGroundingSolvingFunctionalities(context);
}

// this method is called when your extension is deactivated
export function deactivate() {}