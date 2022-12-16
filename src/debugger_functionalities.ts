import * as vscode from 'vscode';
import * as debug from 'asp-debugger';
import path = require('path');
import fs = require('fs');

let musesCalculator = new debug.MUSesCalculator();
let musesNumber = 0;
let musIndex = 0;
let lastActiveEditor: vscode.TextEditor | undefined;

let files: string[];

const isASPRegExp = new RegExp('\.asp$');

// changed from const to let
let decorationType = vscode.window.createTextEditorDecorationType({
	backgroundColor: 'rgba(255, 137, 46, 0.3)',
	rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed
});

let outputChannel: vscode.OutputChannel | null = null;

let activeTextEditorListener: vscode.Disposable | null = null;

function printMap(map: Map<string, string[]>) {
	map.forEach((values, key) => {
		let string: string = key;
		for (const value of values) {
			string = string.concat(" " + value);
		}
		vscode.window.showInformationMessage(string);
	});
}

function decorateEditor(editor: vscode.TextEditor | undefined, rulesToFiles: Map<string, string[]>, ground_rules: Map<string, string[]>) {
	if (!editor) return;

	printMap(rulesToFiles);
	vscode.window.showInformationMessage(editor.document.fileName);

	if (rulesToFiles.has(editor.document.fileName)) {
		const sourceCode = editor.document.getText();
		const decorationsArray: vscode.DecorationOptions[] = [];


		for (const non_ground_rule of rulesToFiles.get(editor.document.fileName)!) {

			const start = sourceCode.indexOf(non_ground_rule);

			if (start != -1) {
				const range = new vscode.Range(
					editor.document.positionAt(start),
					editor.document.positionAt(start + non_ground_rule.length)
				);

				let instantiations = ground_rules.get(non_ground_rule)
				let stringOfInstances: string = "";


				if (instantiations !== undefined) {

					stringOfInstances = '**Ground instantiations **\n\n'
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

function decorateRules(files: string[], non_ground_rules: Set<string>, ground_rules: Map<string, string[]>) {
	removeDecorations();
	//Find in which file every rule is located and print it in the output channel
	if (!outputChannel)
		outputChannel = vscode.window.createOutputChannel("Debugger");
	outputChannel.clear();
	outputChannel.show();

	let filesToRules: Map<string, string[]> = new Map<string, string[]>();
	for (const file of files) {
		const content = fs.readFileSync(file);

		for (const non_ground_rule of non_ground_rules) {
			const start = content.indexOf(non_ground_rule);
			if (start != -1) {
				if (!filesToRules.has(file))
					filesToRules.set(file, []);
				filesToRules.get(file)!.push(non_ground_rule);
			}
		}
	}

	outputChannel.appendLine("These rules may be causing issues in the program:");

	for (const file of filesToRules.keys()) {
		outputChannel.appendLine("In file " + file + ":")
		for (const rule of filesToRules.get(file)!) {
			outputChannel.appendLine(rule);
		}
		outputChannel.appendLine("");
	}

	//Decorate the active editor if necessary
	decorateEditor(lastActiveEditor, filesToRules, ground_rules);
	//Set up a listener which decorates an editor when it is opened
	//active text editor also considers the plugin buttons, consider changing this method


}

function removeDecorations() {
	vscode.window.activeTextEditor?.setDecorations(decorationType, []);
	outputChannel?.clear();
}

function highlightMUSes(): void {
	removeDecorations();

	if (lastActiveEditor && lastActiveEditor.document.languageId == "asp") {

		vscode.commands.executeCommand('setContext', 'answer-set-programming-plugin.areMultipleMUSesPresent', false);

		let nonGroundRules: Set<string>[] | null = null;
		let groundRules: Map<string, string[]>;

		try {
			if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length != 0) {
				const linkings_file_path = path.join(vscode.workspace.workspaceFolders![0].uri.fsPath, ".linkings.json");
				files = debug.Linker.getLinkedFiles(lastActiveEditor.document.fileName, linkings_file_path);
			}
			else
				files = [lastActiveEditor.document.fileName];

			let myMuses = musesCalculator.calculateMUSes(files, 0);
			musesNumber = myMuses.length
			nonGroundRules = musesCalculator.getNonGroundRulesForMUSes();
			groundRules = musesCalculator.getGroundRulesForMUS(0);
			vscode.window.showErrorMessage(String(nonGroundRules.length))
			decorateRules(files, nonGroundRules[0], groundRules);
			decorateRules(files, nonGroundRules[0], groundRules);

			if (nonGroundRules && nonGroundRules.length > 1)
				vscode.commands.executeCommand('setContext', 'answer-set-programming-plugin.areMultipleMUSesPresent', true);
			//Only consider the first MUS for now
			if (nonGroundRules && nonGroundRules.length > 0)
				decorateRules(files, nonGroundRules[0], groundRules);
			else
				removeDecorations();
		} catch (error) {
			vscode.window.showErrorMessage("There was a problem calculating the MUSes: " + error);
		}
	}
}

function getNextMus(): void {
	removeDecorations();
	musIndex = (musIndex + 1) % musesNumber;
	let nonGroundRules = musesCalculator.getNonGroundRulesForMUSes();
	let groundRules = musesCalculator.getGroundRulesForMUS(musIndex);

	// va modificato decorateRules
	decorateRules(files, nonGroundRules[musIndex], groundRules);

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
}