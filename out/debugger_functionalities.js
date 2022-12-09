"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeDebuggerFunctionalities = void 0;
const vscode = require("vscode");
const debug = require("asp-debugger");
const path = require("path");
const fs = require("fs");
const decorationType = vscode.window.createTextEditorDecorationType({
    backgroundColor: 'rgba(255, 137, 46, 0.3)',
    rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed
});
let outputChannel = null;
let activeTextEditorListener = null;
function decorateEditor(editor, rulesToFiles, ground_rules) {
    if (!editor)
        return;
    if (rulesToFiles.has(editor.document.fileName)) {
        const sourceCode = editor.document.getText();
        const decorationsArray = [];
        for (const non_ground_rule of rulesToFiles.get(editor.document.fileName)) {
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
}
function decorateRules(files, non_ground_rules, ground_rules) {
    activeTextEditorListener?.dispose();
    //Find in which file every rule is located and print it in the output channel
    if (!outputChannel)
        outputChannel = vscode.window.createOutputChannel("Debugger");
    outputChannel.clear();
    outputChannel.show();
    let filesToRules = new Map();
    for (const file of files) {
        const content = fs.readFileSync(file);
        for (const non_ground_rule of non_ground_rules) {
            const start = content.indexOf(non_ground_rule);
            if (start != -1) {
                if (!filesToRules.has(file))
                    filesToRules.set(file, []);
                filesToRules.get(file).push(non_ground_rule);
            }
        }
    }
    outputChannel.appendLine("These rules may be causing issues in the program:");
    for (const file of filesToRules.keys()) {
        outputChannel.appendLine("In file " + file + ":");
        for (const rule of filesToRules.get(file)) {
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
function initializeDebuggerFunctionalities(context) {
    context.subscriptions.push(vscode.commands.registerCommand('answer-set-programming-plugin.highlightMuses', () => {
        if (vscode.window.activeTextEditor && vscode.window.activeTextEditor.document.languageId == "asp") {
            let non_ground_rules = null;
            let ground_rules;
            let musesCalculator = new debug.MUSesCalculator();
            let files;
            try {
                if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length != 0) {
                    const linkings_file_path = path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, ".linkings.json");
                    files = debug.Linker.getLinkedFiles(vscode.window.activeTextEditor.document.fileName, linkings_file_path);
                }
                else
                    files = [vscode.window.activeTextEditor.document.fileName];
                musesCalculator.calculateMUSes(files, 1);
                non_ground_rules = musesCalculator.getNonGroundRulesForMUSes();
                ground_rules = musesCalculator.getGroundRulesForMUS(0);
                //Only consider the first MUS for now
                if (non_ground_rules && non_ground_rules.length > 0)
                    decorateRules(files, non_ground_rules[0], ground_rules);
                else
                    removeDecorations();
            }
            catch (error) {
                vscode.window.showErrorMessage("There was a problem calculating the MUSes: " + error);
            }
        }
    }));
}
exports.initializeDebuggerFunctionalities = initializeDebuggerFunctionalities;
//# sourceMappingURL=debugger_functionalities.js.map