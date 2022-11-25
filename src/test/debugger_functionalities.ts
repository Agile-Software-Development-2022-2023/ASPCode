import * as vscode from 'vscode'
import * as debug from 'asp-debugger';

const decorationType = vscode.window.createTextEditorDecorationType({
	backgroundColor: 'rgba(255, 137, 46, 0.3)'
});
	
function highlightNonGroundRules(editor: vscode.TextEditor, non_ground_rules: Set<string>) {

	const sourceCode = editor.document.getText()

	const decorationsArray: vscode.DecorationOptions[] = []

	for(const non_ground_rule of non_ground_rules.keys()) {

		const start = sourceCode.indexOf(non_ground_rule);

		if(start != -1) {
			const range = new vscode.Range(
				editor.document.positionAt(start),
				editor.document.positionAt(start + non_ground_rule.length)
			);

			const decoration = { range }
		  
			decorationsArray.push(decoration)
		}
	}

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

                //Only consider the first MUS for now
				if(non_ground_rules && non_ground_rules.length > 0)
					highlightNonGroundRules(vscode.window.activeTextEditor, non_ground_rules[0]);
                else
                    removeDecorations(vscode.window.activeTextEditor);
			} catch (error) {
				vscode.window.showErrorMessage("There was a problem calculating the MUSes: " + error);
			}
		}
	}));
}