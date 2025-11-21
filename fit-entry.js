// fit-entry.js
const FitParserModule = require("fit-file-parser");
const FitParser = FitParserModule.default || FitParserModule;

// expose constructor globally for the browser code in index.html
window.FitParser = FitParser;
