"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeDebuggerFunctionalities = void 0;
const vscode = require("vscode");
const debug = require("asp-debugger");
let myHoverDisposable = null;
const decorationType = vscode.window.createTextEditorDecorationType({
    backgroundColor: 'rgba(255, 137, 46, 0.3)'
});
function highlightNonGroundRules(editor, non_ground_rules, ground_rules, context) {
    const sourceCode = editor.document.getText();
    const decorationsArray = [];
    let hovers = [];
    for (const non_ground_rule of non_ground_rules.keys()) {
        const start = sourceCode.indexOf(non_ground_rule);
        if (start != -1) {
            const range = new vscode.Range(editor.document.positionAt(start), editor.document.positionAt(start + non_ground_rule.length));
            const decoration = { range };
            decorationsArray.push(decoration);
            let string_of_instances = "";
            let instantiations = ground_rules.get(non_ground_rule);
            if (instantiations !== undefined) {
                string_of_instances = '**Ground instantiations**\n\n';
                for (const instance of instantiations) {
                    string_of_instances = string_of_instances.concat(instance, '\n\n');
                }
            }
            hovers.push(new vscode.Hover(string_of_instances, range));
        }
    }
    if (myHoverDisposable) {
        myHoverDisposable.dispose();
    }
    myHoverDisposable = vscode.languages.registerHoverProvider('asp', {
        provideHover(document, position, token) {
            for (const hover of hovers) {
                if (hover.range?.contains(position))
                    return hover;
            }
        }
    });
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
                const ground_rules = musesCalculator.getGroundRulesForMUS(0);
                //Only consider the first MUS for now
                if (non_ground_rules && non_ground_rules.length > 0)
                    highlightNonGroundRules(vscode.window.activeTextEditor, non_ground_rules[0], ground_rules, context);
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
//# sourceMappingURL=debugger_functionalities_2.js.map