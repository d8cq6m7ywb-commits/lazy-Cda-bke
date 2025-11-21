// fit-entry.js
const { FIT } = require('./fit-file-parser');

// your parsing / UI glue
function parseFitFile(arrayBuffer) {
  // use FIT + your own logic here
}

// expose to browser
window.YousuliFit = {
  FIT,
  parseFitFile,
};
