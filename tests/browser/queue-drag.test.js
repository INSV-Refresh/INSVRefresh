"use strict";

/**
 * Regression: a dragged queue row could be left stuck on screen, and a reorder
 * could be silently lost.
 *
 * Two separate defects, both caught here rather than by reasoning:
 *
 *   1. The gesture used to reorder the DOM while the pointer was down.
 *      insertBefore on a parented node removes it first, and removing the
 *      subtree holding the captured .drag-handle releases the pointer capture —
 *      after which no move or release is delivered and the row hangs in mid-air
 *      until the pointer wanders back over the handle.
 *
 *   2. The DOM commit and saveOptions() hung off the settle spring's onDone, so
 *      closing the popup during the few hundred milliseconds of animation threw
 *      the reorder away, and a starved frame loop stranded the row for good.
 *      The order is now written and saved on pointerup; the spring is decoration.
 */

const { runProbe } = require("../lib/chrome");
const { ok, check, section } = require("../lib/harness");

const SCENARIO = `
<script>
// Synthetic pointer ids are rejected by the real setPointerCapture. Record the
// call and carry on — events are dispatched straight at the handle, so routing
// still works, and the production code tolerates capture failing.
var CAPTURED = null;
Element.prototype.setPointerCapture = function (id) { CAPTURED = id; rec("setPointerCapture", { id: id }); };
Element.prototype.releasePointerCapture = function (id) { CAPTURED = null; };
Element.prototype.hasPointerCapture = function (id) { return CAPTURED === id; };

var result = { steps: [], log: null, env: {} };
function publish() { result.log = LOG; document.getElementById("__out").textContent = JSON.stringify(result, null, 1); }

function order() {
  return Array.prototype.map.call(document.querySelectorAll("#queue-list .queue-item"),
    function (n) { return (n.querySelector(".queue-name") || {}).value || "?"; }).join(",");
}
function state(label) {
  var rows = document.querySelectorAll("#queue-list .queue-item");
  return {
    label: label,
    order: order(),
    dragging: document.querySelectorAll(".queue-item.dragging").length,
    settling: document.querySelectorAll(".queue-item.settling").length,
    reordering: document.getElementById("queue-list").classList.contains("reordering"),
    transforms: Array.prototype.map.call(rows, function (n) { return n.style.transform || "-"; }).join(" | ")
  };
}
function pe(el, type, y, buttons) {
  var r = el.getBoundingClientRect();
  el.dispatchEvent(new PointerEvent(type, {
    bubbles: true, cancelable: true, composed: true, view: window,
    clientX: r.left + r.width / 2, clientY: y,
    button: 0, buttons: buttons, pointerId: 7, pointerType: "mouse", isPrimary: true
  }));
}

setTimeout(function () {
  var rows = document.querySelectorAll("#queue-list .queue-item");
  if (rows.length < 4) { document.getElementById("__out").textContent = "NEED 4+ ROWS, got " + rows.length; return; }

  var FROM = 1;
  var handle = rows[FROM].querySelector(".drag-handle");
  var slot = rows[1].getBoundingClientRect().top - rows[0].getBoundingClientRect().top;
  var startY = handle.getBoundingClientRect().top + 7;

  T0 = performance.now();
  result.env = { rows: rows.length, slot: +slot.toFixed(1), from: FROM };
  result.steps.push(state("before"));

  pe(handle, "pointerdown", startY, 1);
  result.steps.push(state("after pointerdown"));

  var y = startY, target = startY + slot * 2 + 4, moves = 0;
  function moveStep() {
    if (y < target) {
      y = Math.min(target, y + 12);
      pe(handle, "pointermove", y, 1);
      if (++moves === 1) result.steps.push(state("after first move"));
      setTimeout(moveStep, 16);
      return;
    }
    result.steps.push(state("end of drag"));
    pe(handle, "pointerup", y, 0);
    result.steps.push(state("on pointerup"));
    setTimeout(function () {
      result.steps.push(state("t+900ms"));
      setTimeout(function () {
        result.steps.push(state("t+1600ms"));
        publish();
      }, 700);
    }, 900);
  }
  moveStep();
}, 700);
</script>`;

module.exports = function () {
  section("queue drag: reorder commits and nothing is left stuck (browser)");

  const run = runProbe("drag", SCENARIO);
  if (run.skipped) {
    console.log("  SKIP  no Chrome/Edge found — browser tests skipped");
    return;
  }
  if (run.error) {
    ok("drag probe ran", false, run.error);
    return;
  }

  const r = run.result;
  const by = (label) => r.steps.find((s) => s.label === label);
  const before = by("before");
  const onUp = by("on pointerup");
  const settled = by("t+1600ms");
  const saves = (r.log || []).filter((e) => e.kind === "storage.set");

  // Dragging row 1 down past two slots must move it to index 3.
  check("starting order", before.order, "Fila 1,Fila 2,Fila 3,Fila 4,Fila 5");

  ok("the row lifts once the drag threshold is passed", by("after first move").dragging === 1, "no .dragging row");
  ok("a press alone does not lift a row", by("after pointerdown").dragging === 0, "lifted on pointerdown");
  check("the DOM is untouched while the pointer is down", by("end of drag").order, before.order);

  // The regression that lost reorders: this must be true ON pointerup, not
  // after the animation finishes.
  check("the new order is committed on release", onUp.order, "Fila 1,Fila 3,Fila 4,Fila 2,Fila 5");
  ok("the reorder is persisted on release", saves.length > 0, "saveOptions() never wrote to storage");
  ok("the pinned first queue never moves", settled.order.indexOf("Fila 1") === 0, settled.order);

  // The stuck-row regression.
  ok("no row is left mid-drag", settled.dragging === 0, JSON.stringify(settled));
  ok("no row is left settling", settled.settling === 0, JSON.stringify(settled));
  ok("the list drops its reordering state", settled.reordering === false, JSON.stringify(settled));
  ok(
    "every transform is cleaned up",
    settled.transforms.replace(/[ |-]/g, "") === "",
    "left over: " + settled.transforms
  );
  check("the committed order survives the animation", settled.order, onUp.order);
};
