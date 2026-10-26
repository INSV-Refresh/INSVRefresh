"use strict";

/**
 * Drive the real popup (or options page) in headless Chrome, with no
 * automation dependency.
 *
 * There is no puppeteer here and no package.json to add one to. Instead a probe
 * page is generated from the real popup.html — same scripts, same stylesheets,
 * only the chrome.* APIs stubbed — which runs a scripted interaction and writes
 * its findings into a <pre>. `chrome --dump-dom` prints the finished DOM and we
 * read the JSON back out. Crude, but it exercises the actual popup rather than
 * a re-creation of it, which is the whole point: both bugs these tests cover
 * were invisible to reasoning and only showed up under a real layout.
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFileSync } = require("child_process");
const { REPO, read } = require("./harness");

const CANDIDATES = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
];

function findBrowser() {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
  for (const c of CANDIDATES) if (fs.existsSync(c)) return c;
  return null;
}

/**
 * Enough of the extension APIs for a page to boot with a known set of queues.
 * Deliberately minimal: anything the pages do not need on load stays a no-op
 * so a missing stub surfaces as a visible error rather than silence.
 *
 * storage.onChanged is live: set() and remove() notify every listener on the
 * next tick with { key: { oldValue, newValue } }, as Chrome does, so a page
 * that updates itself from onChanged can be tested. extraLocal is merged into
 * the starting chrome.storage.local.
 */
function apiStub(queueCount, extraLocal) {
  return `
<pre id="__out" style="position:fixed;left:-9999px">PENDING</pre>
<script>
window.onerror = function (m, s, l, c) {
  document.getElementById("__out").textContent = "JS ERROR: " + m + " @ " + s + ":" + l + ":" + c;
};
var T0 = 0, LOG = [];
function rec(kind, extra) {
  var e = { t: +(performance.now() - T0).toFixed(1), kind: kind };
  if (extra) for (var k in extra) e[k] = extra[k];
  LOG.push(e);
}
function stack(skip) {
  try { throw new Error("x"); } catch (err) {
    return String(err.stack).split("\\n").slice(skip, skip + 3)
      .map(function (s) { return s.trim().replace(/file:[^)]*\\/scripts\\//g, "").replace(/file:[^)]*\\//g, ""); })
      .join("  <-  ");
  }
}
var _rm = DOMTokenList.prototype.remove;
DOMTokenList.prototype.remove = function () {
  if (Array.prototype.indexOf.call(arguments, "open") >= 0 && this.contains("open")) rec("REMOVE .open", { by: stack(2) });
  return _rm.apply(this, arguments);
};
var _add = DOMTokenList.prototype.add;
DOMTokenList.prototype.add = function () {
  if (Array.prototype.indexOf.call(arguments, "open") >= 0 && !this.contains("open")) rec("ADD .open", { by: stack(2) });
  return _add.apply(this, arguments);
};

var QUEUES = [];
for (var qi = 0; qi < ${queueCount}; qi++) {
  QUEUES.push({ name: "Fila " + (qi + 1), active: true, interval: 15, soundEnabled: true, customSound: "notification.mp3" });
}
var STORE = { local: { queues: QUEUES, general: { volume: 0.5 }, advanced: {} }, sync: { legacyMode: false } };
var EXTRA_LOCAL = ${JSON.stringify(extraLocal || {})};
for (var ek in EXTRA_LOCAL) STORE.local[ek] = EXTRA_LOCAL[ek];
var CHANGE_LISTENERS = [];
function clone(v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }
function notify(name, changes) {
  if (!Object.keys(changes).length) return;
  setTimeout(function () {
    CHANGE_LISTENERS.forEach(function (fn) { fn(changes, name); });
  }, 0);
}
function area(name) {
  return {
    get: function (keys, cb) {
      var out = {};
      if (typeof keys === "string") keys = [keys];
      if (Array.isArray(keys)) keys.forEach(function (k) { if (k in STORE[name]) out[k] = STORE[name][k]; });
      else if (keys && typeof keys === "object") { for (var k in keys) out[k] = (k in STORE[name]) ? STORE[name][k] : keys[k]; }
      else out = JSON.parse(JSON.stringify(STORE[name]));
      setTimeout(function () { cb(out); }, 0);
    },
    set: function (o, cb) {
      var changes = {};
      for (var k in o) {
        changes[k] = { newValue: clone(o[k]) };
        if (k in STORE[name]) changes[k].oldValue = clone(STORE[name][k]);
        STORE[name][k] = o[k];
      }
      rec("storage.set", { keys: Object.keys(o).join(",") });
      if (cb) setTimeout(cb, 0);
      notify(name, changes);
    },
    remove: function (keys, cb) {
      var changes = {};
      (Array.isArray(keys) ? keys : [keys]).forEach(function (k) {
        if (k in STORE[name]) changes[k] = { oldValue: clone(STORE[name][k]) };
        delete STORE[name][k];
      });
      if (cb) setTimeout(cb, 0);
      notify(name, changes);
    }
  };
}
window.chrome = {
  storage: {
    local: area("local"),
    sync: area("sync"),
    onChanged: { addListener: function (fn) { CHANGE_LISTENERS.push(fn); } }
  },
  runtime: {
    lastError: null,
    getURL: function (p) { return p; },
    sendMessage: function (m, cb) { if (cb) setTimeout(function () { cb({}); }, 0); },
    onMessage: { addListener: function () {} }
  },
  tabs: { query: function (q, cb) { cb([]); }, sendMessage: function () {} },
  i18n: { getUILanguage: function () { return "pt-BR"; } }
};
</script>`;
}

