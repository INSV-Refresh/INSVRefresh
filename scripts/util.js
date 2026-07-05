// Shared helpers — loaded before popup.js / options.js.

// Escape user-controlled text before it goes into an innerHTML template
// (queue names, custom-audio names). Covers element content and double-quoted
// attribute values.
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Built-in alert sounds — single source (popup + options render the same list).
// labelKey resolves via t() at render time; text is a fixed brand name.
const BUILTIN_SOUNDS = [
  { value: "notification.mp3", labelKey: "sound_default" },
  { value: "tech.mp3", text: "Tech" },
  { value: "limba.mp3", text: "Limba" },
  { value: "lis.mp3", text: "LIS" },
  { value: "interface.mp3", text: "Interface" },
  { value: "bubble.mp3", text: "Bubbles" },
];

// Play a sound by value — a built-in filename or a "custom_*" storage key.
// Shared by the popup and options preview controls. volume is 0..1.
function playSound(value, volume) {
  if (!value) return;
  const vol = Math.min(1, Math.max(0, Number(volume) || 0));
  if (value.startsWith("custom_")) {
    chrome.storage.local.get("audiosPersonalizados", (data) => {
      const audio = (data.audiosPersonalizados || {})[value];
      if (audio && audio.data) {
        const a = new Audio(audio.data);
        a.volume = vol;
        a.play().catch(() => {});
      }
    });
  } else {
    const a = new Audio(chrome.runtime.getURL("assets/sounds/" + value));
    a.volume = vol;
    a.play().catch(() => {});
  }
}

// ── Theme (dark/light) ───────────────────────────────────────
// One source for every page. Theme is driven by [data-theme] on <html>
// (see variaveis.css); the popup uses the same attribute now too.
function applyDarkMode(enabled) {
  document.documentElement.setAttribute("data-theme", enabled ? "dark" : "light");
}

// Apply the saved theme and keep it in sync across pages/tabs. Falls back to
// the OS preference when there is no chrome.storage (e.g. a doc opened directly).
function watchDarkMode() {
  if (typeof chrome !== "undefined" && chrome.storage) {
    chrome.storage.local.get("darkMode", (d) => applyDarkMode(!!d.darkMode));
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && changes.darkMode) applyDarkMode(!!changes.darkMode.newValue);
    });
  } else {
    applyDarkMode(window.matchMedia("(prefers-color-scheme: dark)").matches);
  }
}

// ── Toast ─────────────────────────────────────────────────────
// One implementation for every surface, including the Salesforce content
// script. The injected CSS reads brand tokens when the page loads
// variaveis.css (popup/options/pricing/privacy) and falls back to literal
// hex in the content script, which can't see our CSS variables.
function showToast(message, type, duration) {
  if (!type) type = "info";
  if (!duration) duration = 4000;

  if (!document.getElementById("insv-toast-style")) {
    const s = document.createElement("style");
    s.id = "insv-toast-style";
    s.textContent = [
      "#insv-toast-container{position:fixed;bottom:30px;right:20px;z-index:2147483647;",
      "display:flex;flex-direction:column;gap:10px;pointer-events:none;",
      "font-family:var(--font-ui,'Outfit',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif)}",
      ".insv-toast{width:300px;padding:14px 18px;border-radius:var(--radius-md,8px);",
      "color:var(--white-color,#fff);font-size:0.9rem;font-weight:600;",
      "line-height:var(--leading-snug,1.4);",
      "box-shadow:var(--box-shadow,0 8px 24px -8px rgba(0,0,0,.35),0 2px 6px -2px rgba(0,0,0,.25));",
      // AA: white text needs brand-600/success-700, not brand-500/success-500
      "background:var(--brand-600,#0085BB);opacity:0;transform:translateY(10px);",
      "transition:opacity var(--dur-base,200ms) var(--ease-out,ease),transform var(--dur-base,200ms) var(--ease-out,ease)}",
      ".insv-toast.show{opacity:1;transform:translateY(0)}",
      ".insv-toast.success{background:var(--success-700,#15803D)}",
      ".insv-toast.error{background:var(--danger-500,#EF4444)}",
      ".insv-toast.warning{background:var(--gold-500,#FFD166);color:var(--ink-800,#1B2340)}",
      ".insv-toast.info{background:var(--brand-600,#0085BB)}",
      "@media (prefers-reduced-motion:reduce){.insv-toast{transition:opacity var(--dur-fast,150ms) linear;",
      "transform:none}.insv-toast.show{transform:none}}",
    ].join("");
    document.head.appendChild(s);
  }

  let container = document.getElementById("insv-toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "insv-toast-container";
    container.setAttribute("role", "status");
    container.setAttribute("aria-live", "polite");
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = "insv-toast " + type;
  toast.textContent = message;
  container.appendChild(toast);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => toast.classList.add("show"));
  });
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => { if (toast.parentNode) toast.remove(); }, 250);
  }, duration);
}

