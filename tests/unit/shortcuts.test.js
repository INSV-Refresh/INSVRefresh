"use strict";

/**
 * scripts/util.js — keyboard shortcut normalization and conflict removal.
 *
 * Two actions (accept a case, pause every queue) must never share a key
 * combination: the content script registers both handlers, so one keypress
 * would accept the case AND pause the queues. Saving a combination that
 * another action already has moves it: the new setting wins and the old one
 * is cleared in the same write, without touching unrelated settings.
 */

const { read, extractFunction, check, ok, section } = require("../lib/harness");

const SRC = read("scripts/util.js");

function constant(name) {
  const m = SRC.match(new RegExp("const " + name + " = ([^;]+);"));
  if (!m) throw new Error("constant not found: " + name);
  return m[1];
}

const api = new Function(
  [
    "const SHORTCUT_ACTIONS = " + constant("SHORTCUT_ACTIONS") + ";",
    extractFunction(SRC, "normalizeShortcut"),
    extractFunction(SRC, "shortcutSignature"),
    extractFunction(SRC, "getStoredShortcut"),
    extractFunction(SRC, "assignShortcut"),
    "return { SHORTCUT_ACTIONS, normalizeShortcut, shortcutSignature, getStoredShortcut, assignShortcut };",
  ].join("\n")
)();

const CTRL_SHIFT_P = { ctrl: true, alt: false, shift: true, meta: false, code: "KeyP" };

module.exports = function () {
  const { shortcutSignature: sig, normalizeShortcut, assignShortcut } = api;

  section("shortcuts: equivalent combinations share one signature");

  check("truthy/missing modifiers are the same combination",
    sig({ ctrl: 1, shift: "yes", code: "KeyP" }), sig(CTRL_SHIFT_P));
  check("legacy string 'p' is KeyP with no modifiers", sig("p"), sig({ code: "KeyP" }));
  check("'keyp' is normalized to KeyP", normalizeShortcut({ ctrl: true, code: "keyp" }).code, "KeyP");
  check("bare digit is normalized to DigitN", normalizeShortcut({ alt: true, code: "7" }).code, "Digit7");
  check("surrounding spaces are ignored", sig({ ctrl: true, shift: true, code: " KeyP " }), sig(CTRL_SHIFT_P));
  ok("Digit1 and Numpad1 are different keys",
    sig({ ctrl: true, code: "Digit1" }) !== sig({ ctrl: true, code: "Numpad1" }));
  ok("Ctrl+P and Ctrl+Shift+P differ", sig({ ctrl: true, code: "KeyP" }) !== sig(CTRL_SHIFT_P));
  check("no code means no shortcut", sig({ ctrl: true, code: "" }), "");
  check("null means no shortcut", sig(null), "");

  section("shortcuts: the new setting takes the combination from the old one");

  const before = {
    pauseAllShortcut: CTRL_SHIFT_P,
    workSchedule: { enabled: true, start: "08:00", end: "18:00", days: [1, 2, 3, 4, 5] },
    globalPaused: false,
  };
  const r = assignShortcut(before, "acceptShortcut", { ctrl: true, shift: true, code: "KeyP" });

  check("accept gets the combination", sig(r.adv.acceptShortcut), sig(CTRL_SHIFT_P));
  check("pause loses it", r.adv.pauseAllShortcut, null);
  check("the removed action is reported", r.removed.map((a) => a.prop), ["pauseAllShortcut"]);
  check("unrelated settings are kept", [r.adv.workSchedule, r.adv.globalPaused], [before.workSchedule, false]);
  check("the input object is not mutated", before.pauseAllShortcut, CTRL_SHIFT_P);

  section("shortcuts: formatting differences still count as a conflict");

  const r2 = assignShortcut({ acceptShortcut: { ctrl: 1, shift: 1, code: "keyp" } }, "pauseAllShortcut", CTRL_SHIFT_P);
  check("accept saved in another format loses the combination", r2.adv.acceptShortcut, null);
  check("pause keeps it", sig(r2.adv.pauseAllShortcut), sig(CTRL_SHIFT_P));

  const legacyTaken = { acceptShortcutKey: "p" };
  const r3 = assignShortcut(legacyTaken, "pauseAllShortcut", { code: "KeyP" });
  ok("the legacy accept key is dropped when its key moves to pause", !("acceptShortcutKey" in r3.adv), JSON.stringify(r3.adv));
  check("pause reports taking it from accept", r3.removed.map((a) => a.prop), ["acceptShortcut"]);

  section("shortcuts: no conflict, nothing else changes");

  const other = { acceptShortcut: { ctrl: true, alt: true, code: "KeyA" } };
  const r4 = assignShortcut(other, "pauseAllShortcut", CTRL_SHIFT_P);
  check("a different combination is kept", sig(r4.adv.acceptShortcut), sig(other.acceptShortcut));
  check("nothing is reported as removed", r4.removed, []);

  const r5 = assignShortcut({ acceptShortcut: CTRL_SHIFT_P, pauseAllShortcut: { alt: true, code: "KeyX" } }, "pauseAllShortcut", null);
  check("clearing a shortcut stores null", r5.adv.pauseAllShortcut, null);
  check("clearing does not touch the other action", sig(r5.adv.acceptShortcut), sig(CTRL_SHIFT_P));

  const r6 = assignShortcut({ acceptShortcut: CTRL_SHIFT_P, acceptShortcutKey: "q" }, "acceptShortcut", CTRL_SHIFT_P);
  check("re-saving the same combination on the same action is not a conflict", r6.removed, []);
  ok("saving accept drops its own legacy key", !("acceptShortcutKey" in r6.adv), JSON.stringify(r6.adv));
};
