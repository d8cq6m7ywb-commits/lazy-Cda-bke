// fit-entry.js – small wrapper so Browserify can bundle fit-file-parser
// We import the real parser file from the dist folder and expose it on window.

const FitParserModule = require('fit-file-parser/dist/fit-parser.js');
const FitParser = FitParserModule.default || FitParserModule;

// Put it on the global so index.html can just use `new FitParser(...)`
window.FitParser = FitParser;
