"use strict";

/**
 * scripts/popup.js — queue reorder geometry and the DOM commit.
 *
 * The drag never moves anything in the DOM while the pointer is down; it works
 * out which slot the row is over and shifts the others with transforms. Two
 * things therefore have to be exactly right, and both are pure enough to test
 * without a browser:
 *
 *   queueTargetIndex     which slot the row's centre is over (clamped so the
 *                        pinned first queue can never be displaced)
 *   commitQueueOrder     the single insertBefore at the end of the gesture
 *
 * Regression covered: commitQueueOrder used to run from the spring's onDone, so
 * closing the popup mid-settle lost the reorder entirely. It now runs on
 * pointerup and returns the distance for the animation to cover.
 */

const { read, extractFunction, check, ok, section } = require("../lib/harness");

const SRC = read("scripts/popup.js");

// ---- fake DOM ---------------------------------------------------------------
const ROW_H = 80;
const GAP = 8;
const SLOT = ROW_H + GAP;

class FakeNode {
  constructor(name) {
    this.name = name;
    this.style = {};
    this.parent = null;
  }
  get isConnected() {
    return !!this.parent;
  }
  get nextElementSibling() {
    const kids = this.parent.kids;
    const i = kids.indexOf(this);
    return i >= 0 && i + 1 < kids.length ? kids[i + 1] : null;
  }
  getBoundingClientRect() {
    const i = this.parent ? this.parent.kids.indexOf(this) : 0;
    return { top: i * SLOT, height: ROW_H, bottom: i * SLOT + ROW_H };
  }
}

class FakeList {
  constructor(names) {
    this.kids = names.map((n) => {
      const node = new FakeNode(n);
      node.parent = this;
      return node;
    });
  }
  get offsetHeight() {
    return 1;
  }
  contains(n) {
    return this.kids.indexOf(n) >= 0;
  }
  insertBefore(node, ref) {
    const i = this.kids.indexOf(node);
    if (i >= 0) this.kids.splice(i, 1);
    if (ref === null) this.kids.push(node);
    else this.kids.splice(this.kids.indexOf(ref), 0, node);
    node.parent = this;
  }
  order() {
    return this.kids.map((k) => k.name).join("");
  }
}

// queueList is a module-level global in popup.js, so the extracted functions
// have to find it as a real global. Indirect eval puts them in global scope;
// a strict-mode module would otherwise keep the declarations to itself.
(0, eval)(
  [
    extractFunction(SRC, "queueTargetIndex"),
    extractFunction(SRC, "applyQueueDisplacement"),
    extractFunction(SRC, "commitQueueOrder"),
  ].join(";")
);

/** A layout snapshot of N evenly spaced rows, grabbing the one at `index`. */
function layout(n, index) {
  const rects = [];
  for (let i = 0; i < n; i++) rects.push({ top: i * SLOT, height: ROW_H, bottom: i * SLOT + ROW_H });
  return {
    rows: Array.from({ length: n }, () => ({ style: {} })),
    rects,
    index,
    slot: SLOT,
    scrollTop: 0,
  };
}
const midOf = (i) => i * SLOT + ROW_H / 2;

module.exports = function () {
  section("reorder: which slot is the row over");

  let d = { layout: layout(5, 2) };
  check("centred on its own slot, stays put", queueTargetIndex(d, midOf(2)), 2);
  check("past row 3's midpoint moves down one", queueTargetIndex(d, midOf(3) + 1), 3);
  check("short of row 3's midpoint does not move", queueTargetIndex(d, midOf(3) - 1), 2);
  check("dragged far below lands last", queueTargetIndex(d, 9999), 4);
  check("past row 1's midpoint moves up one", queueTargetIndex(d, midOf(1) - 1), 1);
  check("dragged far above clamps below the pinned row", queueTargetIndex(d, -9999), 1);

  d = { layout: layout(5, 1) };
  check("the row under the pinned one cannot go above it", queueTargetIndex(d, -9999), 1);
  check("...but can still reach the end", queueTargetIndex(d, 9999), 4);

  d = { layout: layout(2, 1) };
  check("a two-row list has nowhere to go", queueTargetIndex(d, 9999), 1);

  section("reorder: rows slide out of the way");

  d = { layout: layout(5, 2) };
  applyQueueDisplacement(d, 4);
  check(
    "dragging down to 4 lifts rows 3 and 4 by one slot",
    d.layout.rows.map((r) => r.style.transform || ""),
    ["", "", "", "translateY(-88px)", "translateY(-88px)"]
  );

  d = { layout: layout(5, 2) };
  applyQueueDisplacement(d, 1);
  check(
    "dragging up to 1 pushes row 1 down one slot",
    d.layout.rows.map((r) => r.style.transform || ""),
    ["", "translateY(88px)", "", "", ""]
  );

  d = { layout: layout(5, 2) };
  applyQueueDisplacement(d, 4);
  applyQueueDisplacement(d, 2);
  check(
    "reversing the gesture clears every shift",
    d.layout.rows.map((r) => r.style.transform || ""),
    ["", "", "", "", ""]
  );

  section("reorder: the DOM commit");

  function commit(fromIndex, toIndex) {
    global.queueList = new FakeList(["A", "B", "C", "D", "E"]);
    const rows = queueList.kids.slice();
    const travel = commitQueueOrder({
      item: rows[fromIndex],
      toIndex,
      layout: { rows, rects: [], index: fromIndex },
    });
    return { order: queueList.order(), travel };
  }

  check("C to the end", commit(2, 4).order, "ABDEC");
  check("C down one", commit(2, 3).order, "ABDCE");
  check("C stays", commit(2, 2).order, "ABCDE");
  check("C up one", commit(2, 1).order, "ACBDE");
  check("E to slot 1", commit(4, 1).order, "AEBCD");
  check("B to the end", commit(1, 4).order, "ACDEB");
  ok("the pinned first row is never displaced", commit(4, 1).order[0] === "A", "A must stay first");

  ok("a real move reports a non-zero distance to animate", commit(2, 4).travel !== 0, "travel was 0");
  check("a no-op move reports no distance", commit(2, 2).travel, 0);

  section("reorder: the list is rebuilt mid-gesture");

  // An external storage change calls restoreOptions(), which replaces every
  // row. Writing the snapshot's order back would resurrect a detached node.
  global.queueList = new FakeList(["A", "B", "C"]);
  const stale = queueList.kids.slice();
  const orphan = stale[1];
  queueList.kids = [];
  orphan.parent = null;
  const refused = commitQueueOrder({
    item: orphan,
    toIndex: 2,
    layout: { rows: stale, rects: [], index: 1 },
  });
  check("the commit is refused", refused, null);
  check("nothing is re-inserted", queueList.order(), "");
};