// Canonical queue shape — one source for the default fields.
const DEFAULT_INTERVAL = 15;
const DEFAULT_SOUND = "notification.mp3";
function defaultQueue(overrides) {
  return Object.assign(
    {
      name: "",
      active: true,
      interval: DEFAULT_INTERVAL,
      soundEnabled: false,
      customSound: DEFAULT_SOUND,
    },
    overrides || {}
  );
}

// ── Custom sound dropdown (qsd) ──────────────────────────────
// A styled replacement for the native <select>, shared by the popup queue
// rows and the options status-notification rows. Exposes root.value (get/set)
// and dispatches a "change" event, matching the old <select> API. Styles live
// in styles/sound-dropdown.css.

// Markup for one dropdown. extraClass tags the root (e.g. "qm-sound") so
// existing value-reading code (row.querySelector(".qm-sound").value) keeps
// working against the .value getter installed by buildSoundDropdown.
function soundDropdownMarkup(extraClass) {
  const cls = extraClass ? " " + extraClass : "";
  return (
    '<div class="queue-sound-select' + cls + '">' +
    '<button type="button" class="qsd-trigger" aria-haspopup="listbox" aria-expanded="false">' +
    '<span class="qsd-label"></span>' +
    '<svg class="qsd-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>' +
    '</button>' +
    '<ul class="qsd-list" role="listbox" hidden></ul>' +
    '</div>'
  );
}

// Clear a menu's inline fixed positioning.
function resetSoundMenuPosition(list) {
  list.style.position = "";
  list.style.top = "";
  list.style.left = "";
  list.style.maxHeight = "";
  list.style.transformOrigin = "";
}

// Hide after the exit transition so the menu animates out instead of snapping.
// Timeout-guarded: the menu always ends up hidden even if a transitionend never
// arrives (reduced motion, tab switch), so it can never get stuck visible.
const QSD_EXIT_MS = 170; // --dur-fast (150ms) + buffer
function scheduleSoundMenuHide(list) {
  if (!list) return;
  clearTimeout(list._hideT);
  list._hideT = setTimeout(() => {
    list.hidden = true;
    resetSoundMenuPosition(list);
  }, QSD_EXIT_MS);
}

// Position the menu as fixed (escapes overflow of the popup/options scroll
// container) and flip it upward when there isn't room below.
function positionSoundMenu(trigger, list) {
  const GAP = 3;
  const PAD = 8;
  const MENU_W = 150;
  const r = trigger.getBoundingClientRect();
  const vh = window.innerHeight;

  list.style.position = "fixed";
  list.style.width = MENU_W + "px";
  list.style.left = r.left + "px";
  list.style.maxHeight = "240px";

  const menuH = list.offsetHeight;
  const below = vh - r.bottom - PAD;
  const above = r.top - PAD;
  const placeUp = below < Math.min(menuH, 240) && above > below;
  const space = placeUp ? above : below;

  list.style.maxHeight = Math.min(240, space) + "px";

  if (placeUp) {
    list.style.top = Math.max(PAD, r.top - list.offsetHeight - GAP) + "px";
    list.style.transformOrigin = "bottom left";
  } else {
    list.style.top = r.bottom + GAP + "px";
    list.style.transformOrigin = "top left";
  }
}

