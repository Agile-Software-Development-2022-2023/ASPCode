"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeDebuggerFunctionalities = void 0;
const vscode = require("vscode");
const debug = require("asp-debugger");
const decorationType = vscode.window.createTextEditorDecorationType({
    backgroundColor: 'rgba(255, 137, 46, 0.3)'
});
function highlightNonGroundRules(editor, non_ground_rules) {
    const sourceCode = editor.document.getText();
    const decorationsArray = [];
    for (const non_ground_rule of non_ground_rules.keys()) {
        const start = sourceCode.indexOf(non_ground_rule);
        if (start != -1) {
            const range = new vscode.Range(editor.document.positionAt(start), editor.document.positionAt(start + non_ground_rule.length));
            const decoration = { range };
            decorationsArray.push(decoration);
        }
    }
    editor.setDecorations(decorationType, decorationsArray);
}
function removeDecorations(editor) {
    editor.setDecorations(decorationType, []);
}
function initializeDebuggerFunctionalities(context) {
    context.subscriptions.push(vscode.commands.registerCommand('answer-set-programming-plugin.highlightMuses', () => {
        if (vscode.window.activeTextEditor) {
            try {
                const musesCalculator = new debug.MUSesCalculator();
                musesCalculator.calculateMUSes([vscode.window.activeTextEditor.document.fileName], 1);
                const non_ground_rules = musesCalculator.getNonGroundRulesForMUSes();
                if (non_ground_rules && non_ground_rules.length > 0)
                    highlightNonGroundRules(vscode.window.activeTextEditor, non_ground_rules[0]);
                else
                    removeDecorations(vscode.window.activeTextEditor);
            }
            catch (error) {
                vscode.window.showErrorMessage("There was a problem calculating the MUSes: " + error);
            }
        }
    }));
}
exports.initializeDebuggerFunctionalities = initializeDebuggerFunctionalities;
//# sourceMappingURL=debugger_functionalities.js.map