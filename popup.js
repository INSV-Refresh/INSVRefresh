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

function toggleMode(isLegacyMode) {
  if (isLegacyMode) {
    normalMode.style.display = "none";
    legacyMode.style.display = "flex";
    if (volumeControl) volumeControl.style.display = "none";
    legacyText.style.display = "block";
  } else {
    normalMode.style.display = "block";
    legacyMode.style.display = "none";
    if (volumeControl) volumeControl.style.display = "flex";
    legacyText.style.display = "none";
  }
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
  const interval = parseInt(legacyInterval.value, 10);
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

  div.innerHTML = `
<div class="drag-handle" title="${t("drag_reorder")}" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="9" cy="6" r="1" fill="currentColor"/><circle cx="15" cy="6" r="1" fill="currentColor"/><circle cx="9" cy="12" r="1" fill="currentColor"/><circle cx="15" cy="12" r="1" fill="currentColor"/><circle cx="9" cy="18" r="1" fill="currentColor"/><circle cx="15" cy="18" r="1" fill="currentColor"/></svg></div>
<div class="adjustments-containers-1-and-2">
<div class="container-1">
<div class="queue-name-wrapper">
<input type="text" placeholder="${t("queue_name_ph")}" value="${queue.name || ""}" class="queue-name">
<button type="button" class="copy-queue-name-btn has-tooltip has-tooltip-default" data-tooltip="${t("copy_queue_name")}" title="${t("copy_queue_name")}" aria-label="${t("copy_queue_name")}"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
</div>
<label class="active-toggle">
<button class="${queue.active ? "queue-active" : "queue-inactive"}">${queue.active ? t("active") : t("inactive")}</button>
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
<select class="queue-sound-select">
</select>
</div>
${isFirst ? "" : `<button class="delete-queue has-tooltip has-tooltip-default" data-tooltip="${t("remove_queue")}" aria-label="${t("remove_queue")}"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path data-dc-tpl="467" d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14" data-om-id="e0b415c9:493"></path></svg></button>`}
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

function loadSoundOptionsForQueue(selectElement, selectedValue) {
  selectElement.innerHTML = "";

  const defaultSounds = [
    { value: "notification.mp3", text: t("sound_default") },
    { value: "tech.mp3", text: "Tech" },
    { value: "limba.mp3", text: "Limba" },
    { value: "lis.mp3", text: "LIS" },
    { value: "interface.mp3", text: "Interface" },
    { value: "bubble.mp3", text: "Bubbles" },
  ];

  defaultSounds.forEach((sound) => {
    const option = document.createElement("option");
    option.value = sound.value;
    option.textContent = sound.text;
    selectElement.appendChild(option);
  });

  chrome.storage.local.get("audiosPersonalizados", (data) => {
    const customAudios = data.audiosPersonalizados || {};
    const customKeys = Object.keys(customAudios);

    if (customKeys.length > 0) {
      const separator = document.createElement("option");
      separator.disabled = true;
      separator.textContent = "───────";
      selectElement.appendChild(separator);

      customKeys.forEach((key) => {
        const audioInfo = customAudios[key];
        const option = document.createElement("option");
        option.value = key;
        option.textContent = audioInfo.name;
        selectElement.appendChild(option);
      });
    }

    selectElement.value = selectedValue;
  });
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
      queues.push({
        name: nameInput.value,
        active: activeBtn !== null,
        interval: parseInt(intervalInput.value, 10),
        soundEnabled: !soundBtn.classList.contains("off"),
        customSound: soundSelect ? soundSelect.value : "",
      });
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
        audio.play().catch((e) => console.error("Erro ao tocar áudio personalizado:", e));
      }
    });
  } else {
    const audio = new Audio(`./assets/sounds/${soundValue}`);
    audio.volume = volume;
    audio.play().catch((e) => console.error("Erro ao tocar áudio padrão:", e));
  }
}

if (addQueueBtn) {
  addQueueBtn.addEventListener("click", addQueueHandler);
}

if (volumeSlider) {
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