/**
 * Build a probe page from a real extension page and run it.
 * `scenarioScript` is a <script> body that drives the page and calls publish().
 *
 * opts.page    the HTML file to load (default popup.html)
 * opts.main    its last script, after which the scenario runs (default scripts/popup.js)
 * opts.local   extra keys for the starting chrome.storage.local
 * opts.queues  how many default queues to seed (default 5)
 */
function runProbe(name, scenarioScript, opts) {
  const options = opts || {};
  const browser = findBrowser();
  if (!browser) return { skipped: true };

  const page = options.page || "popup.html";
  const mainTag = '<script src="' + (options.main || "scripts/popup.js") + '"></script>';
  const i18nTag = '<script src="scripts/i18n.js"></script>';
  const source = read(page);
  // Both anchors have to exist, or the stub or the scenario would silently
  // not be injected and the probe would report a confusing timeout.
  if (!source.includes(i18nTag) || !source.includes(mainTag)) {
    return { error: page + " is missing " + (source.includes(i18nTag) ? mainTag : i18nTag) };
  }
  const html = source
    .replace(i18nTag, apiStub(options.queues || 5, options.local) + i18nTag)
    .replace(mainTag, mainTag + scenarioScript);

  const file = path.join(REPO, ".probe-" + name + ".html");
  const profile = path.join(os.tmpdir(), "insv-probe-" + name + "-" + process.pid);
  fs.writeFileSync(file, html, "utf8");

  try {
    const dom = execFileSync(
      browser,
      [
        "--headless=new",
        "--disable-gpu",
        "--no-sandbox",
        "--allow-file-access-from-files",
        "--virtual-time-budget=" + (options.budget || 20000),
        "--user-data-dir=" + profile,
        "--dump-dom",
        "file:///" + file.replace(/\\/g, "/"),
      ],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 64 * 1024 * 1024 }
    );
    const m = /<pre id="__out"[^>]*>([\s\S]*?)<\/pre>/.exec(dom);
    if (!m) return { error: "probe produced no output" };
    const raw = m[1]
      .replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;/g, "'").replace(/&amp;/g, "&");
    if (!raw.trim().startsWith("{")) return { error: raw.trim().slice(0, 300) };
    return { result: JSON.parse(raw) };
  } catch (e) {
    return { error: e.message };
  } finally {
    try { fs.unlinkSync(file); } catch (_) {}
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch (_) {}
  }
}

module.exports = { findBrowser, runProbe };
