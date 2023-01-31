import * as vscode from 'vscode';
import * as debug from 'asp-debugger';
import path = require('path');
import fs = require('fs');
import { checkCurrentFile, checkWorkspace } from './linkings_functionalities';

let musesCalculator = new debug.MUSesCalculator();
let musesNumber = 0;
let musIndex = 0;
let nonGroundRules: Set<string>[];
let hoverMessages: Map<string, string> =  new Map;
let decorationMap: Map<string, vscode.DecorationOptions> = new Map;

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


function decorateEditor(editor: vscode.TextEditor | undefined, rulesToFiles: Map<string, string[]>, groundRules: Map<string, string[]>, isMUS: boolean) {
	if (!editor) return;

	if (rulesToFiles.has(editor.document.fileName)) {
		const sourceCode = editor.document.getText();

		for (const nonGroundRule of rulesToFiles.get(editor.document.fileName)!) {
			const start = sourceCode.indexOf(nonGroundRule);
			if (start != -1) {
				const range = new vscode.Range(
					editor.document.positionAt(start),
					editor.document.positionAt(start + nonGroundRule.length)
				);

				let instantiations = groundRules.get(nonGroundRule)
				let stringOfInstances: string = "";
				let hoverMessage;
				if (instantiations !== undefined) {
					
					if (isMUS) 
						stringOfInstances = '**Ground instantiations**\n\n';
					else 
						stringOfInstances = '**Ground instantiations which would have been derived**\n\n';
					for (const instance of instantiations) {
						stringOfInstances = stringOfInstances.concat(instance, '\n\n')
					}
					if(!hoverMessages.has(nonGroundRule)) {
						hoverMessages.set(nonGroundRule, "");
					}
					hoverMessage = hoverMessages.get(nonGroundRule)!.concat('\n\n\n\n' + stringOfInstances)
					hoverMessages.set(nonGroundRule, hoverMessage);
				}    
				
				let decoration: vscode.DecorationOptions = {
					hoverMessage: hoverMessage,
					range: range
				}
				decorationMap.set(nonGroundRule, decoration);
			}
		}
	}
}

function decorateRules(musIndex: number) {
	removeDecorations();

	let groundRules: Map<string, string[]> = musesCalculator.getGroundRulesForMUS(musIndex);

	if (nonGroundRules && nonGroundRules.length > 1)
		vscode.commands.executeCommand('setContext', 'answer-set-programming-plugin.areMultipleMUSesPresent', true);
	
	let filesToRules: Map<string, string[]> = new Map;
	if (nonGroundRulesContainValidSets(nonGroundRules)) {
		filesToRules = outputFilesContainingMuses(nonGroundRules, "These rules may be causing issues in the program (MUS " + (musIndex + 1) +  " of " + musesNumber +  "):", true);
		//Decorate the active editor if necessary
		decorateEditor(vscode.window.activeTextEditor, filesToRules, groundRules, true);
	}

	//Every time that rules are decorated, even missing support rules must to be decoreted.
	let missingSupportRules = musesCalculator.getMissingSupportRulesFromMUS(musIndex);
	let filesWithMissingSupportRules : Map<string, string[]>;
	let convertedMissingSupportMap : Map<string, string[]> = new Map;
	if (missingSupportRules.size !== 0) 
		filterEmptySetFromMissingSupportRules(missingSupportRules);
	if (missingSupportRules.size > 0) {
		filesWithMissingSupportRules = outputFilesContainingMuses(missingSupportRules, "These rules may be affected by missing support issues in the program (MUS " + (musIndex + 1) +  " of " + musesNumber +  "):", false);
		missingSupportRules.forEach((value, key) => {
			Array.from(value).forEach((nonGround) => {
				if(!convertedMissingSupportMap.has(nonGround)) {
					convertedMissingSupportMap.set(nonGround, []);
				}
				convertedMissingSupportMap.get(nonGround)!.push(key);
			})
		});
		decorateEditor(vscode.window.activeTextEditor, filesWithMissingSupportRules, convertedMissingSupportMap, false)
	}

	showDecorations(vscode.window.activeTextEditor);

	activeTextEditorListener = vscode.window.onDidChangeActiveTextEditor(editor => {
		hoverMessages.clear();
		decorationMap.clear();

		decorateEditor(editor, filesToRules, groundRules, true);
		if (missingSupportRules.size !== 0)
			decorateEditor(editor, filesWithMissingSupportRules, convertedMissingSupportMap, false);
		
		showDecorations(editor);
	});
}

