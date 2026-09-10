"use strict";

/**
 * Zero-dependency test helpers.
 *
 * The extension has no build step and no package.json, so the tests match:
 * plain node, no runner, no assertion library. Everything runs with
 * `node tests/run.js`.
 */

const fs = require("fs");
const path = require("path");

const REPO = path.resolve(__dirname, "..", "..");

/** Read a repo file as text. */
function read(rel) {
  return fs.readFileSync(path.join(REPO, rel), "utf8");
}

/**
 * Pull a single top-level function out of a source file by brace matching.
 *
 * The scripts are plain globals loaded by <script> tags — there is nothing to
 * require() — so a unit test gets at one function by slicing it out and
 * eval'ing it with a stub environment around it.
 */
function extractFunction(source, name) {
  const start = source.indexOf("function " + name + "(");
  if (start < 0) throw new Error("extractFunction: no such function: " + name);
  let depth = 0;
  for (let i = source.indexOf("{", start); i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}") {
      depth--;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error("extractFunction: unbalanced braces in " + name);
}

/** Slice everything from a marker to end of file (used for util.js's motion section). */
function extractFrom(source, marker) {
  const i = source.indexOf(marker);
  if (i < 0) throw new Error("extractFrom: marker not found: " + marker);
  return source.slice(i);
}

// ---- assertions -------------------------------------------------------------

let passed = 0;
let failed = 0;
const failures = [];

function check(label, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  record(ok, label, ok ? "" : "got " + JSON.stringify(got) + ", want " + JSON.stringify(want));
}

function ok(label, condition, detail) {
  record(!!condition, label, condition ? "" : detail || "");
}

function record(isOk, label, detail) {
  if (isOk) {
    passed++;
    console.log("  PASS  " + label);
  } else {
    failed++;
    failures.push(label + (detail ? " — " + detail : ""));
    console.log("  FAIL  " + label + (detail ? "  " + detail : ""));
  }
}

function section(title) {
  console.log("\n" + title);
  console.log("-".repeat(title.length));
}

function summary() {
  console.log("\n" + "=".repeat(60));
  console.log(failed ? failed + " FAILED, " + passed + " passed" : "all " + passed + " checks pass");
  if (failures.length) failures.forEach((f) => console.log("  - " + f));
  return failed === 0;
}

module.exports = { REPO, read, extractFunction, extractFrom, check, ok, section, summary };
