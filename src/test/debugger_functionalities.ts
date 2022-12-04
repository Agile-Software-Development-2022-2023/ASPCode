import * as vscode from 'vscode'
import * as debug from 'asp-debugger';
import { privateEncrypt } from 'crypto';
import { Context } from 'mocha';

let myHoverDisposable : vscode.Disposable | null = null;

const decorationType = vscode.window.createTextEditorDecorationType({
	backgroundColor: 'rgba(255, 137, 46, 0.3)'
});
	
function highlightNonGroundRules(editor: vscode.TextEditor, non_ground_rules: Set<string>, ground_rules: Map<string, string[]>, context: vscode.ExtensionContext) {

	const sourceCode = editor.document.getText()
	const decorationsArray: vscode.DecorationOptions[] = []
	let hovers : vscode.Hover[] = [];

	for(const non_ground_rule of non_ground_rules.keys()) {

		const start = sourceCode.indexOf(non_ground_rule);

		if(start != -1) {
			const range = new vscode.Range(
				editor.document.positionAt(start),
				editor.document.positionAt(start + non_ground_rule.length)
			);

			const decoration = { range }
			decorationsArray.push(decoration)
			
			let string_of_instances : string = "";
			let instantiations = ground_rules.get(non_ground_rule)
			if (instantiations !== undefined) {
				string_of_instances = '**Ground instantiations**\n\n'
				for(const instance of instantiations) {
					string_of_instances = string_of_instances.concat(instance, '\n\n')
				}
			}

			hovers.push(new vscode.Hover(string_of_instances, range));
		}
	}

	if(myHoverDisposable) {
		myHoverDisposable.dispose();
	}

	myHoverDisposable = vscode.languages.registerHoverProvider('asp', {
		provideHover(document, position, token) {
			for(const hover of hovers) {
				if (hover.range?.contains(position))
					return hover;
			}
		}
	});

	editor.setDecorations(decorationType, decorationsArray)
}

function removeDecorations(editor: vscode.TextEditor) {
    editor.setDecorations(decorationType, []);
}

export function initializeDebuggerFunctionalities(context: vscode.ExtensionContext) {
    context.subscriptions.push(vscode.commands.registerCommand('answer-set-programming-plugin.highlightMuses', () => {
		if(vscode.window.activeTextEditor) {
			
			try {
				const musesCalculator = new debug.MUSesCalculator();
				musesCalculator.calculateMUSes([vscode.window.activeTextEditor.document.fileName], 1);
				const non_ground_rules = musesCalculator.getNonGroundRulesForMUSes();
				const ground_rules = musesCalculator.getGroundRulesForMUS(0);

                //Only consider the first MUS for now
				if(non_ground_rules && non_ground_rules.length > 0)
					highlightNonGroundRules(vscode.window.activeTextEditor, non_ground_rules[0], ground_rules, context);
                else
                    removeDecorations(vscode.window.activeTextEditor);
			} catch (error) {
				vscode.window.showErrorMessage("There was a problem calculating the MUSes: " + error);
			}
		}
	}));
}