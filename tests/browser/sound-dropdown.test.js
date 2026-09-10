"use strict";

/**
 * Regression: the sound dropdown closed itself the moment it opened.
 *
 * Clicking .qsd-trigger focuses it. Focusing a button that is only partly
 * visible makes Chrome scroll #queue-list to bring it into view. The capturing
 * scroll listener in util.js read that as "the user scrolled away" and closed
 * the menu that had just opened — about ten milliseconds after opening it.
 *
 * It only reproduces on a row that needs scrolling into view, which is why the
 * first row always worked and the options page never showed it at all. The test
 * therefore has to open the dropdown on several rows, not just one.
 */

const { runProbe } = require("../lib/chrome");
const { ok, check, section } = require("../lib/harness");

const SCENARIO = `
<script>
// Watch the two things that actually caused the bug: a scroll of the queue
// list, and any dismiss that fires while a menu is open.
document.addEventListener("scroll", function (e) {
  var el = e.target;
  rec("scroll", { target: el === document ? "#document" : (el.id ? "#" + el.id : el.tagName.toLowerCase()) });
}, { capture: true, passive: true });
var _pos = window.positionSoundMenu;
window.positionSoundMenu = function (t2, l2) { rec("reposition", { top: l2.style.top }); return _pos.apply(this, arguments); };
var _close = window.closeAllSoundDropdowns;
window.closeAllSoundDropdowns = function (except) {
  rec("dismiss", { openBefore: document.querySelectorAll(".queue-sound-select.open").length, hasExcept: !!except, by: stack(2) });
  return _close(except);
};

var result = { snaps: [], log: null, env: {} };
var root, list, trigger;
function publish() { result.log = LOG; document.getElementById("__out").textContent = JSON.stringify(result, null, 1); }

function box(el) { var r = el.getBoundingClientRect(); return { top: +r.top.toFixed(1), bottom: +r.bottom.toFixed(1) }; }

function snap(label) {
  var cs = getComputedStyle(list);
  var r = list.getBoundingClientRect();
  var hit = (r.width && r.height) ? document.elementFromPoint(r.left + r.width / 2, r.top + Math.min(r.height / 2, 20)) : null;
  return {
    label: label,
    open: root.classList.contains("open"),
    hidden: list.hidden,
    aria: trigger.getAttribute("aria-expanded"),
    options: list.querySelectorAll(".qsd-option").length,
    clickable: !!(hit && hit.closest && hit.closest(".qsd-list"))
  };
}

// A real click, not .click(): the focus step is what triggers the bug.
function realClick(el) {
  var r = el.getBoundingClientRect();
  var base = { bubbles: true, cancelable: true, composed: true, view: window,
               clientX: r.left + r.width / 2, clientY: r.top + r.height / 2,
               button: 0, pointerId: 1, pointerType: "mouse", isPrimary: true };
  function ev(Ctor, type, buttons) { var o = {}; for (var k in base) o[k] = base[k]; o.buttons = buttons; return new Ctor(type, o); }
  el.dispatchEvent(ev(PointerEvent, "pointerover", 0));
  el.dispatchEvent(ev(MouseEvent, "mouseover", 0));
  el.dispatchEvent(ev(PointerEvent, "pointerdown", 1));
  el.dispatchEvent(ev(MouseEvent, "mousedown", 1));
  el.focus();
  el.dispatchEvent(ev(PointerEvent, "pointerup", 0));
  el.dispatchEvent(ev(MouseEvent, "mouseup", 0));
  el.dispatchEvent(ev(MouseEvent, "click", 0));
}

function step(i) {
  var plan = [0, 16, 60, 150];
  if (i >= plan.length) { scrollPhase(); return; }
  result.snaps.push(snap("t+" + plan[i] + "ms"));
  publish();
  setTimeout(function () { step(i + 1); }, i + 1 < plan.length ? plan[i + 1] - plan[i] : 0);
}

// Whether the focus scroll lands before or after the frame that sets .open is a
// race, so reproducing it is not something a test can rely on. The invariant is
// what matters and it is deterministic: once the menu is open, scrolling the
// queue list behind it must not make it disappear. Drive that scroll directly.
function scrollPhase() {
  var qlist = document.getElementById("queue-list");
  result.beforeScroll = snap("before scroll");
  result.before = { menu: box(list), trigger: box(trigger) };
  // Scroll whichever way has room: the last row sits at the bottom already, and
  // a scroll that cannot move would test nothing.
  var atBottom = qlist.scrollTop + qlist.clientHeight >= qlist.scrollHeight - 1;
  qlist.scrollTop = qlist.scrollTop + (atBottom ? -40 : 40);
  // The position really changes first; the event is dispatched by hand because
  // headless virtual time delivers real scroll events late and not every run.
  // Scroll events do not bubble, but the listener under test captures on
  // document, so a capture-phase dispatch on the list reaches it exactly as a
  // user scroll would.
  qlist.dispatchEvent(new Event("scroll"));
  setTimeout(function () {
    result.snaps.push(snap("after scrolling the queue list"));
    result.after = { menu: box(list), trigger: box(trigger) };
    setTimeout(function () {
      result.snaps.push(snap("t+300ms after scroll"));
      list.style.transition = "none";
      void list.offsetHeight;
      result.settledOpacity = getComputedStyle(list).opacity;
      publish();
    }, 400);
  }, 500); // scroll events arrive late under headless virtual time
}

setTimeout(function () {
  var rows = document.querySelectorAll("#queue-list .queue-item");
  if (!rows.length) { document.getElementById("__out").textContent = "NO ROWS RENDERED"; return; }
  var idx = parseInt(new URLSearchParams(location.search).get("row") || "0", 10);
  var target = rows[Math.min(idx, rows.length - 1)];
  root = target.querySelector(".queue-sound-select");
  list = root && root.querySelector(".qsd-list");
  trigger = root && root.querySelector(".qsd-trigger");
  if (!root) { document.getElementById("__out").textContent = "NO DROPDOWN IN ROW " + idx; return; }

  var qlist = document.getElementById("queue-list");
  // Force the real popup's condition: a queue list short enough to scroll, so
  // focusing a lower row's trigger has to scroll it into view.
  qlist.style.maxHeight = "200px";
  qlist.style.overflowY = "auto";
  void qlist.offsetHeight;

  result.env = { rows: rows.length, scrollable: qlist.scrollHeight > qlist.clientHeight };
  result.snaps.push(snap("before click"));
  T0 = performance.now();
  realClick(trigger);
  step(0);
}, 600);
</script>`;

