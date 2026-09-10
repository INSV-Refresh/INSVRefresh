const normalMode = document.getElementById("normal-mode");
const legacyMode = document.getElementById("legacy-mode");
const volumeSlider = document.getElementById("volumeSlider");
const legacyText = document.getElementById("legacy-text");
const statusSpan = document.getElementById("status");
const queueList = document.getElementById("queue-list");
const addQueueBtn = document.getElementById("add-queue-btn");

const legacyInterval = document.getElementById("legacyInterval");
const legacyToggle = document.getElementById("legacyToggle");

const volumeControl = document.getElementById("volume-control");
const feedbackLink = document.querySelector(".feedback-link");

function toggleMode(isLegacyMode) {
  if (isLegacyMode) {
    normalMode.style.display = "none";
    legacyMode.style.display = "flex";
    if (volumeControl) volumeControl.style.display = "none";
    legacyText.style.display = "block";
    if (feedbackLink) feedbackLink.style.display = "none";
  } else {
    normalMode.style.display = "block";
    legacyMode.style.display = "none";
    if (volumeControl) volumeControl.style.display = "flex";
    legacyText.style.display = "none";
    if (feedbackLink) feedbackLink.style.display = "";
  }
}

function updateSliderFill(slider) {
  const pct = ((slider.value - slider.min) / (slider.max - slider.min)) * 100;
  slider.style.setProperty("--pct", pct + "%");
}

function showSaving() {
  statusSpan.textContent = t("saving");
  setTimeout(() => (statusSpan.textContent = ""), 1800);
}

function updateLegacyToggle(active) {
  if (active) {
    legacyToggle.className = "queue-active";
    legacyToggle.textContent = t("active");
  } else {
    legacyToggle.className = "queue-inactive";
    legacyToggle.textContent = t("inactive");
  }
}

function saveLegacyConfig() {
  // Clamp here so a cleared field can't store NaN (which drives a tight
  // refresh loop on the content-script side).
  const parsed = parseInt(legacyInterval.value, 10);
  const interval = Number.isFinite(parsed) ? Math.min(900, Math.max(5, parsed)) : 10;
  const active = legacyToggle.classList.contains("queue-active");
  
  chrome.storage.sync.set({
    legacyInterval: interval,
    legacyActive: active,
  }, showSaving);
}

legacyToggle.addEventListener("click", () => {
  const isCurrentlyActive = legacyToggle.classList.contains("queue-active");
  updateLegacyToggle(!isCurrentlyActive);
  saveLegacyConfig();
});

legacyInterval.addEventListener("input", saveLegacyConfig);
legacyInterval.addEventListener("change", saveLegacyConfig);
attachScrollToInterval(legacyInterval);


