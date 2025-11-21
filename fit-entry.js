// fit-entry.js
// Browserify entry that exposes FitParser on window for index.html

const FitParserModule = require("fit-file-parser");
const FitParser = FitParserModule.default || FitParserModule;

// Expose constructor globally
window.FitParser = FitParser;
