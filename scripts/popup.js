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
<svg class="bell-icon-off" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13.73 21a2 2 0 0 1-3.46 0"/><path d="M18.63 13A17.9 17.9 0 0 1 18 8"/><path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14"/><path d="m2 2 20 20"/></svg>
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
  } else {
    div.setAttribute("draggable", "false");
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

  if (!isFirst) {
    div.setAttribute("draggable", "true");

    div.addEventListener("dragstart", (e) => {
      div.classList.add("dragging");
    });

    div.addEventListener("dragend", () => {
      div.classList.remove("dragging");
      saveOptions();
    });
  }

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

// Dropdown customizado: substitui o <select> nativo para seguir o
// design do popup. Expõe `.value` (get/set) e dispara evento "change",
// mantendo a mesma API que saveOptions/onChanged já consomem.
// Limpa o posicionamento fixed inline de um menu.
function resetSoundMenuPosition(list) {
  list.style.position = "";
  list.style.top = "";
  list.style.left = "";
  list.style.maxHeight = "";
  list.style.transformOrigin = "";
}

// Posiciona o menu como fixed (escapa do overflow do #queue-list) e
// inverte pra cima quando não há espaço abaixo. Alinhado à direita do
// trigger pra abrir sempre na mesma posição.
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

// Fecha todos os dropdowns de som abertos (exceto o passado).
function closeAllSoundDropdowns(except) {
  document.querySelectorAll(".queue-sound-select.open").forEach((root) => {
    if (root === except) return;
    root.classList.remove("open");
    const list = root.querySelector(".qsd-list");
    const trigger = root.querySelector(".qsd-trigger");
    if (list) {
      list.hidden = true;
      resetSoundMenuPosition(list);
    }
    if (trigger) trigger.setAttribute("aria-expanded", "false");
  });
}

// Scroll/resize fecham qualquer dropdown aberto (posição fixed
// não acompanha o scroll do popup).
let soundDropdownScrollBound = false;
function bindSoundDropdownDismiss() {
  if (soundDropdownScrollBound) return;
  const onMove = () => closeAllSoundDropdowns();
  ["#queue-list", "#normal-mode"].forEach((sel) => {
    const el = document.querySelector(sel);
    if (el) el.addEventListener("scroll", onMove, { passive: true });
  });
  window.addEventListener("resize", onMove);
  soundDropdownScrollBound = true;
}

function buildSoundDropdown(root) {
  if (root._qsdBuilt) return;

  const trigger = root.querySelector(".qsd-trigger");
  const list = root.querySelector(".qsd-list");

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

  const close = () => {
    if (list.hidden) return;
    list.hidden = true;
    root.classList.remove("open");
    trigger.setAttribute("aria-expanded", "false");
    resetSoundMenuPosition(list);
  };

  const open = () => {
    closeAllSoundDropdowns(root); // só um aberto por vez
    bindSoundDropdownDismiss();
    list.hidden = false;
    root.classList.add("open");
    trigger.setAttribute("aria-expanded", "true");
    positionSoundMenu(trigger, list);
    const sel = list.querySelector(".qsd-option.selected");
    if (sel) sel.scrollIntoView({ block: "nearest" });
  };

  trigger.addEventListener("click", (e) => {
    e.stopPropagation();
    list.hidden ? open() : close();
  });

  list.addEventListener("click", (e) => {
    const opt = e.target.closest(".qsd-option");
    if (!opt) return;
    const val = opt.dataset.value;
    if (val === root.value) {
      close();
      return;
    }
    root.value = val;
    close();
    root.dispatchEvent(new CustomEvent("change", { bubbles: true }));
  });

  document.addEventListener("click", (e) => {
    if (!root.contains(e.target)) close();
  });

  root.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      close();
      trigger.focus();
    }
  });

  root._qsdBuilt = true;
}

// Marca a opção selecionada e atualiza o label do trigger.
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

