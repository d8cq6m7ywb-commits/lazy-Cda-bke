// fit-entry.js
// Browserify entry that exposes the FitParser constructor on window
// so index.html can use it.

const FitParserModule = require("fit-file-parser");

// According to the npm docs, the constructor is the default export.
// Fallbacks are defensive in case of different bundling.
const FitParser =
  (FitParserModule && FitParserModule.default) ||
  (FitParserModule && FitParserModule.FitParser) ||
  FitParserModule;

// Expose to the browser
if (typeof window !== "undefined") {
  window.FitParser = FitParser;

  // Also mirror the older UMD-style global just in case
  window.FIT = window.FIT || {};
  window.FIT.FitParser = FitParser;
}
