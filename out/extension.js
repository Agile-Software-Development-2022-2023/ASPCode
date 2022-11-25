"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const debugger_functionalities_1 = require("./test/debugger_functionalities");
// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
function activate(context) {
    (0, debugger_functionalities_1.initializeDebuggerFunctionalities)(context);
}
exports.activate = activate;
// this method is called when your extension is deactivated
function deactivate() { }
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map