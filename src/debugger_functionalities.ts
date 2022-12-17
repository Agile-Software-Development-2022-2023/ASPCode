import * as vscode from 'vscode';
import * as debug from 'asp-debugger';
import path = require('path');
import fs = require('fs');

let musesCalculator = new debug.MUSesCalculator();
let musesNumber = 0;
let musIndex = 0;
let lastActiveEditor: vscode.TextEditor | undefined;

let files: string[];

let decorationType = vscode.window.createTextEditorDecorationType({
	backgroundColor: 'rgba(255, 137, 46, 0.3)',
	rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed
});

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

		editor.setDecorations(decorationType, decorationsArray)
	}
}

function decorateRules(files: string[], musIndex: number) {
	removeDecorations();

	let nonGroundRules: Set<string>[] = musesCalculator.getNonGroundRulesForMUSes();
	let groundRules: Map<string, string[]> = musesCalculator.getGroundRulesForMUS(musIndex);

	if (nonGroundRules && nonGroundRules.length > 1)
		vscode.commands.executeCommand('setContext', 'answer-set-programming-plugin.areMultipleMUSesPresent', true);

	let filesToRules = outputFilesContainingMuses(nonGroundRules);
	//Decorate the active editor if necessary
	decorateEditor(lastActiveEditor, filesToRules, groundRules);
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
	outputChannel.show();

	outputChannel.appendLine("These rules may be causing issues in the program:");

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
	vscode.window.activeTextEditor?.setDecorations(decorationType, []);
	outputChannel?.clear();
}

function highlightMUSes(): void {
	removeDecorations();

	if (lastActiveEditor && lastActiveEditor.document.languageId == "asp") {

		vscode.commands.executeCommand('setContext', 'answer-set-programming-plugin.areMultipleMUSesPresent', false);

		try {
			if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length != 0) {
				const linkings_file_path = path.join(vscode.workspace.workspaceFolders![0].uri.fsPath, ".linkings.json");
				files = debug.Linker.getLinkedFiles(lastActiveEditor.document.fileName, linkings_file_path);
			}
			else
				files = [lastActiveEditor.document.fileName];

			let myMuses = musesCalculator.calculateMUSes(files, 0);
			musesNumber = myMuses.length;
			musIndex = 0;

			decorateRules(files, musIndex);

		} catch (error) {
			vscode.window.showErrorMessage("There was a problem calculating the MUSes: " + error);
		}
	}
}

function getNextMus(): void {
	musIndex = (musIndex + 1) % musesNumber;
	decorateRules(files, musIndex);
}

function getPreviousMus(): void {
	musIndex = musIndex - 1;
	if (musIndex == -1)
		musIndex = musesNumber - 1;
	decorateRules(files, musIndex);
}

export function initializeDebuggerFunctionalities(context: vscode.ExtensionContext) {
	lastActiveEditor = vscode.window.activeTextEditor;
	activeTextEditorListener = vscode.window.onDidChangeActiveTextEditor(editor => {
		if (editor?.document.languageId == "asp") {
			lastActiveEditor = editor;
		}
	});
	context.subscriptions.push(vscode.commands.registerCommand('answer-set-programming-plugin.highlightMuses', highlightMUSes));

	context.subscriptions.push(vscode.commands.registerCommand('answer-set-programming-plugin.getNextMus', getNextMus));

	context.subscriptions.push(vscode.commands.registerCommand('answer-set-programming-plugin.getPreviousMus', getPreviousMus));
}