function filterEmptySetFromMissingSupportRules(missingSupportRules: Map<string, Set<string>>) {
	let firstEmptySet : boolean = false;
	for (const groundRule of missingSupportRules.keys()) {
		if (missingSupportRules.get(groundRule)!.size == 0) {
			if (!firstEmptySet)
				firstEmptySet = true;

			if (!outputChannel)
				outputChannel = vscode.window.createOutputChannel("Debugger");
			outputChannel.show(true);

			if (firstEmptySet)
				outputChannel.appendLine("These ground atoms can not be generated cause missing support issues (MUS " + (musIndex + 1) +  " of " + musesNumber +  "):");
			outputChannel.appendLine(groundRule);
			
			missingSupportRules.delete(groundRule);
		}
	}
	if (firstEmptySet)
		outputChannel!.appendLine("")
}

function showDecorations(editor: vscode.TextEditor | undefined) {
	let decorationsArray = Array.from(decorationMap.values());

	if(decorationsArray.length != 0)
		editor!.setDecorations(decorationTypes[decorationIndex], decorationsArray);
}

function nonGroundRulesContainValidSets(nonGroundRules: Set<string>[]): boolean {
	if (nonGroundRules.length > 1) 
		return true
	if (nonGroundRules.length == 1) {
		if (nonGroundRules[0].size == 0)
			return false
		return true
	}
	return false
}

function iterateOverMissingSupportRules(filesToRules: Map<string, string[]>, missingSupportRules: Map<string, Set<string>>, content: Buffer, file: string) {
	for (const setOfNonGroundRule of missingSupportRules.values()) {
		setOfNonGroundRule.forEach(nonGroundRule => {
			const start = content.indexOf(nonGroundRule);
			if (start != -1) {
				if (!filesToRules.has(file))
					filesToRules.set(file, []);
				filesToRules.get(file)!.push(nonGroundRule);
			}
		});
	}
}

function iterateOverMUSesRules(filesToRules: Map<string, string[]>, nonGroundRules: Set<string>[], content: Buffer, file: string) {
	for (const nonGroundRule of nonGroundRules[musIndex]) {
		const start = content.indexOf(nonGroundRule);
		if (start != -1) {
			if (!filesToRules.has(file))
				filesToRules.set(file, []);
			filesToRules.get(file)!.push(nonGroundRule);
		}
	}
}

function outputFilesContainingMuses(nonGroundRules: Map<string, Set<string>> | Set<string>[], lineToAppend: string, toClear: boolean): Map<string, string[]> {
	let filesToRules: Map<string, string[]> = new Map<string, string[]>();
	for (const file of files) {
		const content = fs.readFileSync(file);

		if (nonGroundRules instanceof Array<Set<string>>) 
			iterateOverMUSesRules(filesToRules, nonGroundRules, content, file)
		else
			iterateOverMissingSupportRules(filesToRules, nonGroundRules, content, file);
	}

	//Find in which file every rule is located and print it in the output channel
	if (!outputChannel)
		outputChannel = vscode.window.createOutputChannel("Debugger");
	if (toClear)
		outputChannel.clear();
	outputChannel.show(true);

	outputChannel.appendLine(lineToAppend);

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
	for(let i = 0; i < decorationTypes.length; ++i) {
		vscode.window.activeTextEditor!.setDecorations(decorationTypes[i], []);
	}
	outputChannel?.clear();
	activeTextEditorListener?.dispose();
}

function highlightMUSes(): void {
	hoverMessages.clear();
	decorationMap.clear();
	removeDecorations();
	decorationIndex = 0;
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

			if(musesNumber != 0) 
				decorateRules(musIndex);

		} catch (error) {
			if(error instanceof debug.InvalidLinkingsError)
				vscode.window.showErrorMessage("There was a problem reading the linked files: invalid linking file");
			else
				vscode.window.showErrorMessage("There was a problem calculating the MUSes: " + error);
		}
	}
}

function getNextMus(): void {
	if(checkCurrentFile()) {
		hoverMessages.clear();
		decorationMap.clear();
		musIndex = (musIndex + 1) % musesNumber;
		decorationIndex = (decorationIndex + 1) % decorationTypes.length;
		decorateRules(musIndex);
	}
}

function getPreviousMus(): void {
	if(checkCurrentFile()) {
		hoverMessages.clear();
		decorationMap.clear();
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