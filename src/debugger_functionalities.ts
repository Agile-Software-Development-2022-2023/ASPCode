import * as vscode from 'vscode';
import * as debug from 'asp-debugger';
import path = require('path');
import fs = require('fs');

const decorationType = vscode.window.createTextEditorDecorationType({
	backgroundColor: 'rgba(255, 137, 46, 0.3)',
	rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed
});

let outputChannel: vscode.OutputChannel | null = null;

let activeTextEditorListener: vscode.Disposable | null = null;

function decorateEditor(editor: vscode.TextEditor | undefined, rulesToFiles: Map<string, string[]>, ground_rules: Map<string, string[]>) {
	if(!editor) return;

	if(rulesToFiles.has(editor.document.fileName)) {
		const sourceCode = editor.document.getText();
		const decorationsArray: vscode.DecorationOptions[] = [];

		for(const non_ground_rule of rulesToFiles.get(editor.document.fileName)!) {

			const start = sourceCode.indexOf(non_ground_rule);
	
			if(start != -1) {
				const range = new vscode.Range(
					editor.document.positionAt(start),
					editor.document.positionAt(start + non_ground_rule.length)
				);
				
				let instantiations = ground_rules.get(non_ground_rule)
				let string_of_instances : string = "";
				if (instantiations !== undefined) {
					string_of_instances = '**Ground instantiations**\n\n'
					for(const instance of instantiations) {
						string_of_instances = string_of_instances.concat(instance, '\n\n')
					}
				}
	
				const decoration: vscode.DecorationOptions = {
					hoverMessage: string_of_instances,
					range: range
				}
				decorationsArray.push(decoration)
			}
		}
	
		editor.setDecorations(decorationType, decorationsArray)
	}
}
	
function decorateRules(files: string[], non_ground_rules: Set<string>, ground_rules: Map<string, string[]>) {

	activeTextEditorListener?.dispose();

	//Find in which file every rule is located and print it in the output channel
	if(!outputChannel)
		outputChannel = vscode.window.createOutputChannel("Debugger");
	outputChannel.clear();
	outputChannel.show();

	let filesToRules: Map<string, string[]> = new Map<string, string[]>();
	for(const file of files) {
		const content = fs.readFileSync(file);

		for(const non_ground_rule of non_ground_rules) {
			const start = content.indexOf(non_ground_rule);
			if(start != -1) {
				if(!filesToRules.has(file))
					filesToRules.set(file, []);
				filesToRules.get(file)!.push(non_ground_rule);
			}
		}
	}

	outputChannel.appendLine("These rules may be causing issues in the program:");

	for(const file of filesToRules.keys()) {
		outputChannel.appendLine("In file " + file + ":")
		for(const rule of filesToRules.get(file)!) {
			outputChannel.appendLine(rule);
		}
		outputChannel.appendLine("");
	}
	
	//Decorate the active editor if necessary
	decorateEditor(vscode.window.activeTextEditor, filesToRules, ground_rules);
	//Set up a listener which decorates an editor when it is opened
	activeTextEditorListener = vscode.window.onDidChangeActiveTextEditor(editor => {
		decorateEditor(editor, filesToRules, ground_rules);
	});
	
}

function removeDecorations() {
	vscode.window.activeTextEditor?.setDecorations(decorationType, []);
	outputChannel?.clear();
	activeTextEditorListener?.dispose();
}

export function initializeDebuggerFunctionalities(context: vscode.ExtensionContext) {
    context.subscriptions.push(vscode.commands.registerCommand('answer-set-programming-plugin.highlightMuses', () => {
		if(vscode.window.activeTextEditor && vscode.window.activeTextEditor.document.languageId == "asp") {
			
			let non_ground_rules: Set<string>[] | null = null;
			let ground_rules: Map<string, string[]>;
			let musesCalculator = new debug.MUSesCalculator();

			let files: string[];
			try {
				if(vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length != 0) {
					const linkings_file_path = path.join(vscode.workspace.workspaceFolders![0].uri.fsPath, ".linkings.json");
					files = debug.Linker.getLinkedFiles(vscode.window.activeTextEditor.document.fileName, linkings_file_path);
				}
				else
					files = [vscode.window.activeTextEditor.document.fileName];
				
				musesCalculator.calculateMUSes(files, 1);
				non_ground_rules = musesCalculator.getNonGroundRulesForMUSes();
				ground_rules = musesCalculator.getGroundRulesForMUS(0);
				//Only consider the first MUS for now
				if(non_ground_rules && non_ground_rules.length > 0)
					decorateRules(files, non_ground_rules[0], ground_rules);
				else
					removeDecorations();
			} catch (error) {
				vscode.window.showErrorMessage("There was a problem calculating the MUSes: " + error);
			}
		}
	}));
}