"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeDebuggerFunctionalities = void 0;
const vscode = require("vscode");
const debug = require("asp-debugger");
let myHoverDisposable = null;
const decorationType = vscode.window.createTextEditorDecorationType({
    backgroundColor: 'rgba(255, 137, 46, 0.3)',
    rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed
});
function highlightNonGroundRules(editor, non_ground_rules, ground_rules, context) {
    const sourceCode = editor.document.getText();
    const decorationsArray = [];
    for (const non_ground_rule of non_ground_rules.keys()) {
        const start = sourceCode.indexOf(non_ground_rule);
        if (start != -1) {
            const range = new vscode.Range(editor.document.positionAt(start), editor.document.positionAt(start + non_ground_rule.length));
            let instantiations = ground_rules.get(non_ground_rule);
            let string_of_instances = "";
            if (instantiations !== undefined) {
                string_of_instances = '**Ground instantiations**\n\n';
                for (const instance of instantiations) {
                    string_of_instances = string_of_instances.concat(instance, '\n\n');
                }
            }
            const decoration = {
                hoverMessage: string_of_instances,
                range: range
            };
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
            let non_ground_rules = null;
            let ground_rules;
            let musesCalculator = new debug.MUSesCalculator();
            try {
                musesCalculator.calculateMUSes([vscode.window.activeTextEditor.document.fileName], 1);
            }
            catch (error) {
                vscode.window.showErrorMessage("There was a problem calculating the MUSes: " + error);
            }
            non_ground_rules = musesCalculator.getNonGroundRulesForMUSes();
            ground_rules = musesCalculator.getGroundRulesForMUS(0);
            //Only consider the first MUS for now
            if (non_ground_rules && non_ground_rules.length > 0)
                highlightNonGroundRules(vscode.window.activeTextEditor, non_ground_rules[0], ground_rules, context);
            else
                removeDecorations(vscode.window.activeTextEditor);
        }
    }));
}
exports.initializeDebuggerFunctionalities = initializeDebuggerFunctionalities;
//# sourceMappingURL=debugger_functionalities.js.map