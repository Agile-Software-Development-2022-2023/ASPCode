"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeDebuggerFunctionalities = void 0;
const vscode = require("vscode");
const debug = require("asp-debugger");
const path = require("path");
const fs = require("fs");
const linkings_functionalities_1 = require("./linkings_functionalities");
let musesCalculator = new debug.MUSesCalculator();
let musesNumber = 0;
let musIndex = 0;
let nonGroundRules;
let hoverMessages = new Map;
let decorationMap = new Map;
let files;
let decorationIndex = 0;
let decorationTypes = [];
decorationTypes.push(vscode.window.createTextEditorDecorationType({
    backgroundColor: 'rgba(245, 184, 42, 0.3)',
    rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed
}));
decorationTypes.push(vscode.window.createTextEditorDecorationType({
    backgroundColor: 'rgba(247, 127, 7, 0.3)',
    rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed
}));
let outputChannel = null;
let activeTextEditorListener = null;
function decorateEditor(editor, rulesToFiles, groundRules, isMUS) {
    if (!editor)
        return;
    if (rulesToFiles.has(editor.document.fileName)) {
        const sourceCode = editor.document.getText();
        for (const nonGroundRule of rulesToFiles.get(editor.document.fileName)) {
            const start = sourceCode.indexOf(nonGroundRule);
            if (start != -1) {
                const range = new vscode.Range(editor.document.positionAt(start), editor.document.positionAt(start + nonGroundRule.length));
                let instantiations = groundRules.get(nonGroundRule);
                let stringOfInstances = "";
                let hoverMessage;
                if (instantiations !== undefined) {
                    if (isMUS)
                        stringOfInstances = '**Ground instantiations**\n\n';
                    else
                        stringOfInstances = '**Ground instantiations which would have been derived**\n\n';
                    for (const instance of instantiations) {
                        stringOfInstances = stringOfInstances.concat(instance, '\n\n');
                    }
                    if (!hoverMessages.has(nonGroundRule)) {
                        hoverMessages.set(nonGroundRule, "");
                    }
                    hoverMessage = hoverMessages.get(nonGroundRule).concat('\n\n\n\n' + stringOfInstances);
                    hoverMessages.set(nonGroundRule, hoverMessage);
                }
                let decoration = {
                    hoverMessage: hoverMessage,
                    range: range
                };
                decorationMap.set(nonGroundRule, decoration);
            }
        }
    }
}
function decorateRules(musIndex) {
    removeDecorations();
    let groundRules = musesCalculator.getGroundRulesForMUS(musIndex);
    if (nonGroundRules && nonGroundRules.length > 1)
        vscode.commands.executeCommand('setContext', 'answer-set-programming-plugin.areMultipleMUSesPresent', true);
    let filesToRules = new Map;
    if (nonGroundRulesContainValidSets(nonGroundRules)) {
        filesToRules = outputFilesContainingMuses(nonGroundRules, "These rules may be causing issues in the program (MUS " + (musIndex + 1) + " of " + musesNumber + "):", true);
        //Decorate the active editor if necessary
        decorateEditor(vscode.window.activeTextEditor, filesToRules, groundRules, true);
    }
    //Every time that rules are decorated, even missing support rules must to be decoreted.
    let missingSupportRules = musesCalculator.getMissingSupportRulesFromMUS(musIndex);
    let filesWithMissingSupportRules;
    let convertedMissingSupportMap = new Map;
    if (missingSupportRules.size !== 0)
        filterEmptySetFromMissingSupportRules(missingSupportRules);
    if (missingSupportRules.size > 0) {
        filesWithMissingSupportRules = outputFilesContainingMuses(missingSupportRules, "These rules may be affected by missing support issues in the program (MUS " + (musIndex + 1) + " of " + musesNumber + "):", false);
        missingSupportRules.forEach((value, key) => {
            Array.from(value).forEach((nonGround) => {
                if (!convertedMissingSupportMap.has(nonGround)) {
                    convertedMissingSupportMap.set(nonGround, []);
                }
                convertedMissingSupportMap.get(nonGround).push(key);
            });
        });
        decorateEditor(vscode.window.activeTextEditor, filesWithMissingSupportRules, convertedMissingSupportMap, false);
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
function filterEmptySetFromMissingSupportRules(missingSupportRules) {
    let firstEmptySet = false;
    for (const groundRule of missingSupportRules.keys()) {
        if (missingSupportRules.get(groundRule).size == 0) {
            if (!firstEmptySet)
                firstEmptySet = true;
            if (!outputChannel)
                outputChannel = vscode.window.createOutputChannel("Debugger");
            outputChannel.show(true);
            if (firstEmptySet)
                outputChannel.appendLine("These ground atoms can not be generated cause missing support issues (MUS " + (musIndex + 1) + " of " + musesNumber + "):");
            outputChannel.appendLine(groundRule);
            missingSupportRules.delete(groundRule);
        }
    }
    if (firstEmptySet)
        outputChannel.appendLine("");
}
function showDecorations(editor) {
    let decorationsArray = Array.from(decorationMap.values());
    if (decorationsArray.length != 0)
        editor.setDecorations(decorationTypes[decorationIndex], decorationsArray);
}
function nonGroundRulesContainValidSets(nonGroundRules) {
    if (nonGroundRules.length > 1)
        return true;
    if (nonGroundRules.length == 1) {
        if (nonGroundRules[0].size == 0)
            return false;
        return true;
    }
    return false;
}
function iterateOverMissingSupportRules(filesToRules, missingSupportRules, content, file) {
    for (const setOfNonGroundRule of missingSupportRules.values()) {
        setOfNonGroundRule.forEach(nonGroundRule => {
            const start = content.indexOf(nonGroundRule);
            if (start != -1) {
                if (!filesToRules.has(file))
                    filesToRules.set(file, []);
                filesToRules.get(file).push(nonGroundRule);
            }
        });
    }
}
function iterateOverMUSesRules(filesToRules, nonGroundRules, content, file) {
    for (const nonGroundRule of nonGroundRules[musIndex]) {
        const start = content.indexOf(nonGroundRule);
        if (start != -1) {
            if (!filesToRules.has(file))
                filesToRules.set(file, []);
            filesToRules.get(file).push(nonGroundRule);
        }
    }
}
function outputFilesContainingMuses(nonGroundRules, lineToAppend, toClear) {
    let filesToRules = new Map();
    for (const file of files) {
        const content = fs.readFileSync(file);
        if (nonGroundRules instanceof (Array))
            iterateOverMUSesRules(filesToRules, nonGroundRules, content, file);
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
        outputChannel.appendLine("In file " + file + ":");
        for (const rule of filesToRules.get(file)) {
            outputChannel.appendLine(rule);
        }
        outputChannel.appendLine("");
    }
    return filesToRules;
}
function removeDecorations() {
    for (let i = 0; i < decorationTypes.length; ++i) {
        vscode.window.activeTextEditor.setDecorations(decorationTypes[i], []);
    }
    outputChannel?.clear();
    activeTextEditorListener?.dispose();
}
function highlightMUSes() {
    hoverMessages.clear();
    decorationMap.clear();
    removeDecorations();
    decorationIndex = 0;
    const activeEditor = vscode.window.activeTextEditor;
    if ((0, linkings_functionalities_1.checkCurrentFile)()) {
        vscode.commands.executeCommand('setContext', 'answer-set-programming-plugin.areMultipleMUSesPresent', false);
        try {
            if ((0, linkings_functionalities_1.checkWorkspace)(false)) {
                const linkings_file_path = path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, ".linkings.json");
                const missingFiles = debug.Linker.purgeAndGetMissingFiles(linkings_file_path, activeEditor.document.fileName);
                if (missingFiles.length != 0)
                    vscode.window.showErrorMessage("The following files were linked to the file in focus but are missing:", { "modal": true, "detail": missingFiles.join('\n') });
                files = debug.Linker.getLinkedFiles(activeEditor.document.fileName, linkings_file_path);
            }
            else
                files = [activeEditor.document.fileName];
            let myMuses = musesCalculator.calculateMUSes(files, 10);
            nonGroundRules = musesCalculator.getNonGroundRulesForMUSes();
            musesNumber = myMuses.length;
            musIndex = 0;
            if (musesNumber != 0)
                decorateRules(musIndex);
        }
        catch (error) {
            if (error instanceof debug.InvalidLinkingsError)
                vscode.window.showErrorMessage("There was a problem reading the linked files: invalid linking file");
            else
                vscode.window.showErrorMessage("There was a problem calculating the MUSes: " + error);
        }
    }
}
function getNextMus() {
    if ((0, linkings_functionalities_1.checkCurrentFile)()) {
        hoverMessages.clear();
        decorationMap.clear();
        musIndex = (musIndex + 1) % musesNumber;
        decorationIndex = (decorationIndex + 1) % decorationTypes.length;
        decorateRules(musIndex);
    }
}
function getPreviousMus() {
    if ((0, linkings_functionalities_1.checkCurrentFile)()) {
        hoverMessages.clear();
        decorationMap.clear();
        musIndex = musIndex - 1;
        if (musIndex == -1)
            musIndex = musesNumber - 1;
        decorationIndex = (decorationIndex + 1) % decorationTypes.length;
        decorateRules(musIndex);
    }
}
function initializeDebuggerFunctionalities(context) {
    context.subscriptions.push(vscode.commands.registerCommand('answer-set-programming-plugin.highlightMuses', highlightMUSes));
    context.subscriptions.push(vscode.commands.registerCommand('answer-set-programming-plugin.getNextMus', getNextMus));
    context.subscriptions.push(vscode.commands.registerCommand('answer-set-programming-plugin.getPreviousMus', getPreviousMus));
}
exports.initializeDebuggerFunctionalities = initializeDebuggerFunctionalities;
//# sourceMappingURL=debugger_functionalities.js.map