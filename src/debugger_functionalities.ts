import * as vscode from 'vscode';
import * as debug from 'asp-debugger';
import path = require('path');
import fs = require('fs');
import { checkCurrentFile, checkWorkspace } from './linkings_functionalities';

let musesCalculator = new debug.MUSesCalculator();
let musesNumber = 0;
let musIndex = 0;
let nonGroundRules: Set<string>[];

let files: string[];

let decorationIndex = 0;
let decorationTypes : vscode.TextEditorDecorationType[] = [];
decorationTypes.push( vscode.window.createTextEditorDecorationType({
	backgroundColor: 'rgba(245, 184, 42, 0.3)',
	rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed
}));
decorationTypes.push( vscode.window.createTextEditorDecorationType({
	backgroundColor: 'rgba(247, 127, 7, 0.3)',
	rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed
}));

let outputChannel: vscode.OutputChannel | null = null;
let activeTextEditorListener: vscode.Disposable | null = null;


function decorateEditor(editor: vscode.TextEditor | undefined, rulesToFiles: Map<string, string[]>, groundRules: Map<string, string[]>) {
	if (!editor) return;

	if (rulesToFiles.has(editor.document.fileName)) {
		const sourceCode = editor.document.getText();
		const decorationsArray: vscode.DecorationOptions[] = [];

		for (const nonGroundRule of rulesToFiles.get(editor.document.fileName)!) {
			const start = sourceCode.indexOf(nonGroundRule);
			if (start != -1) {
				const range = new vscode.Range(
					editor.document.positionAt(start),
					editor.document.positionAt(start + nonGroundRule.length)
				);

				let instantiations = groundRules.get(nonGroundRule)
				let stringOfInstances: string = "";

				if (instantiations !== undefined) {
					stringOfInstances = '**Ground instantiations**\n\n';
					for (const instance of instantiations) {
						stringOfInstances = stringOfInstances.concat(instance, '\n\n')
					}
				}    

				let decoration: vscode.DecorationOptions = {
					hoverMessage: stringOfInstances,
					range: range
				}
				decorationsArray.push(decoration)
			}
		}

		editor.setDecorations(decorationTypes[decorationIndex], decorationsArray)
	}
}

function decorateRules(musIndex: number) {
	removeDecorations();

	let groundRules: Map<string, string[]> = musesCalculator.getGroundRulesForMUS(musIndex);

	if (nonGroundRules && nonGroundRules.length > 1)
		vscode.commands.executeCommand('setContext', 'answer-set-programming-plugin.areMultipleMUSesPresent', true);
	else
		return;
	let filesToRules = outputFilesContainingMuses(nonGroundRules);
	//Decorate the active editor if necessary

	decorateEditor(vscode.window.activeTextEditor, filesToRules, groundRules);
	activeTextEditorListener = vscode.window.onDidChangeActiveTextEditor(editor => {
		decorateEditor(editor, filesToRules, groundRules);
	});
}


function outputFilesContainingMuses(nonGroundRules: Set<string>[]): Map<string, string[]> {
	let filesToRules: Map<string, string[]> = new Map<string, string[]>();
	for (const file of files) {
		const content = fs.readFileSync(file);

		for (const nonGroundRule of nonGroundRules[musIndex]) {
			const start = content.indexOf(nonGroundRule);
			if (start != -1) {
				if (!filesToRules.has(file))
					filesToRules.set(file, []);
				filesToRules.get(file)!.push(nonGroundRule);
			}
		}
	}

	//Find in which file every rule is located and print it in the output channel
	if (!outputChannel)
		outputChannel = vscode.window.createOutputChannel("Debugger");
	outputChannel.clear();
	outputChannel.show(true);

	outputChannel.appendLine("These rules may be causing issues in the program (MUS " + (musIndex + 1) +  " of " + musesNumber +  "):");

	for (const file of filesToRules.keys()) {
		outputChannel.appendLine("In file " + file + ":")
		for (const rule of filesToRules.get(file)!) {
			outputChannel.appendLine(rule);
		}
		outputChannel.appendLine("");
	}

	return filesToRules;
}


function removeDecorations() {
	for(let i = 0; i < decorationTypes.length; ++i)
		vscode.window.activeTextEditor!.setDecorations(decorationTypes[i], []);
	outputChannel?.clear();
	activeTextEditorListener?.dispose();
}

function highlightMUSes(): void {
	removeDecorations();
	const activeEditor = vscode.window.activeTextEditor;

	if (checkCurrentFile()) {

		vscode.commands.executeCommand('setContext', 'answer-set-programming-plugin.areMultipleMUSesPresent', false);

		try {
			if (checkWorkspace(false)) {
				const linkings_file_path = path.join(vscode.workspace.workspaceFolders![0].uri.fsPath, ".linkings.json");
				const missingFiles = debug.Linker.purgeAndGetMissingFiles(linkings_file_path, activeEditor!.document.fileName);
				
				if(missingFiles.length != 0)
					vscode.window.showErrorMessage("The following files were linked to the file in focus but are missing:", {"modal": true, "detail": missingFiles.join('\n')});
    
				files = debug.Linker.getLinkedFiles(activeEditor!.document.fileName, linkings_file_path);
			}
			else
				files = [activeEditor!.document.fileName];

			let myMuses = musesCalculator.calculateMUSes(files, 10);
			nonGroundRules = musesCalculator.getNonGroundRulesForMUSes();
			musesNumber = myMuses.length;
			musIndex = 0;

			decorateRules(musIndex);

		} catch (error) {
			vscode.window.showErrorMessage("There was a problem calculating the MUSes: " + error);
		}
	}
}

function getNextMus(): void {
	if(checkCurrentFile()) {
		musIndex = (musIndex + 1) % musesNumber;
		decorationIndex = (decorationIndex + 1) % decorationTypes.length;
		decorateRules(musIndex);
	}
}

function getPreviousMus(): void {
	if(checkCurrentFile()) {
		musIndex = musIndex - 1;
		if (musIndex == -1)
			musIndex = musesNumber - 1;
		decorationIndex = (decorationIndex + 1) % decorationTypes.length;
		decorateRules(musIndex);
	}
}	

export function initializeDebuggerFunctionalities(context: vscode.ExtensionContext) {
	context.subscriptions.push(vscode.commands.registerCommand('answer-set-programming-plugin.highlightMuses', highlightMUSes));

	context.subscriptions.push(vscode.commands.registerCommand('answer-set-programming-plugin.getNextMus', getNextMus));

	context.subscriptions.push(vscode.commands.registerCommand('answer-set-programming-plugin.getPreviousMus', getPreviousMus));
}