"use strict";

/**
 * node tests/run.js            everything (browser tests skip if no Chrome)
 * node tests/run.js --unit     unit tests only, no browser needed
 *
 * No dependencies and no package.json, matching the extension itself.
 */

const { summary } = require("./lib/harness");
const { findBrowser } = require("./lib/chrome");

const unitOnly = process.argv.includes("--unit");

const suites = [
  ["unit", require("./unit/spring.test.js")],
  ["unit", require("./unit/reorder.test.js")],
];

if (!unitOnly) {
  suites.push(["browser", require("./browser/sound-dropdown.test.js")]);
  suites.push(["browser", require("./browser/queue-drag.test.js")]);
}

const browser = findBrowser();
console.log("INSV Refresh test suite");
console.log(unitOnly ? "unit tests only" : browser ? "browser: " + browser : "browser: none found (browser tests will skip)");

for (const [, suite] of suites) suite();

process.exit(summary() ? 0 : 1);
