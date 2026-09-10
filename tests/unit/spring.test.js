"use strict";

/**
 * scripts/util.js — springTo, projectMomentum, createVelocityTracker.
 *
 * The spring drives the queue-reorder settle. Its two parameters are Apple's
 * (damping ratio + response), so the properties worth pinning are behavioural:
 * critically damped must never overshoot, underdamped must overshoot when the
 * gesture carried momentum, and the integrator must converge from every
 * starting condition rather than oscillating forever or blowing up.
 */

const { read, extractFrom, check, ok, section } = require("../lib/harness");

// Fake rAF clock so a spring can be run deterministically at 60fps.
let now = 0;
const queue = [];
global.performance = { now: () => now };
global.requestAnimationFrame = (fn) => queue.push(fn);
global.cancelAnimationFrame = () => {};
global.window = { matchMedia: () => ({ matches: false }) };

// Indirect eval: these are plain globals in the extension, and a strict-mode
// module would otherwise keep the declarations to itself.
(0, eval)(extractFrom(read("scripts/util.js"), "function prefersReducedMotion"));

/** Run a spring to completion against the fake clock; report its trajectory. */
function run(opts, maxFrames) {
  queue.length = 0;
  now = 0;
  let frames = 0;
  let done = false;
  const xs = [];
  springTo(
    Object.assign({}, opts, {
      onFrame: (v) => xs.push(v),
      onDone: () => { done = true; },
    })
  );
  while (queue.length && frames < (maxFrames || 900)) {
    now += 1000 / 60;
    frames++;
    queue.shift()(now);
  }
  return { done, frames, xs, ms: Math.round((frames * 1000) / 60), last: xs[xs.length - 1] };
}

module.exports = function () {
  section("spring: convergence");

  [
    ["critically damped from rest", { from: 100, to: 0, damping: 1.0, response: 0.4, velocity: 0 }],
    ["drag settle (production args)", { from: 40, to: 0, damping: 0.8, response: 0.3, velocity: 600 }],
    ["hard flick", { from: -60, to: 0, damping: 0.8, response: 0.3, velocity: -3000 }],
    ["already at rest", { from: 0, to: 0, damping: 0.8, response: 0.3, velocity: 0 }],
    ["sub-pixel offset", { from: 0.2, to: 0, damping: 0.8, response: 0.3, velocity: 5 }],
    ["non-zero target", { from: 0, to: 120, damping: 1.0, response: 0.4, velocity: 0 }],
  ].forEach(([label, opts]) => {
    const r = run(opts);
    ok(
      label + " settles",
      r.done && Number.isFinite(r.last) && r.ms < 2000,
      "done=" + r.done + " last=" + r.last + " ms=" + r.ms
    );
    ok(label + " lands on target", Math.abs(r.last - opts.to) < 0.5, "last=" + r.last);
  });

  section("spring: damping ratio governs overshoot");

  const crit = run({ from: 100, to: 0, damping: 1.0, response: 0.4, velocity: 0 });
  const under = run({ from: 100, to: 0, damping: 0.5, response: 0.4, velocity: 0 });
  ok(
    "damping 1.0 never crosses the target",
    Math.min.apply(null, crit.xs) >= -0.5,
    "min=" + Math.min.apply(null, crit.xs)
  );
  ok(
    "damping 0.5 overshoots the target",
    Math.min.apply(null, under.xs) < -1,
    "min=" + Math.min.apply(null, under.xs)
  );

  // Momentum is what earns the bounce: released from rest, 0.8 should settle
  // without a visible overshoot; thrown, it should carry past and come back.
  const thrown = run({ from: 0, to: 0, damping: 0.8, response: 0.3, velocity: 1500 });
  ok(
    "a thrown row carries past its slot",
    Math.max.apply(null, thrown.xs) > 5,
    "max=" + Math.max.apply(null, thrown.xs)
  );

  section("spring: reduced motion");

  global.window.matchMedia = () => ({ matches: true });
  const reduced = run({ from: 200, to: 0, damping: 0.8, response: 0.3, velocity: 900 });
  check("reduced motion jumps straight to the target", reduced.last, 0);
  ok("reduced motion still reports completion", reduced.done, "onDone must fire so the caller cleans up");
  global.window.matchMedia = () => ({ matches: false });

  section("momentum projection");

  // 0.99, not a scroll view's 0.998: the queue list is only a few hundred px
  // tall, so scroll-length coasting would send every flick to the very end.
  check("300 px/s barely moves", Math.round(projectMomentum(300, 0.99)), 30);
  check("2000 px/s throws about two rows", Math.round(projectMomentum(2000, 0.99)), 198);
  ok("projection is signed", projectMomentum(-2000, 0.99) < 0, "an upward flick must project upward");
  ok(
    "a scroll rate coasts much further",
    projectMomentum(2000, 0.998) > 5 * projectMomentum(2000, 0.99),
    "0.998 should dwarf 0.99"
  );

  section("velocity tracker");

  const t = createVelocityTracker(100);
  now = 0;
  t.add(0);
  for (let i = 1; i <= 5; i++) {
    now = i * 16.7;
    t.add(i * 10);
  }
  ok("tracks ~600 px/s", Math.abs(t.velocity() - 600) < 25, "got " + t.velocity());

  const idle = createVelocityTracker(100);
  now = 0;
  idle.add(50);
  now = 500;
  idle.add(50); // held still before releasing
  check("a pause before release reads as zero", Math.round(idle.velocity()), 0);

  const empty = createVelocityTracker(100);
  check("a single sample cannot imply velocity", empty.velocity(), 0);
};
