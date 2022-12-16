"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeGroundingSolvingFunctionalities = void 0;
const vscode = require("vscode");
const debug = require("asp-debugger");
const linkings_functionalities_1 = require("./linkings_functionalities");
const path = require("path");
let outputChannel = null;
function getLinkedFiles(currentFile) {
    let files = [currentFile];
    if ((0, linkings_functionalities_1.checkWorkspace)(false)) {
        const path_to_linkings = path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, ".linkings.json");
        try {
            const missingFiles = debug.Linker.purgeAndGetMissingFiles(path_to_linkings, currentFile);
            if (missingFiles.length != 0)
                vscode.window.showErrorMessage("The following files were linked to the file in focus but are missing:", { "modal": true, "detail": missingFiles.join('\n') });
            files = debug.Linker.getLinkedFiles(currentFile, path_to_linkings);
        }
        catch (error) {
            if (error instanceof debug.InvalidLinkingsError)
                vscode.window.showErrorMessage("There was a problem while reading the linked files: invalid linkings file");
        }
    }
    return files;
}
function getOutputChannel() {
    if (!outputChannel)
        outputChannel = vscode.window.createOutputChannel("Grounding and solving");
    outputChannel.clear();
    outputChannel.show();
    return outputChannel;
}
function printOutput(output, outputChannel) {
    if (output[0] != "")
        outputChannel.appendLine(output[0]);
    if (output[1] != "")
        outputChannel.appendLine(output[1]);
}
function initializeGroundingSolvingFunctionalities(context) {
    const grounder_solver = new debug.Grounder_Solver();
    context.subscriptions.push(vscode.commands.registerCommand("answer-set-programming-plugin.computeGroundProgram", () => {
        if ((0, linkings_functionalities_1.checkCurrentFile)()) {
            const currentFile = vscode.window.activeTextEditor.document.fileName;
            const output = grounder_solver.ground(getLinkedFiles(currentFile));
            const outputChannel = getOutputChannel();
            printOutput(output, outputChannel);
        }
    }));
    context.subscriptions.push(vscode.commands.registerCommand("answer-set-programming-plugin.computeSingleAnswerSet", () => {
        if ((0, linkings_functionalities_1.checkCurrentFile)()) {
            const currentFile = vscode.window.activeTextEditor.document.fileName;
            const output = grounder_solver.getFirstAnswerSet(getLinkedFiles(currentFile));
            const outputChannel = getOutputChannel();
            printOutput(output, outputChannel);
        }
    }));
    context.subscriptions.push(vscode.commands.registerCommand("answer-set-programming-plugin.computeAllAnswerSets", () => {
        if ((0, linkings_functionalities_1.checkCurrentFile)()) {
            const currentFile = vscode.window.activeTextEditor.document.fileName;
            const output = grounder_solver.getAllAnswerSets(getLinkedFiles(currentFile));
            const outputChannel = getOutputChannel();
            printOutput(output, outputChannel);
        }
    }));
}
exports.initializeGroundingSolvingFunctionalities = initializeGroundingSolvingFunctionalities;
//# sourceMappingURL=grounding_solving_functionalities.js.map