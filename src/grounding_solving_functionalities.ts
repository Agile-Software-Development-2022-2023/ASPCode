import * as vscode from 'vscode';
import * as debug from '@asp-debugger/asp-debugger';
import { checkCurrentFile, checkWorkspace } from './linkings_functionalities';
import path = require('path');

let outputChannel: vscode.OutputChannel | null = null;

function getLinkedFiles(currentFile: string) {
    let files = [currentFile];

    if(checkWorkspace(false)) {

        const path_to_linkings = path.join(vscode.workspace.workspaceFolders![0].uri.fsPath, ".linkings.json");
        try {
            const missingFiles = debug.Linker.purgeAndGetMissingFiles(path_to_linkings, currentFile);

            if(missingFiles.length != 0)
                vscode.window.showErrorMessage("The following files were linked to the file in focus but are missing:", {"modal": true, "detail": missingFiles.join('\n')});
    
            files = debug.Linker.getLinkedFiles(currentFile, path_to_linkings);
        } catch (error) {
            if(error instanceof debug.InvalidLinkingsError)
                vscode.window.showErrorMessage("There was a problem while reading the linked files: invalid linkings file");
        }
    }

    return files;
}

function getOutputChannel(): vscode.OutputChannel {
    if(!outputChannel)
        outputChannel = vscode.window.createOutputChannel("Grounding and solving");
    outputChannel.clear();
    outputChannel.show();
    return outputChannel;
}

function printOutput(output: string[], outputChannel: vscode.OutputChannel) {
    if(output[0] != "")
        outputChannel.appendLine(output[0]);
    if(output[1] != "")
        outputChannel.appendLine(output[1]);
}

export function initializeGroundingSolvingFunctionalities(context: vscode.ExtensionContext) {

    const grounder_solver = new debug.Grounder_Solver();

    context.subscriptions.push(vscode.commands.registerCommand("answer-set-programming-plugin.computeGroundProgram", () => {

        if(checkCurrentFile()) {

            const currentFile: string = vscode.window.activeTextEditor!.document.fileName!;

            const output: string[] = grounder_solver.ground(getLinkedFiles(currentFile));

            const outputChannel = getOutputChannel();
            printOutput(output, outputChannel);
        }
    }));

    context.subscriptions.push(vscode.commands.registerCommand("answer-set-programming-plugin.computeSingleAnswerSet", () => {

        if(checkCurrentFile()) {
            const currentFile: string = vscode.window.activeTextEditor!.document.fileName!;

            const output: string[] = grounder_solver.getFirstAnswerSet(getLinkedFiles(currentFile));

            const outputChannel = getOutputChannel();
            printOutput(output, outputChannel);
        }
    }));

    context.subscriptions.push(vscode.commands.registerCommand("answer-set-programming-plugin.computeAllAnswerSets", () => {
        
        if(checkCurrentFile()) {
            const currentFile: string = vscode.window.activeTextEditor!.document.fileName!;

            const output: string[] = grounder_solver.getAllAnswerSets(getLinkedFiles(currentFile));

            const outputChannel = getOutputChannel();
            printOutput(output, outputChannel);
        }
    }));
}