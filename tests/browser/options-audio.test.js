"use strict";

/**
 * Regression: a custom audio saved on the options page did not show up in the
 * sound fields of "Notificações por status" until the page was reloaded.
 *
 * Each rule's sound dropdown builds its option list once, when the rows render.
 * Saving an audio only refreshed the audio list above it, so the new sound was
 * missing from every rule. Deleting one left rules that had it selected showing
 * the raw "custom_…" storage key.
 *
 * The fix rebuilds only the options (from storage.onChanged), keeping each
 * rule's choice and the rows themselves, so someone typing statuses keeps
 * focus. Both halves are checked: the options update, and nothing re-renders.
 */

const { runProbe } = require("../lib/chrome");
const { ok, check, section } = require("../lib/harness");

const QUEUES = [
  { name: "Fila A", active: true, interval: 15, soundEnabled: true, customSound: "notification.mp3",
    statusNotify: { enabled: true, statuses: ["New"], sound: "tech.mp3" } },
  // Points at an audio that no longer exists: the alert already plays the
  // default sound instead, so the field has to say so.
  { name: "Fila B", active: true, interval: 15, soundEnabled: true, customSound: "notification.mp3",
    statusNotify: { enabled: true, statuses: ["Open"], sound: "custom_gone" } },
];

const SCENARIO = `
<script>
var result = {};
function publish() { document.getElementById("__out").textContent = JSON.stringify(result, null, 1); }
function fail(msg) { result.error = msg; publish(); }
function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
function rows() { return $all("#status-notifications-list .queue-manager-row"); }
function sound(row) {
  var root = row.querySelector(".qm-sound");
  var customs = $all(".qsd-option", root).filter(function (o) { return o.dataset.value.indexOf("custom_") === 0; });
  return {
    value: root.value,
    label: root.querySelector(".qsd-label").textContent,
    customs: customs.map(function (o) { return o.dataset.label; })
  };
}
function sounds() { return rows().map(sound); }
function audioList() { return $all("#custom-audios-list .audio-info strong").map(function (s) { return s.textContent; }); }
function waitFor(cond, then, label, n) {
  n = n || 0;
  var hit = false;
  try { hit = cond(); } catch (e) {}
  if (hit) return then();
  if (n > 120) return fail("timed out waiting for: " + label + " | " + JSON.stringify(sounds()));
  setTimeout(function () { waitFor(cond, then, label, n + 1); }, 50);
}

waitFor(function () {
  return rows().length === 2 && rows().every(function (r) { return $all(".qsd-option", r).length > 0 && r.querySelector(".qm-sound").value; });
}, boot, "rows to render");

function boot() {
  result.boot = sounds();
  var firstRow = rows()[0];

  // 1. Save an audio through the real form.
  var file = new File([new Uint8Array([255, 251, 144, 0, 0, 0])], "beep.mp3", { type: "audio/mpeg" });
  var input = document.getElementById("custom-audio");
  var dt = new DataTransfer();
  dt.items.add(file);
  input.files = dt.files;
  document.getElementById("custom-audio-name").value = "Meu Som";
  input.dispatchEvent(new Event("change", { bubbles: true }));
  document.getElementById("save-audio-btn").click();

  waitFor(function () { return sounds().every(function (s) { return s.customs.length === 1; }); }, function () {
    result.afterSave = sounds();
    result.audioListAfterSave = audioList();
    result.rowsKeptOnSave = rows()[0] === firstRow;
    crossTab(firstRow);
  }, "the saved audio in every rule");
}

// 2. Another options tab adds an audio while this one is typing a status.
function crossTab(firstRow) {
  var statuses = firstRow.querySelector(".qm-statuses");
  statuses.focus();
  statuses.setSelectionRange(1, 1);
  chrome.storage.local.get("audiosPersonalizados", function (data) {
    var all = data.audiosPersonalizados || {};
    all.custom_other = { name: "Outro", originalName: "o.mp3", data: "data:audio/mpeg;base64,AAAA" };
    chrome.storage.local.set({ audiosPersonalizados: all });
    waitFor(function () { return sounds().every(function (s) { return s.customs.length === 2; }); }, function () {
      result.afterCrossTab = sounds();
      result.focusKept = document.activeElement === statuses && statuses.isConnected;
      result.caretKept = statuses.selectionStart === 1;
      statuses.blur();
      deleteSelected();
    }, "the other tab's audio in every rule");
  });
}

// 3. Pick the saved audio in rule B, then delete it.
function deleteSelected() {
  var root = rows()[1].querySelector(".qm-sound");
  var opt = $all(".qsd-option", root).filter(function (o) { return o.dataset.label === "Meu Som"; })[0];
  if (!opt) return fail("saved audio not offered in rule B");
  var key = opt.dataset.value;
  root.querySelector(".qsd-trigger").click();
  opt.click();
  result.pickedKey = root.value === key;

  var del = document.querySelector('.delete-audio-btn[data-audio-key="' + key + '"]');
  if (!del) return fail("no delete button for " + key);
  del.click();
  waitFor(function () { return sounds().every(function (s) { return s.customs.length === 1; }); }, function () {
    result.afterDelete = sounds();
    result.audioListAfterDelete = audioList();
    publish();
  }, "the deleted audio to leave every rule");
}
</script>`;

module.exports = function () {
  section("options: saved audio reaches the status-notification rules (browser)");

  const run = runProbe("opt-audio", SCENARIO, {
    page: "options.html",
    main: "scripts/options.js",
    local: { queues: QUEUES },
  });
  if (run.skipped) {
    console.log("  SKIP  no Chrome/Edge found — browser tests skipped");
    return;
  }
  if (run.error || run.result.error) {
    ok("options probe ran", false, run.error || run.result.error);
    return;
  }
  const r = run.result;

  check("rule A boots on its own sound", r.boot[0].value, "tech.mp3");
  check("a rule pointing at a deleted audio shows the default", r.boot[1].value, "notification.mp3");
  ok("and never the raw storage key", !/^custom_/.test(r.boot[1].label), "label: " + r.boot[1].label);

  check("a saved audio appears in every rule", r.afterSave.map((s) => s.customs), [["Meu Som"], ["Meu Som"]]);
  check("the rules keep their choice", r.afterSave.map((s) => s.value), ["tech.mp3", "notification.mp3"]);
  check("the audio list shows it too", r.audioListAfterSave, ["Meu Som"]);
  ok("the rows are not re-rendered", r.rowsKeptOnSave, "row 0 was replaced");

  check("an audio added in another tab appears too", r.afterCrossTab.map((s) => s.customs), [["Meu Som", "Outro"], ["Meu Som", "Outro"]]);
  ok("typing a status keeps focus", r.focusKept, "focus left the statuses field");
  ok("and keeps the caret", r.caretKept, "caret moved");

  ok("the saved audio can be picked in a rule", r.pickedKey, "rule B did not take the audio");
  check("a deleted audio leaves every rule", r.afterDelete.map((s) => s.customs), [["Outro"], ["Outro"]]);
  check("the rule that used it falls back to the default", r.afterDelete[1].value, "notification.mp3");
  check("the audio list drops it", r.audioListAfterDelete, ["Outro"]);
};
