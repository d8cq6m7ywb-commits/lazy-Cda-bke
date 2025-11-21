// fit-entry.js
// Minimal browser entry for fit-file-parser

const FitParserModule = require("fit-file-parser");

// Handle both CommonJS and default export
const FitParser = FitParserModule.default || FitParserModule;

// Expose constructor on window so index.html can use `window.FitParser`
window.FitParser = FitParser;