function createQueueElement(queue) {
  const isFirst = queueList.children.length === 0;
  const div = document.createElement("div");
  div.className = "queue-item";
  // Keep the original queue object so saveOptions can preserve fields the popup
  // doesn't render (notably statusNotify — the premium status-notification rules
  // owned by the options page). Survives drag reorder since it rides the node.
  div._insvQueue = queue || {};

  div.innerHTML = `
<div class="drag-handle has-tooltip" data-tooltip="${t("drag_reorder")}" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="9" cy="6" r="1" fill="currentColor"/><circle cx="15" cy="6" r="1" fill="currentColor"/><circle cx="9" cy="12" r="1" fill="currentColor"/><circle cx="15" cy="12" r="1" fill="currentColor"/><circle cx="9" cy="18" r="1" fill="currentColor"/><circle cx="15" cy="18" r="1" fill="currentColor"/></svg></div>
<div class="adjustments-containers-1-and-2">
<div class="container-1">
<div class="queue-name-wrapper">
<input type="text" placeholder="${t("queue_name_ph")}" value="${escapeHtml(queue.name || "")}" class="queue-name" aria-label="${t("queue_name_ph")}">
<button type="button" class="copy-queue-name-btn has-tooltip has-tooltip-default" data-tooltip="${t("copy_queue_name")}" aria-label="${t("copy_queue_name")}"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
</div>
<label class="active-toggle">
<button type="button" class="${queue.active ? "queue-active" : "queue-inactive"}" aria-pressed="${queue.active ? "true" : "false"}">${queue.active ? t("active") : t("inactive")}</button>
</label>
</div>
<div class="container-2">
<div class="input-wrapper">
<input type="number" class="queue-interval" value="${queue.interval || 15}" min="5" max="900">
<span class="seconds">s</span>
</div>
<button class="queue-sound has-tooltip has-tooltip-default ${queue.soundEnabled ? "" : "off"}" data-tooltip="${t("tt_notify_new")}" aria-label="${t("tt_notify_new")}">
<svg class="bell-icon-on" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
<svg class="bell-icon-off" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/><line x1="2" y1="2" x2="22" y2="22"/></svg>
</button>
<div class="sound-container" style="display: ${queue.soundEnabled ? "inline-flex" : "none"};">
<div class="queue-sound-select">
<button type="button" class="qsd-trigger" aria-haspopup="listbox" aria-expanded="false"><span class="qsd-label"></span><svg class="qsd-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>
<ul class="qsd-list" role="listbox" hidden></ul>
</div>
</div>
${isFirst ? "" : `<button class="delete-queue has-tooltip has-tooltip-default" data-tooltip="${t("remove_queue")}" aria-label="${t("remove_queue")}"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14"></path></svg></button>`}
</div>
</div>
`;

  if (!isFirst) {
    const deleteBtn = div.querySelector(".delete-queue");
    deleteBtn.addEventListener("click", () => {
      div.remove();
      saveOptions();
      chrome.runtime.sendMessage({ type: "GET_ACCESS_LEVEL" }, (access) => {
        if (!chrome.runtime.lastError) applyPaidGate(!!(access && access.isPaid));
      });
    });
  }

  div.querySelectorAll("input").forEach((input) => {
    input.addEventListener("input", saveOptionsDebounced);
    input.addEventListener("change", saveOptionsDebounced);
  });

  const intervalInput = div.querySelector(".queue-interval");
  if (intervalInput) attachScrollToInterval(intervalInput);

  const nameInput = div.querySelector(".queue-name");
  if (nameInput) {
    nameInput.addEventListener("change", () => {
      nameInput.classList.add("queue-name-saved");
      setTimeout(() => nameInput.classList.remove("queue-name-saved"), 1500);
    });
  }

  const copyBtn = div.querySelector(".copy-queue-name-btn");
  if (copyBtn) {
    copyBtn.addEventListener("click", () => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs[0] || !tabs[0].url || !tabs[0].url.includes("lightning.force.com")) {
          if (typeof statusSpan !== "undefined") statusSpan.textContent = t("open_sf");
          setTimeout(() => { if (statusSpan) statusSpan.textContent = ""; }, 2000);
          return;
        }
        chrome.tabs.sendMessage(tabs[0].id, { type: "GET_QUEUE_NAME" }, (response) => {
          if (chrome.runtime.lastError) {
            if (typeof statusSpan !== "undefined") statusSpan.textContent = t("reload_sf");
            setTimeout(() => { if (statusSpan) statusSpan.textContent = ""; }, 2000);
            return;
          }
          const queueName = (response && response.queueName || "").trim();
          if (!queueName) {
            if (typeof statusSpan !== "undefined") statusSpan.textContent = t("detect_fail");
            setTimeout(() => { if (statusSpan) statusSpan.textContent = ""; }, 2000);
            return;
          }
          navigator.clipboard.writeText(queueName).then(() => {
            const nameInput = div.querySelector(".queue-name");
            if (nameInput) nameInput.value = queueName;
            if (typeof statusSpan !== "undefined") statusSpan.textContent = t("copied", { name: queueName });
            setTimeout(() => { if (statusSpan) statusSpan.textContent = ""; }, 2000);
            saveOptions();
          }).catch(() => {
            if (typeof statusSpan !== "undefined") statusSpan.textContent = t("copy_fail");
            setTimeout(() => { if (statusSpan) statusSpan.textContent = ""; }, 2000);
          });
        });
      });
    });
  }

  if (!isFirst) attachQueueDrag(div);

  const activeBtn = div.querySelector(".active-toggle button");
  activeBtn.addEventListener("click", () => {
    const isActive = activeBtn.classList.contains("queue-active");
    activeBtn.classList.toggle("queue-active", !isActive);
    activeBtn.classList.toggle("queue-inactive", isActive);
    activeBtn.setAttribute("aria-pressed", isActive ? "false" : "true");
    activeBtn.textContent = isActive ? t("inactive") : t("active");
    saveOptionsDebounced();
  });

  const soundBtn = div.querySelector(".queue-sound");
  soundBtn.addEventListener("click", () => {
    soundBtn.classList.toggle("off");
    const soundContainer = div.querySelector(".sound-container");
    if (!soundBtn.classList.contains("off")) {
      soundContainer.style.display = "inline-flex";
    } else {
      soundContainer.style.display = "none";
    }
    saveOptionsDebounced();
  });

  const queueSoundSelect = div.querySelector(".queue-sound-select");

  if (queueSoundSelect) {
    buildSoundDropdown(queueSoundSelect);
    queueSoundSelect.addEventListener("change", () => {
      if (queueSoundSelect.value) {
        playQueueTestSound(queueSoundSelect.value);
      }
      saveOptionsDebounced();
    });

    // Fallback "Padrão" — filas antigas com customSound vazio mostram
    // o som Padrão selecionado em vez de um select em branco
    loadSoundOptionsForQueue(queueSoundSelect, queue.customSound || "notification.mp3");
  }

  return div;
}

// The custom sound dropdown (buildSoundDropdown / loadSoundOptionsForQueue /
// positioning + dismiss helpers) now lives in scripts/util.js so the options
// status-notification rows can reuse the exact same component. Loaded before
// this file. The popup builds the trigger/list markup inline in
// createQueueElement; options uses soundDropdownMarkup().

function attachScrollToInterval(input) {
  input.addEventListener('wheel', (e) => {
    e.preventDefault();
    const step = e.shiftKey ? 10 : 1;
    const val = parseInt(input.value, 10) || 0;
    const min = parseInt(input.min, 10) || 5;
    const max = parseInt(input.max, 10) || 900;
    input.value = Math.min(max, Math.max(min, val - Math.sign(e.deltaY) * step));
    input.dispatchEvent(new Event('change'));
  }, { passive: false });
}

// Filas excedentes ocultadas no plano free. Não são apagadas do
// storage — apenas deixam de ser renderizadas, e voltam quando o
// usuário voltar a ser pago.
let hiddenPaidQueues = [];

// Guarda das gravações feitas pelo próprio popup, para não re-renderizar (e
// perder foco) quando o onChanged for nosso próprio save. Set, não slot
// único: duas gravações sobrepostas (ex. drag reorder + edit debounced)
// podiam fazer a 2ª pisar na assinatura da 1ª antes do onChanged dela
// chegar, fazendo o próprio save parecer externo e disparar re-render.
let pendingSelfWriteQueues = new Set();

function saveOptions() {
  const queues = [];
  queueList.querySelectorAll(".queue-item").forEach((item) => {
    const soundSelect = item.querySelector(".queue-sound-select");
    const nameInput = item.querySelector(".queue-name");
    const activeBtn = item.querySelector(".active-toggle button");
    const intervalInput = item.querySelector(".queue-interval");
    const soundBtn = item.querySelector(".queue-sound");

    if (nameInput && intervalInput && soundBtn) {
      queues.push(Object.assign({}, item._insvQueue || {}, {
        name: nameInput.value,
        active: activeBtn ? activeBtn.getAttribute("aria-pressed") === "true" : false,
        interval: parseInt(intervalInput.value, 10),
        soundEnabled: !soundBtn.classList.contains("off"),
        customSound: soundSelect ? soundSelect.value : "",
      }));
    }
  });

  const general = {
    volume: parseInt(volumeSlider.value, 10) / 100,
  };

  const fullQueues = queues.concat(hiddenPaidQueues);
  pendingSelfWriteQueues.add(JSON.stringify(fullQueues));
  chrome.storage.local.set({ queues: fullQueues, general }, showSaving);
}

const saveOptionsDebounced = debounce(saveOptions, 500);

function applyPaidGate(isPaid) {
  const count = queueList.querySelectorAll(".queue-item").length;

  // Remover elementos antigos
  const upgrade = document.getElementById("upgrade-multi-queue");
  if (upgrade) upgrade.remove();
  const banner = document.getElementById("popup-lock-banner");
  if (banner) banner.remove();

  if (!addQueueBtn) return;

  if (!isPaid && count >= 1) {
    // Botão amarelo premium
    addQueueBtn.classList.add("premium-locked");
    addQueueBtn.title = t("multi_queue_paid");
    addQueueBtn.setAttribute("data-tooltip", t("tt_premium"));

    // Link sutil embaixo
    const link = document.createElement("a");
    link.id = "upgrade-multi-queue";
    link.href = chrome.runtime.getURL("pricing.html");
    link.target = "_blank";
    link.textContent = t("subscribe_multi");
    normalMode.appendChild(link);

    // Detach any previously-bound handler first. applyPaidGate re-runs for free
    // users (load, lang change, legacy toggle); overwriting the reference
    // without removing would stack capture listeners, and an even count cancels
    // the banner toggle so it never shows.
    if (addQueueBtn._premiumClickHandler) {
      addQueueBtn.removeEventListener("click", addQueueBtn._premiumClickHandler, { capture: true });
    }
    // Ao clicar no botão travado, mostrar banner em vez de ignorar
    addQueueBtn._premiumClickHandler = (e) => {
      e.stopPropagation();
      // Remover banner existente se houver
      const existing = document.getElementById("popup-lock-banner");
      if (existing) { existing.remove(); return; }

      const lockBanner = document.createElement("div");
      lockBanner.id = "popup-lock-banner";
      lockBanner.className = "popup-lock-banner";
      lockBanner.innerHTML = `
        ${t("locked_paid")}
        <a href="${chrome.runtime.getURL('pricing.html')}" target="_blank">${t("see_plans")}</a>
      `;
      normalMode.insertBefore(lockBanner, addQueueBtn);

      // Auto-esconder após 3s
      setTimeout(() => lockBanner.remove(), 3500);
    };
    addQueueBtn.addEventListener("click", addQueueBtn._premiumClickHandler, { capture: true });

  } else {
    // Resetar botão
    addQueueBtn.classList.remove("premium-locked");
    addQueueBtn.removeAttribute("title");
    addQueueBtn.setAttribute("data-tooltip", t("tt_add_queue"));

    if (addQueueBtn._premiumClickHandler) {
      addQueueBtn.removeEventListener("click", addQueueBtn._premiumClickHandler, { capture: true });
      delete addQueueBtn._premiumClickHandler;
    }
  }
}

function renderHiddenQueuesNote() {
  const existing = document.getElementById("hidden-queues-note");
  if (existing) existing.remove();
  if (hiddenPaidQueues.length === 0) return;

  const note = document.createElement("div");
  note.id = "hidden-queues-note";
  note.className = "hidden-queues-note";
  note.innerHTML = hiddenPaidQueues.length === 1 ? t("hidden_one") : t("hidden_many", { n: hiddenPaidQueues.length });
  normalMode.insertBefore(note, addQueueBtn);
}

function restoreOptions() {
  chrome.storage.local.get(["queues", "general"], (data) => {
    let queues = data.queues || [];

    if (queues.length === 0) {
      queues = [defaultQueue()];
      pendingSelfWriteQueues.add(JSON.stringify(queues));
      chrome.storage.local.set({ queues });
    }

    const general = data.general || {
      volume: 0.5,
    };

    volumeSlider.value = general.volume * 100;
    updateSliderFill(volumeSlider);

    chrome.runtime.sendMessage({ type: "GET_ACCESS_LEVEL" }, (access) => {
      const isPaid = !chrome.runtime.lastError && !!(access && access.isPaid);

      // No free, renderizar somente a fila principal (única funcional);
      // as demais ficam guardadas em hiddenPaidQueues e preservadas no save
      hiddenPaidQueues = isPaid ? [] : queues.slice(1);
      const visibleQueues = isPaid ? queues : queues.slice(0, 1);

      queueList.innerHTML = "";
      visibleQueues.forEach((queue) => {
        const el = createQueueElement(queue);
        queueList.appendChild(el);
      });

      renderHiddenQueuesNote();
      applyPaidGate(isPaid);
    });
  });
}

function addQueueHandler() {
  // Se está travado no modo premium, o handler de capture já tratou — não fazer nada
  if (addQueueBtn.classList.contains("premium-locked")) return;

  chrome.runtime.sendMessage({ type: "GET_ACCESS_LEVEL" }, (access) => {
    const isPaid = !!(access && access.isPaid);
    const count = queueList.querySelectorAll(".queue-item").length;
    if (!isPaid && count >= 1) return;
    const newQueue = defaultQueue();
    const el = createQueueElement(newQueue);
    queueList.appendChild(el);
    saveOptions();
    applyPaidGate(isPaid);
  });
}

function playQueueTestSound(soundValue) {
  playSound(soundValue, parseInt(volumeSlider.value, 10) / 100);
}

if (addQueueBtn) {
  addQueueBtn.addEventListener("click", addQueueHandler);
}

if (volumeSlider) {
  volumeSlider.addEventListener("input", () => updateSliderFill(volumeSlider));
  volumeSlider.addEventListener("mouseup", () => {
    playQueueTestSound("notification.mp3");
    saveOptionsDebounced();
  });
}

/* ── Queue reorder ─────────────────────────────────────────────
   Pointer-driven rather than HTML5 drag-and-drop. DnD hands the browser a
   ghost image and reports only a final drop target, which costs the three
   things that make a reorder feel physical: the row can't track the pointer
   1:1 from the point it was grabbed, the gesture can't be redirected once
   it's underway, and a flick lands where the pointer stopped instead of where
   it was thrown. Pointer Events give all three back, and cover touch and pen.

   Nothing moves in the DOM until the gesture ends. Reordering mid-drag is the
   obvious implementation and it is a trap: insertBefore on a node that already
   has a parent removes it first, and removing the subtree holding the captured
   .drag-handle implicitly releases the pointer capture. Moves and the release
   then stop being delivered, so the row sticks to the screen until the pointer
   wanders back over the handle. Instead the drag only ever writes transforms —
   the row follows the pointer, the rows it displaces slide out of its way —
   and the single DOM move happens once, after the row has settled.
   ───────────────────────────────────────────────────────────── */

const DRAG_THRESHOLD = 6;     // px of movement before a press becomes a drag
const DRAG_EDGE = 36;         // px from the list edge where auto-scroll starts
const DRAG_EDGE_SPEED = 0.5;  // scroll px per px into the edge, per frame

let activeDrag = null;

function queueItemTranslate(el) {
  // The live on-screen value. Interrupting a settle has to resume from what
  // the user can see, not from the value the spring was heading toward.
  const t = getComputedStyle(el).transform;
  if (!t || t === "none") return 0;
  return new DOMMatrixReadOnly(t).m42;
}

function attachQueueDrag(item) {
  const handle = item.querySelector(".drag-handle");
  if (handle) handle.addEventListener("pointerdown", startQueueDrag);
}

function startQueueDrag(e) {
  if (e.pointerType === "mouse" && e.button !== 0) return;
  if (activeDrag) return;

  const handle = e.currentTarget;
  const item = handle.closest(".queue-item");
  if (!item || item === queueList.firstElementChild) return; // first queue is pinned

  // Grabbing a row that is still settling takes it over mid-flight instead of
  // waiting for the spring to finish.
  if (item._insvSettle) {
    item._insvSettle.stop();
    item._insvSettle = null;
  }
  clearTimeout(item._insvSettleT);

  e.preventDefault();

  activeDrag = {
    item: item,
    handle: handle,
    pointerId: e.pointerId,
    // Offset from where the row was actually grabbed, so it doesn't jump to
    // centre itself under the pointer.
    grabOffset: e.clientY - item.getBoundingClientRect().top,
    startY: e.clientY,
    pointerY: e.clientY,
    translate: queueItemTranslate(item),
    lifted: false,
    tracker: createVelocityTracker(100),
    raf: 0,
    layout: null,
    toIndex: -1,
  };

  // Capture keeps moves coming when the pointer leaves the 14px handle. It
  // throws if the pointer is already gone; the drag still works through normal
  // dispatch, so this must not take the gesture down with it.
  try { handle.setPointerCapture(e.pointerId); } catch (err) { /* no capture, still draggable */ }
  handle.addEventListener("pointermove", moveQueueDrag);
  handle.addEventListener("pointerup", endQueueDrag);
  handle.addEventListener("pointercancel", endQueueDrag);
  // Belt and braces: if capture is ever lost for a reason outside this file,
  // end the gesture rather than leaving a row stranded mid-air.
  handle.addEventListener("lostpointercapture", endQueueDrag);
}

/** Freeze the row geometry once, at lift. Every later frame reasons about
    these numbers, so the layout cannot shift under the gesture. */
function snapshotQueueLayout(item) {
  const rows = Array.prototype.slice.call(queueList.children);
  const rects = rows.map((n) => n.getBoundingClientRect());
  const index = rows.indexOf(item);
  // Measured, not assumed: the row gap is a margin today and could become a
  // flex or grid gap tomorrow.
  const gap = rects.length > 1 ? Math.max(0, rects[1].top - rects[0].bottom) : 0;
  return {
    rows: rows,
    rects: rects,
    index: index,
    slot: rects[index].height + gap,
    scrollTop: queueList.scrollTop,
  };
}

function moveQueueDrag(e) {
  if (!activeDrag || e.pointerId !== activeDrag.pointerId) return;
  activeDrag.pointerY = e.clientY;
  activeDrag.tracker.add(e.clientY);

  if (activeDrag.lifted) return;
  // Hysteresis: a press that drifts a couple of pixels is still a press.
  if (Math.abs(e.clientY - activeDrag.startY) < DRAG_THRESHOLD) return;

  activeDrag.lifted = true;
  activeDrag.layout = snapshotQueueLayout(activeDrag.item);
  activeDrag.toIndex = activeDrag.layout.index;
  // The row is about to get a transform, which would make it the containing
  // block for the position:fixed sound menu and drag the menu along with it.
  closeAllSoundDropdowns();
  activeDrag.item.classList.add("dragging");
  activeDrag.item.style.willChange = "transform";
  queueList.classList.add("reordering");
  activeDrag.raf = requestAnimationFrame(queueDragFrame);
}

/** Which slot the row's centre is currently over, in snapshot coordinates. */
function queueTargetIndex(d, centerY) {
  const L = d.layout;
  const mid = (i) => L.rects[i].top + L.rects[i].height / 2;

  let to = L.index;
  for (let i = L.index + 1; i < L.rows.length; i++) {
    if (centerY > mid(i)) to = i; else break;
  }
  for (let i = L.index - 1; i >= 0; i--) {
    if (centerY < mid(i)) to = i; else break;
  }
  return Math.max(1, to); // index 0 is the pinned queue; nothing goes above it
}

/** Slide the rows between the grabbed slot and the hovered one out of the way. */
function applyQueueDisplacement(d, toIndex) {
  const L = d.layout;
  L.rows.forEach((node, i) => {
    if (i === L.index) return;
    let shift = 0;
    if (toIndex > L.index && i > L.index && i <= toIndex) shift = -L.slot;
    else if (toIndex < L.index && i >= toIndex && i < L.index) shift = L.slot;
    const next = shift ? "translateY(" + shift + "px)" : "";
    if (node.style.transform !== next) node.style.transform = next;
  });
}

function queueDragFrame() {
  const d = activeDrag;
  if (!d || !d.lifted) return;

  autoScrollQueue(d.pointerY);

  const L = d.layout;
  // The snapshot was taken at one scroll position; auto-scroll moves the rows
  // under it, so every comparison is corrected by how far the list has scrolled.
  const scrolled = queueList.scrollTop - L.scrollTop;
  const desiredTop = d.pointerY - d.grabOffset;

  d.translate = desiredTop - (L.rects[L.index].top - scrolled);
  d.item.style.transform = "translateY(" + d.translate + "px)";

  const centerY = desiredTop + scrolled + L.rects[L.index].height / 2;
  const to = queueTargetIndex(d, centerY);
  if (to !== d.toIndex) {
    d.toIndex = to;
    applyQueueDisplacement(d, to);
  }

  d.raf = requestAnimationFrame(queueDragFrame);
}

function autoScrollQueue(pointerY) {
  const box = queueList.getBoundingClientRect();
  let delta = 0;
  if (pointerY < box.top + DRAG_EDGE) {
    delta = (pointerY - (box.top + DRAG_EDGE)) * DRAG_EDGE_SPEED;
  } else if (pointerY > box.bottom - DRAG_EDGE) {
    delta = (pointerY - (box.bottom - DRAG_EDGE)) * DRAG_EDGE_SPEED;
  }
  if (delta) queueList.scrollTop += delta;
}

/** The one DOM write of the whole gesture. Runs the instant the pointer is
    released, never at the end of an animation: the order is what the user
    asked for, so it must not depend on a spring being allowed to finish.
    Returns how far the dragged row has to travel to reach its new slot, or
    null if the list changed underneath and the gesture has to be abandoned. */
function commitQueueOrder(d) {
  const L = d.layout;
  const to = d.toIndex;

  // An external storage change can call restoreOptions() and rebuild the whole
  // list mid-gesture. The snapshot then points at detached nodes, and writing
  // this order back would resurrect a stale row. The rebuilt list already has
  // the right contents, so drop the gesture instead.
  if (!d.item.isConnected || !queueList.contains(L.rows[to])) return null;

  const before = L.rows.map((n) => n.getBoundingClientRect().top);

  L.rows.forEach((n) => { n.style.transition = "none"; });

  if (to !== L.index) {
    const ref = to > L.index ? L.rows[to].nextElementSibling : L.rows[to];
    queueList.insertBefore(d.item, ref);
  }

  L.rows.forEach((n) => { n.style.transform = ""; });
  void queueList.offsetHeight;

  // FLIP the rows that moved: put them back where they looked a moment ago…
  let travel = 0;
  L.rows.forEach((n, i) => {
    const dy = before[i] - n.getBoundingClientRect().top;
    if (n === d.item) { travel = dy; return; } // the spring owns the dragged row
    n.style.transform = dy ? "translateY(" + dy + "px)" : "";
  });
  void queueList.offsetHeight;

  // …then hand them back to CSS to play home.
  L.rows.forEach((n) => {
    n.style.transition = "";
    if (n !== d.item) n.style.transform = "";
  });
  return travel;
}

function endQueueDrag(e) {
  const d = activeDrag;
  if (!d || e.pointerId !== d.pointerId) return;

  d.handle.removeEventListener("pointermove", moveQueueDrag);
  d.handle.removeEventListener("pointerup", endQueueDrag);
  d.handle.removeEventListener("pointercancel", endQueueDrag);
  d.handle.removeEventListener("lostpointercapture", endQueueDrag);
  if (d.handle.hasPointerCapture(e.pointerId)) d.handle.releasePointerCapture(e.pointerId);

  activeDrag = null;
  if (!d.lifted) return; // a press that never turned into a drag

  cancelAnimationFrame(d.raf);
  queueList.classList.remove("reordering");

  const item = d.item;
  // Only a real release carries momentum. A cancel or a lost capture drops the
  // row where it stands. The clamp is against one freak sample turning a normal
  // drag into a fling across the whole list.
  const raw = e.type === "pointerup" ? d.tracker.velocity() : 0;
  const velocity = Math.max(-3000, Math.min(3000, raw));

  // Land where the flick was heading, not where the pointer happened to stop.
  // 0.99 rather than the 0.998 of a scroll view: this list is a few hundred
  // pixels tall, so scroll-length coasting would send every flick to the end.
  const L = d.layout;
  const scrolled = queueList.scrollTop - L.scrollTop;
  const projectedCenter =
    d.pointerY - d.grabOffset + scrolled + L.rects[L.index].height / 2 +
    projectMomentum(velocity, 0.99);

  d.toIndex = queueTargetIndex(d, projectedCenter);

  // Write the order and persist it NOW. Hanging this off the end of the spring
  // meant a popup closed during the settle — a few hundred milliseconds — threw
  // the reorder away, and a stalled frame loop stranded the row permanently.
  const travel = commitQueueOrder(d);

  item.classList.remove("dragging");

  if (travel === null) {           // list rebuilt under us; nothing to animate
    item.style.transform = "";
    item.style.willChange = "";
    return;
  }

  saveOptions();

  item.classList.add("settling");
  item.style.transform = "translateY(" + travel + "px)";

  const land = function () {
    item.style.transform = "";
    item.style.willChange = "";
    item.classList.remove("settling");
    item._insvSettle = null;
  };

  item._insvSettle = springTo({
    from: travel,
    to: 0,
    velocity: velocity, // continue at the pointer's exact speed
    damping: 0.8,       // the gesture carried momentum, so a little overshoot fits
    response: 0.3,
    onFrame: function (y) {
      item.style.transform = "translateY(" + y + "px)";
    },
    onDone: land,
  });

  // The frame loop can be starved (a backgrounded popup, a throttled tab). The
  // order is already saved by then, so this only cleans up the leftover offset.
  clearTimeout(item._insvSettleT);
  item._insvSettleT = setTimeout(function () {
    if (item._insvSettle) { item._insvSettle.stop(); land(); }
  }, 1200);
}

// ── Indicador de pausa global ───────────────────────
const globalPausedBanner = document.getElementById("global-paused-banner");
const resumeAllBtn = document.getElementById("resume-all-btn");

function renderGlobalPaused(paused) {
  if (globalPausedBanner) globalPausedBanner.style.display = paused ? "flex" : "none";
}

chrome.storage.local.get("advanced", (data) => {
  renderGlobalPaused(!!(data.advanced && data.advanced.globalPaused));
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.advanced) {
    renderGlobalPaused(!!(changes.advanced.newValue && changes.advanced.newValue.globalPaused));
  }
});

if (resumeAllBtn) {
  resumeAllBtn.addEventListener("click", () => {
    chrome.storage.local.get("advanced", (data) => {
      const adv = data.advanced || {};
      adv.globalPaused = false;
      chrome.storage.local.set({ advanced: adv });
    });
  });
}

// ── Indicador de horário de expediente ──────────────
// O popup é efêmero: avaliar na abertura (e em mudança de config) basta —
// não precisa de timer acompanhando o relógio.
const workScheduleBanner = document.getElementById("work-schedule-banner");

function renderWorkScheduleBanner(ws) {
  if (!workScheduleBanner) return;
  const fora = ws && ws.enabled && !isWithinWorkSchedule(ws);
  workScheduleBanner.style.display = fora ? "flex" : "none";
}

chrome.storage.local.get("advanced", (data) => {
  renderWorkScheduleBanner(data.advanced && data.advanced.workSchedule);
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.advanced) {
    renderWorkScheduleBanner(changes.advanced.newValue && changes.advanced.newValue.workSchedule);
  }
});

// Aguarda o idioma carregar antes de renderizar conteúdo dinâmico
i18nReady.then(() => {
  chrome.storage.sync.get(["legacyMode", "legacyInterval", "legacyActive"], (result) => {
    if (result.legacyMode) {
      toggleMode(true);
      legacyInterval.value = result.legacyInterval || 10;
      updateLegacyToggle(result.legacyActive || false);
    } else {
      toggleMode(false);
      restoreOptions();
    }
  });
});

// Troca de idioma em runtime: re-renderiza as partes dinâmicas
document.addEventListener("insv-lang-changed", () => {
  chrome.storage.sync.get(["legacyMode", "legacyActive"], (result) => {
    if (result.legacyMode) {
      updateLegacyToggle(result.legacyActive || false);
    } else {
      restoreOptions();
    }
  });
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes.legacyMode) {
    if (changes.legacyMode.newValue) {
      chrome.storage.sync.get(["legacyInterval", "legacyActive"], (result) => {
        toggleMode(true);
        legacyInterval.value = result.legacyInterval || 10;
        updateLegacyToggle(result.legacyActive || false);
      });
    } else {
      toggleMode(false);
      restoreOptions();
    }
  }
});

// ── Dark mode no popup ──────────────────────────────
// Chave única darkMode (chrome.storage.local), controlada pelo toggle do
// options — vale para popup, options e pricing. Migra a antiga popupDarkMode
// na primeira carga.
// O popup NÃO tem tema claro: dark on → [data-theme="dark"] (gradiente +
// tokens escuros); dark off → sem atributo, então o dropdown de som e demais
// consumidores de token caem nos fallbacks escuros, nunca no tema claro.
function applyPopupTheme(dark) {
  freezeThemeTransitions(); // swap the whole popup in one frame, no partial fade
  if (dark) document.documentElement.setAttribute("data-theme", "dark");
  else document.documentElement.removeAttribute("data-theme");
}

chrome.storage.local.get(["darkMode", "popupDarkMode"], (data) => {
  let dark = data.darkMode;
  if (dark === undefined && data.popupDarkMode !== undefined) {
    dark = !!data.popupDarkMode;
    chrome.storage.local.set({ darkMode: dark });
    chrome.storage.local.remove("popupDarkMode");
  }
  applyPopupTheme(!!dark);
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.darkMode) {
    applyPopupTheme(!!changes.darkMode.newValue);
  }
});

// ── Tooltip controller ──────────────────────────────
// Single floating tooltip driven by [data-tooltip]. Uses position:fixed so it
// escapes the popup's overflow:hidden clipping (the old CSS ::after tooltips
// were cut off, which is why a few elements had fallen back to native title=).
// Event delegation covers dynamically-rendered queue rows; focus support makes
// every tooltip keyboard-reachable.
(function initTooltips() {
  let tip = null;
  let activeTarget = null;

  function ensureTip() {
    if (!tip) {
      tip = document.createElement("div");
      tip.className = "insv-tip";
      tip.setAttribute("role", "tooltip");
      document.body.appendChild(tip);
    }
    return tip;
  }

  function position(target, el) {
    const r = target.getBoundingClientRect();
    const gap = 8;
    const margin = 6;
    let top = r.top - el.offsetHeight - gap;
    let placement = "top";
    if (top < margin) {
      top = r.bottom + gap;
      placement = "bottom";
    }
    let left = r.left + r.width / 2 - el.offsetWidth / 2;
    left = Math.max(margin, Math.min(left, window.innerWidth - el.offsetWidth - margin));
    el.style.top = `${Math.round(top)}px`;
    el.style.left = `${Math.round(left)}px`;
    el.dataset.placement = placement;
  }

  function show(target) {
    const text = target.getAttribute("data-tooltip");
    if (!text) return;
    const el = ensureTip();
    el.textContent = text;
    activeTarget = target;
    position(target, el); // offsetWidth/Height valid while opacity:0
    requestAnimationFrame(() => el.classList.add("show"));
  }

  function hide() {
    activeTarget = null;
    if (tip) tip.classList.remove("show");
  }

  function onEnter(e) {
    const target = e.target.closest && e.target.closest("[data-tooltip]");
    if (!target || target === activeTarget || !target.getAttribute("data-tooltip")) return;
    show(target);
  }

  function onLeave(e) {
    if (!activeTarget) return;
    const to = e.relatedTarget;
    if (to && activeTarget.contains(to)) return; // moved within the same target
    hide();
  }

  document.addEventListener("pointerover", onEnter);
  document.addEventListener("pointerout", onLeave);
  document.addEventListener("focusin", onEnter);
  document.addEventListener("focusout", onLeave);
  // Stale positions otherwise: the popup scrolls and elements move.
  window.addEventListener("scroll", hide, true);
  window.addEventListener("resize", hide);
})();
