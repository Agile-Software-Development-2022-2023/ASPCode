import * as vscode from 'vscode';
import * as debug from 'asp-debugger';
import path = require('path');

//Checks if there is a workspace loaded in which to search for the linkings file
export function checkWorkspace(workspaceRequired: boolean) {
    if(!(vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length != 0)) {
        if(workspaceRequired) 
            vscode.window.showErrorMessage("A workspace must be open to use this functionality")
        return false;
    }
    return true;
}

//Check if the file with focus is a valid ASP file
export function checkCurrentFile(): boolean {
    if(!vscode.window.activeTextEditor) {
		vscode.window.showErrorMessage('Cannot execute command: No open file');
		return false;
	}

	if(vscode.window.activeTextEditor.document.languageId != "asp") {
		vscode.window.showErrorMessage("The file with focus (" + vscode.window.activeTextEditor.document.fileName + ") is not an asp file");
		return false;
	}

	return true;
}

export function initializeLinkingsFunctionalities(context: vscode.ExtensionContext) {

    let outputChannel: vscode.OutputChannel | null = null;

    context.subscriptions.push(vscode.commands.registerCommand("answer-set-programming-plugin.linkFiles", async function() {
        if(checkWorkspace(true) && checkCurrentFile()) {
            const path_to_file_in_focus = vscode.window.activeTextEditor!.document.fileName;

            //Prompts the user for files to link to the file currently in focus
            let result = await vscode.window.showOpenDialog(
                {
                    "title": "Choose files to link",
                    "openLabel" : "Link",
                    "filters" : {
                        "ASP" : ['lp', 'asp', 'dlv']
                    },
                    "canSelectMany" : true
                }
            );

            //If the operation was cancelled, or the only selected file was the one with focus, do nothing
            if(!result || result.length === 0 || (result.length === 1 && result[0].fsPath === path_to_file_in_focus)) 
                return;

            const linkings_file_path = path.join(vscode.workspace.workspaceFolders![0].uri.fsPath, ".linkings.json");
            const file_paths: string[] = result.map(value => value.fsPath);
            if(!file_paths.includes(path_to_file_in_focus))
                file_paths.push(path_to_file_in_focus);

            try {
                debug.Linker.linkFiles(file_paths, linkings_file_path);   
            } catch (error) {
                if(error instanceof debug.InvalidLinkingsError)
                    vscode.window.showErrorMessage("There was a problem while linking the files: invalid linkings file")
            }
            vscode.window.showInformationMessage("The files have been successfully linked");
        }
    }));

    context.subscriptions.push(vscode.commands.registerCommand("answer-set-programming-plugin.unlinkFiles", function() {
        if(checkWorkspace(true) && checkCurrentFile()) {
            const path_to_file_in_focus = vscode.window.activeTextEditor!.document.fileName;
            const linkings_file_path = path.join(vscode.workspace.workspaceFolders![0].uri.fsPath, ".linkings.json");

            try {
                debug.Linker.unlinkFile(path_to_file_in_focus, linkings_file_path);   
            } catch (error) {
                if(error instanceof debug.InvalidLinkingsError)
                    vscode.window.showErrorMessage("There was a problem while unlinking the file: invalid linkings file");
            }
            vscode.window.showInformationMessage("The file has been successfully unlinked");
        }
    }));

    context.subscriptions.push(vscode.commands.registerCommand("answer-set-programming-plugin.disbandPool", async function() {
        if(checkWorkspace(true) && checkCurrentFile()) {

            //Check if the action was intended as it is a dangerous operation
            let answer = await vscode.window.showWarningMessage("Are you sure you want to continue?", {"modal": true, "detail":"This operation will unlink this file and all files linked to it from each other."}, "Yes", "No")
            if(answer !== "Yes") return;

            const path_to_file_in_focus = vscode.window.activeTextEditor!.document.fileName;
            const linkings_file_path = path.join(vscode.workspace.workspaceFolders![0].uri.fsPath, ".linkings.json");

            try {
                debug.Linker.disbandFilePool(path_to_file_in_focus, linkings_file_path);
            } catch (error) {
                if(error instanceof debug.InvalidLinkingsError)
                    vscode.window.showErrorMessage("There was a problem while disbanding the pool: invalid linkings file");   
            }
            vscode.window.showInformationMessage("The pool has been successfully disbanded");
        }
    }));

    context.subscriptions.push(vscode.commands.registerCommand("answer-set-programming-plugin.viewAllPools", function() {
        if(checkWorkspace(true) && checkCurrentFile()) {
            if(!outputChannel)
                outputChannel = vscode.window.createOutputChannel("Linked files");
            outputChannel.clear();
            outputChannel.show();

            const linkings_file_path = path.join(vscode.workspace.workspaceFolders![0].uri.fsPath, ".linkings.json");

            try {
                const allPools: Object = debug.Linker.getAllPools(linkings_file_path); 
                if(Object.keys(allPools).length === 0)
                    outputChannel.appendLine("There are no linked files at the moment");
                else {
                    outputChannel.appendLine("Pools of linked files:");
                    for(const files of Object.values(allPools)) {
                        outputChannel.appendLine("Pool:");
                        for(const file of files)
                            outputChannel.appendLine(file);
                        outputChannel.appendLine("");
                    }
                }
            } catch (error) {
                if(error instanceof debug.InvalidLinkingsError)
                    vscode.window.showErrorMessage("There was a problem while reading the pools: invalid linkings file");
            }
        }
    }));

    context.subscriptions.push(vscode.commands.registerCommand("answer-set-programming-plugin.viewCurrentFilePool", function() {
        if(checkWorkspace(true) && checkCurrentFile()) {
            if(!outputChannel)
                outputChannel = vscode.window.createOutputChannel("Linked files");
            outputChannel.clear();
            outputChannel.show();

            const path_to_file_in_focus = vscode.window.activeTextEditor!.document.fileName;
            const linkings_file_path = path.join(vscode.workspace.workspaceFolders![0].uri.fsPath, ".linkings.json");

            try {
                const linkedFiles = debug.Linker.getLinkedFiles(path_to_file_in_focus, linkings_file_path);

                if(linkedFiles.length === 1)
                    outputChannel.appendLine("The file in focus is not linked to any other files");
                else {
                    outputChannel.appendLine("Current active file's pool:");
                    for(const file of linkedFiles) {
                        outputChannel.appendLine(file);
                    }
                }
            } catch (error) {
                if(error instanceof debug.InvalidLinkingsError)
                    vscode.window.showErrorMessage("There was a problem while reading the linked files: invalid linkings file");
            }
        }
    }))
}