// Close every open sound dropdown (except the passed one).
function closeAllSoundDropdowns(except) {
  document.querySelectorAll(".queue-sound-select.open").forEach((root) => {
    if (root === except) return;
    root.classList.remove("open");
    const list = root.querySelector(".qsd-list");
    const trigger = root.querySelector(".qsd-trigger");
    if (trigger) trigger.setAttribute("aria-expanded", "false");
    scheduleSoundMenuHide(list); // animate out, then hide
  });
}

// Scroll/resize close any open menu (fixed position doesn't follow scroll).
let soundDropdownScrollBound = false;
function bindSoundDropdownDismiss() {
  if (soundDropdownScrollBound) return;
  const onMove = () => closeAllSoundDropdowns();
  // Capturing scroll listener on the document catches scroll from ANY
  // descendant (popup's #queue-list, the options page/section) — scroll events
  // don't bubble, but the capture phase still delivers them here, so one
  // listener works for both pages.
  document.addEventListener("scroll", onMove, { passive: true, capture: true });
  window.addEventListener("resize", onMove);
  soundDropdownScrollBound = true;
}

// One document-level outside-click listener for the page lifetime.
let soundDropdownOutsideBound = false;
function bindSoundDropdownOutside() {
  if (soundDropdownOutsideBound) return;
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".queue-sound-select")) closeAllSoundDropdowns();
  });
  soundDropdownOutsideBound = true;
}

let qsdSeq = 0;
// buildSoundDropdown(root, opts?) — wire one dropdown.
//   opts.onPreview(value): optional, called when an option is committed (used
//   by the options page to preview the chosen sound).
function buildSoundDropdown(root, opts) {
  if (root._qsdBuilt) return;

  const trigger = root.querySelector(".qsd-trigger");
  const list = root.querySelector(".qsd-list");
  if (!list.id) list.id = "qsd-list-" + (++qsdSeq);
  trigger.setAttribute("aria-controls", list.id);

  Object.defineProperty(root, "value", {
    configurable: true,
    get() {
      return root.dataset.value || "";
    },
    set(v) {
      root.dataset.value = v;
      applySoundSelection(root);
    },
  });

  const getOptions = () => Array.from(list.querySelectorAll(".qsd-option"));

  const setActive = (opt) => {
    if (!opt) return;
    getOptions().forEach((o) => o.classList.remove("active"));
    opt.classList.add("active");
    trigger.setAttribute("aria-activedescendant", opt.id);
    opt.scrollIntoView({ block: "nearest" });
  };

  const moveActive = (dir) => {
    const opts2 = getOptions();
    if (!opts2.length) return;
    let idx = opts2.indexOf(list.querySelector(".qsd-option.active"));
    if (idx < 0) idx = opts2.indexOf(list.querySelector(".qsd-option.selected"));
    idx = Math.max(0, Math.min(opts2.length - 1, (idx < 0 ? 0 : idx) + dir));
    setActive(opts2[idx]);
  };

  const close = () => {
    if (!root.classList.contains("open")) return;
    root.classList.remove("open");
    trigger.setAttribute("aria-expanded", "false");
    trigger.removeAttribute("aria-activedescendant");
    scheduleSoundMenuHide(list); // animate out, then hide
  };

  const open = () => {
    closeAllSoundDropdowns(root); // only one open at a time
    bindSoundDropdownDismiss();
    bindSoundDropdownOutside();
    clearTimeout(list._hideT); // cancel a pending hide from a quick re-open
    list.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
    positionSoundMenu(trigger, list); // forces layout at the closed state…
    // …then flip .open on the next frame so opacity/transform transition in
    requestAnimationFrame(() => {
      if (!list.hidden && trigger.getAttribute("aria-expanded") === "true") {
        root.classList.add("open");
      }
    });
    setActive(list.querySelector(".qsd-option.selected") || list.querySelector(".qsd-option"));
  };

  const commitOption = (opt) => {
    if (!opt) return;
    const val = opt.dataset.value;
    if (val !== root.value) {
      root.value = val;
      root.dispatchEvent(new CustomEvent("change", { bubbles: true }));
    }
    if (val && opts && typeof opts.onPreview === "function") opts.onPreview(val);
    close();
    trigger.focus();
  };

  trigger.addEventListener("click", (e) => {
    e.stopPropagation();
    root.classList.contains("open") ? close() : open();
  });

  list.addEventListener("click", (e) => {
    const opt = e.target.closest(".qsd-option");
    if (opt) commitOption(opt);
  });

  // Full ARIA listbox keyboard contract.
  root.addEventListener("keydown", (e) => {
    const isOpen = root.classList.contains("open");
    switch (e.key) {
      case "Escape":
        if (isOpen) { e.preventDefault(); close(); trigger.focus(); }
        break;
      case "ArrowDown":
        e.preventDefault();
        isOpen ? moveActive(1) : open();
        break;
      case "ArrowUp":
        e.preventDefault();
        isOpen ? moveActive(-1) : open();
        break;
      case "Home":
        if (isOpen) { e.preventDefault(); setActive(getOptions()[0]); }
        break;
      case "End":
        if (isOpen) { e.preventDefault(); const o = getOptions(); setActive(o[o.length - 1]); }
        break;
      case "Enter":
      case " ":
        if (isOpen) { e.preventDefault(); commitOption(list.querySelector(".qsd-option.active")); }
        break;
    }
  });

  root._qsdBuilt = true;
}

