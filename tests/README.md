# Tests

```
node tests/run.js          # everything
node tests/run.js --unit   # unit tests only, no browser needed
```

No dependencies and no `package.json`, matching the extension itself. Exits
non-zero on failure, so it works as a pre-commit or CI step as-is.

## Why these exist

Both bugs covered here survived careful reading of the code and were only found
by running the real popup. They are the kind that reasoning does not catch:

- **The sound dropdown closed itself the moment it opened.** Clicking
  `.qsd-trigger` focuses it; focusing a partly-visible button makes Chrome
  scroll `#queue-list` to bring it into view; the capturing scroll listener read
  that as "the user scrolled away" and dismissed the menu about ten milliseconds
  after it opened. It only reproduced on rows that needed scrolling into view,
  which is why the first row always worked and the options page never showed it.

- **A dragged queue row could stick to the screen, and a reorder could vanish.**
  Reordering the DOM mid-gesture released the pointer capture held by the
  `.drag-handle` inside the moved row, after which no release was delivered.
  Separately, the DOM commit and `saveOptions()` used to hang off the settle
  spring's `onDone`, so closing the popup during the animation threw the reorder
  away.

## Layout

| Path | Needs a browser | Covers |
| --- | --- | --- |
| `unit/spring.test.js` | no | `springTo`, `projectMomentum`, `createVelocityTracker` in `scripts/util.js` |
| `unit/reorder.test.js` | no | `queueTargetIndex`, `applyQueueDisplacement`, `commitQueueOrder` in `scripts/popup.js` |
| `browser/sound-dropdown.test.js` | yes | the dropdown opens and survives a scroll behind it |
| `browser/queue-drag.test.js` | yes | the reorder commits on release and leaves nothing stuck |

## How the browser tests work

There is no puppeteer and nothing to add it to. Instead a probe page is
generated from the real `popup.html` — same scripts, same stylesheets, only the
`chrome.*` APIs stubbed — which runs a scripted interaction and writes its
findings into a `<pre>`. `chrome --dump-dom` prints the finished DOM and the
JSON is read back out. Crude, but it exercises the actual popup rather than a
re-creation of it, which is the entire point.

Chrome or Edge is found automatically; set `CHROME_PATH` to override. If neither
is present the browser tests skip and the unit tests still run.

The generated `.probe-*.html` files live in the repo root for the duration of a
run and are deleted afterwards.

## Two things to know before trusting a green run

**Timing is not deterministic under headless virtual time.** Scroll events are
delivered late and not to every row. The dropdown test therefore asserts
repositioning only on rows that actually received a scroll while open, and ends
with a guard — *at least one row exercised scroll-while-open* — so the suite
cannot quietly degrade into testing nothing. If that guard ever fails, the
browser tests are no longer covering the bug they exist for.

**The probes run in a normal tab, not a real extension popup window.** A popup
auto-sizes its window to the document; a tab does not. Anything that depends on
that resize is out of reach here and still needs a manual check with the
extension loaded.

## Adding a case

The unit tests read the extension's globals by slicing a named function out of
the source and eval'ing it — see `lib/harness.js`. That keeps the production
files free of test scaffolding, at the cost of breaking if a function is renamed.
That is deliberate: a rename should make you revisit the test.

For a browser case, write a scenario `<script>` that calls `publish()` when done
and hand it to `runProbe()` from `lib/chrome.js`.

Verify any new regression test by breaking the fix and watching it fail. Every
assertion here was checked that way: reverting the dropdown dismiss, dropping
`saveOptions()` on release, and disabling the settle safety net each turn the
suite red.