function loadSoundOptionsForQueue(selectElement, selectedValue) {
  const list = selectElement.querySelector(".qsd-list");
  if (!list) return;
  list.innerHTML = "";

  const defaultSounds = [
    { value: "notification.mp3", text: t("sound_default") },
    { value: "tech.mp3", text: "Tech" },
    { value: "limba.mp3", text: "Limba" },
    { value: "lis.mp3", text: "LIS" },
    { value: "interface.mp3", text: "Interface" },
    { value: "bubble.mp3", text: "Bubbles" },
  ];

  const addOption = (value, text, full) => {
    const li = document.createElement("li");
    li.className = "qsd-option";
    li.setAttribute("role", "option");
    li.dataset.value = value;
    li.dataset.label = full || text;
    if (full && full !== text) li.title = full;

    const span = document.createElement("span");
    span.textContent = text;
    li.appendChild(span);

    // check da opção selecionada (spec: solid #00A1E0 + check)
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

  defaultSounds.forEach((s) => addOption(s.value, s.text));

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

// Guarda da última gravação feita pelo próprio popup, para não
// re-renderizar (e perder foco) quando o onChanged for nosso próprio save
let popupSelfWriteQueues = null;

function saveOptions() {
  const queues = [];
  queueList.querySelectorAll(".queue-item").forEach((item) => {
    const soundSelect = item.querySelector(".queue-sound-select");
    const nameInput = item.querySelector(".queue-name");
    const activeBtn = item.querySelector(".queue-active");
    const intervalInput = item.querySelector(".queue-interval");
    const soundBtn = item.querySelector(".queue-sound");

    if (nameInput && intervalInput && soundBtn) {
      queues.push(Object.assign({}, item._insvQueue || {}, {
        name: nameInput.value,
        active: activeBtn !== null,
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
  popupSelfWriteQueues = JSON.stringify(fullQueues);
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
      queues = [
        {
          name: "",
          active: true,
          interval: 15,
          soundEnabled: false,
          customSound: "notification.mp3",
        },
      ];
      popupSelfWriteQueues = JSON.stringify(queues);
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
    const newQueue = {
      name: "",
      active: true,
      interval: 15,
      soundEnabled: false,
      customSound: "notification.mp3",
    };
    const el = createQueueElement(newQueue);
    queueList.appendChild(el);
    saveOptions();
    applyPaidGate(isPaid);
  });
}

function playQueueTestSound(soundValue) {
  const volume = parseInt(volumeSlider.value, 10) / 100;

  if (soundValue.startsWith("custom_")) {
    chrome.storage.local.get("audiosPersonalizados", (data) => {
      const customAudios = data.audiosPersonalizados || {};
      const customAudio = customAudios[soundValue];

      if (customAudio) {
        const audio = new Audio(customAudio.data);
        audio.volume = volume;
        audio.play().catch(() => {});
      }
    });
  } else {
    const audio = new Audio(`./assets/sounds/${soundValue}`);
    audio.volume = volume;
    audio.play().catch(() => {});
  }
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

queueList.addEventListener("dragover", (e) => {
  e.preventDefault();
  const dragging = document.querySelector(".dragging");
  if (!dragging) return;

  const afterElement = getDragAfterElement(queueList, e.clientY);
  const firstItem = queueList.querySelector(".queue-item");
  if (afterElement === firstItem || dragging === firstItem) return;

  if (afterElement == null) {
    queueList.appendChild(dragging);
  } else {
    queueList.insertBefore(dragging, afterElement);
  }
});

queueList.addEventListener("drop", () => {
  saveOptions();
});

function getDragAfterElement(container, y) {
  const draggableElements = [...container.querySelectorAll(".queue-item:not(.dragging)")];

  return draggableElements.reduce(
    (closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;

      if (offset < 0 && offset > closest.offset) {
        return { offset, element: child };
      } else {
        return closest;
      }
    },
    { offset: Number.NEGATIVE_INFINITY }
  ).element;
}

// Sincronização com o gerenciador de filas do options: mudanças
// externas em queues re-renderizam a lista do popup
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.queues) {
    if (JSON.stringify(changes.queues.newValue || []) === popupSelfWriteQueues) return;
    chrome.storage.sync.get("legacyMode", (result) => {
      if (!result.legacyMode) restoreOptions();
    });
  }
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.audiosPersonalizados) {
    const queueSelectors = queueList.querySelectorAll(".queue-sound-select");
    queueSelectors.forEach((select) => {
      const currentValue = select.value;
      loadSoundOptionsForQueue(select, currentValue);
    });
  }
});

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
// Chave única darkMode (chrome.storage.local), controlada pelo toggle
// do options — vale para popup, options e pricing. Migra a antiga
// popupDarkMode na primeira carga.
chrome.storage.local.get(["darkMode", "popupDarkMode"], (data) => {
  let dark = data.darkMode;
  if (dark === undefined && data.popupDarkMode !== undefined) {
    dark = !!data.popupDarkMode;
    chrome.storage.local.set({ darkMode: dark });
    chrome.storage.local.remove("popupDarkMode");
  }
  document.documentElement.classList.toggle("dark-popup", !!dark);
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.darkMode) {
    document.documentElement.classList.toggle("dark-popup", !!changes.darkMode.newValue);
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