module.exports = function () {
  section("sound dropdown: opens and stays open (browser)");

  // Row 0 needs no scrolling and always worked; rows further down are the ones
  // that regressed, so all of them have to be covered.
  let exercised = 0;
  for (const row of [0, 1, 2, 3, 4]) {
    const run = runProbe("qsd" + row, SCENARIO.replace('get("row") || "0"', 'get("row") || "' + row + '"'));
    if (run.skipped) {
      console.log("  SKIP  no Chrome/Edge found — browser tests skipped");
      return;
    }
    if (run.error) {
      ok("row " + row + " probe ran", false, run.error);
      continue;
    }
    const r = run.result;
    const last = r.snaps[r.snaps.length - 1];
    const removals = (r.log || []).filter((e) => e.kind === "REMOVE .open");
    const label = "row " + row + ": ";

    // Phase 1: it opens at all.
    ok(label + "menu opens", r.beforeScroll.open && !r.beforeScroll.hidden, JSON.stringify(r.beforeScroll));
    ok(label + "options are clickable", r.beforeScroll.clickable, "nothing hit-testable inside .qsd-list");
    check(label + "the sound list is populated", r.beforeScroll.options > 0, true);

    // Phase 2: the invariant the fix exists for. Scrolling the queue list must
    // reposition the menu, never dismiss it — a dismiss here is the regression.
    ok(label + "survives a scroll of the queue list", last.open && !last.hidden, JSON.stringify(last));
    check(label + "aria-expanded stays true", last.aria, "true");
    ok(label + "it is fully faded in", r.settledOpacity === "1", "opacity=" + r.settledOpacity);
    ok(
      label + "nothing closes it behind the user's back",
      removals.length === 0,
      removals.length ? "closed by: " + removals[0].by : ""
    );

    // Repositioning can only be asserted where a scroll event actually reached
    // the page. Headless virtual time does not deliver one for every row, and a
    // check that silently passes when nothing happened is worse than no check.
    const scrolls = (r.log || []).filter((e) => e.kind === "scroll");
    const openedAt = (r.log || []).findIndex((e) => e.kind === "ADD .open");
    const scrolledWhileOpen = openedAt >= 0 && (r.log || []).slice(openedAt).some((e) => e.kind === "scroll");
    if (scrolledWhileOpen) {
      exercised++;
      // The menu must stay anchored to its trigger. It may sit below it or,
      // when there is no room, flip above it — positionSoundMenu chooses — so
      // adjacency on either side is the invariant, not a matching delta.
      const menu = r.after.menu;
      const trig = r.after.trigger;
      const below = Math.abs(menu.top - trig.bottom);
      const above = Math.abs(trig.top - menu.bottom);
      ok(
        label + "the menu stays anchored to its trigger",
        Math.min(below, above) <= 16, // the open transition scales the menu, so the gap breathes
        "menu " + JSON.stringify(menu) + " trigger " + JSON.stringify(trig) +
          " (gap below " + below.toFixed(1) + ", above " + above.toFixed(1) + ")"
      );
      ok(
        label + "the trigger actually moved",
        Math.abs(r.after.trigger.top - r.before.trigger.top) > 1,
        "the scroll did not move the row, so nothing was tested"
      );
    } else {
      console.log("  ....  " + label + "no scroll delivered while open; reposition not exercised");
    }
    void scrolls;
  }

  // Guard against the suite quietly degrading into testing nothing.
  ok(
    "at least one row exercised scroll-while-open",
    exercised > 0,
    "no row received a scroll event while its menu was open — the regression this file exists for would go unnoticed"
  );
};