// Mark the selected option and update the trigger label.
function applySoundSelection(root) {
  const value = root.dataset.value || "";
  const label = root.querySelector(".qsd-label");
  let text = value;

  root.querySelectorAll(".qsd-option").forEach((opt) => {
    const selected = opt.dataset.value === value;
    opt.classList.toggle("selected", selected);
    opt.setAttribute("aria-selected", selected ? "true" : "false");
    if (selected) text = opt.dataset.label || opt.textContent;
  });

  if (label) label.textContent = text;
}

// Populate a dropdown's option list (built-in sounds + saved custom audios)
// and select selectedValue.
function loadSoundOptionsForQueue(selectElement, selectedValue) {
  const list = selectElement.querySelector(".qsd-list");
  if (!list) return;
  list.innerHTML = "";

  const addOption = (value, text, full) => {
    const li = document.createElement("li");
    li.className = "qsd-option";
    li.id = "qsd-opt-" + (++qsdSeq);
    li.setAttribute("role", "option");
    li.dataset.value = value;
    li.dataset.label = full || text;
    if (full && full !== text) li.title = full;

    const span = document.createElement("span");
    span.textContent = text;
    li.appendChild(span);

    // check on the selected option (spec: solid #00A1E0 + check)
    const check = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    check.setAttribute("class", "qsd-check");
    check.setAttribute("width", "11");
    check.setAttribute("height", "11");
    check.setAttribute("viewBox", "0 0 24 24");
    check.setAttribute("fill", "none");
    check.setAttribute("stroke", "currentColor");
    check.setAttribute("stroke-width", "2.5");
    check.setAttribute("stroke-linecap", "round");
    check.setAttribute("stroke-linejoin", "round");
    check.innerHTML = '<polyline points="20 6 9 17 4 12"></polyline>';
    li.appendChild(check);

    list.appendChild(li);
  };

  BUILTIN_SOUNDS.forEach((s) => addOption(s.value, s.text || t(s.labelKey)));

  chrome.storage.local.get("audiosPersonalizados", (data) => {
    const customAudios = data.audiosPersonalizados || {};
    const customKeys = Object.keys(customAudios);

    if (customKeys.length > 0) {
      const sep = document.createElement("li");
      sep.className = "qsd-sep";
      sep.setAttribute("aria-hidden", "true");
      list.appendChild(sep);

      customKeys.forEach((key) => {
        const name = (customAudios[key] && customAudios[key].name) || "";
        const truncated = name.length > 28 ? name.slice(0, 27) + "…" : name;
        addOption(key, truncated, name);
      });
    }

    selectElement.value = selectedValue;
  });
}
