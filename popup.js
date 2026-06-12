const normalMode = document.getElementById("normal-mode");
const legacyMode = document.getElementById("legacy-mode");
const volumeSlider = document.getElementById("volumeSlider");
const legacyText = document.getElementById("legacy-text");
const statusSpan = document.getElementById("status");
const queueList = document.getElementById("queue-list");
const addQueueBtn = document.getElementById("add-queue-btn");

const legacyInterval = document.getElementById("legacyInterval");
const legacyToggle = document.getElementById("legacyToggle");

function toggleMode(isLegacyMode) {
  if (isLegacyMode) {
    normalMode.style.display = "none";
    legacyMode.style.display = "flex";
    volumeSlider.style.display = "none";
    legacyText.style.display = "block";
  } else {
    normalMode.style.display = "block";
    legacyMode.style.display = "none";
    volumeSlider.style.display = "block";
    legacyText.style.display = "none";
  }
}

function showSaving() {
  statusSpan.textContent = "Salvando configurações...";
  setTimeout(() => (statusSpan.textContent = ""), 1800);
}

function updateLegacyToggle(active) {
  if (active) {
    legacyToggle.className = "queue-active";
    legacyToggle.textContent = "Ativo";
  } else {
    legacyToggle.className = "queue-inactive";
    legacyToggle.textContent = "Inativo";
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


function createQueueElement(queue) {
  const isFirst = queueList.children.length === 0;
  const div = document.createElement("div");
  div.className = "queue-item";

  div.innerHTML = `
<div class="drag-handle" title="Arrastar para reordenar">☰</div>
<div class="adjustments-containers-1-and-2">
<div class="container-1">
<div class="queue-name-wrapper">
<input type="text" placeholder="Nome da fila" value="${queue.name || ""}" class="queue-name">
<button type="button" class="copy-queue-name-btn has-tooltip has-tooltip-default" data-tooltip="Copiar nome da fila" title="Copiar nome da fila">📋</button>
</div>
<label class="active-toggle">
<button class="${queue.active ? "queue-active" : "queue-inactive"}">${queue.active ? "Ativo" : "Inativo"}</button>
</label>
</div>
<div class="container-2">
<div class="input-wrapper">
<input type="number" class="queue-interval" value="${queue.interval || 15}" min="5" max="900">
<span class="seconds">s</span>
</div>
<label>
<button class="queue-sound has-tooltip has-tooltip-default ${queue.soundEnabled ? "" : "off"}" data-tooltip="Notificar novos chamados">
<img src="./assets/icons/notification.png" alt="Icone de notificação">
</button>
</label>
<div class="sound-container" style="display: ${queue.soundEnabled ? "block" : "none"};">
<select class="queue-sound-select">
</select>
</div>
${isFirst ? "" : `<button class="delete-queue has-tooltip has-tooltip-default" data-tooltip="Remover fila"><img src="./assets/icons/trash-bin.png" alt="Remover"></button>`}
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

  const copyBtn = div.querySelector(".copy-queue-name-btn");
  if (copyBtn) {
    copyBtn.addEventListener("click", () => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs[0] || !tabs[0].url || !tabs[0].url.includes("lightning.force.com")) {
          if (typeof statusSpan !== "undefined") statusSpan.textContent = "Abra uma página do Salesforce";
          setTimeout(() => { if (statusSpan) statusSpan.textContent = ""; }, 2000);
          return;
        }
        chrome.tabs.sendMessage(tabs[0].id, { type: "GET_QUEUE_NAME" }, (response) => {
          if (chrome.runtime.lastError) {
            if (typeof statusSpan !== "undefined") statusSpan.textContent = "Recarregue a página do Salesforce";
            setTimeout(() => { if (statusSpan) statusSpan.textContent = ""; }, 2000);
            return;
          }
          const queueName = (response && response.queueName || "").trim();
          if (!queueName) {
            if (typeof statusSpan !== "undefined") statusSpan.textContent = "Não foi possível detectar a fila";
            setTimeout(() => { if (statusSpan) statusSpan.textContent = ""; }, 2000);
            return;
          }
          navigator.clipboard.writeText(queueName).then(() => {
            const nameInput = div.querySelector(".queue-name");
            if (nameInput) nameInput.value = queueName;
            if (typeof statusSpan !== "undefined") statusSpan.textContent = `"${queueName}" copiado!`;
            setTimeout(() => { if (statusSpan) statusSpan.textContent = ""; }, 2000);
            saveOptions();
          }).catch(() => {
            if (typeof statusSpan !== "undefined") statusSpan.textContent = "Não foi possível copiar";
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
    activeBtn.textContent = isActive ? "Inativo" : "Ativo";
    saveOptionsDebounced();
  });

  const soundBtn = div.querySelector(".queue-sound");
  soundBtn.addEventListener("click", () => {
    soundBtn.classList.toggle("off");
    const soundContainer = div.querySelector(".sound-container");
    if (!soundBtn.classList.contains("off")) {
      soundContainer.style.display = "block";
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

    loadSoundOptionsForQueue(queueSoundSelect, queue.customSound || "");
  }

  return div;
}

function loadSoundOptionsForQueue(selectElement, selectedValue) {
  selectElement.innerHTML = "";

  const defaultSounds = [
    { value: "notification.mp3", text: "Padrão" },
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

// Filas excedentes ocultadas no plano free. Não são apagadas do
// storage — apenas deixam de ser renderizadas, e voltam quando o
// usuário voltar a ser pago.
let hiddenPaidQueues = [];

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

  chrome.storage.local.set({ queues: queues.concat(hiddenPaidQueues), general }, showSaving);
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
    addQueueBtn.title = "Múltiplas filas disponível no plano pago";
    addQueueBtn.setAttribute("data-tooltip", "⭐ Premium — ver planos");

    // Link sutil embaixo
    const link = document.createElement("a");
    link.id = "upgrade-multi-queue";
    link.href = chrome.runtime.getURL("pricing.html");
    link.target = "_blank";
    link.textContent = "⭐ Assine para múltiplas filas";
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
        🔒 Disponível no plano pago.
        <a href="${chrome.runtime.getURL('pricing.html')}" target="_blank">Ver planos →</a>
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
    addQueueBtn.setAttribute("data-tooltip", "Adicionar fila");

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
  note.innerHTML = `🔒 ${hiddenPaidQueues.length === 1 ? "1 fila adicional disponível" : `${hiddenPaidQueues.length} filas adicionais disponíveis`} no plano pago`;
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
          customSound: "",
        },
      ];
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
      customSound: "",
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
chrome.storage.local.get("popupDarkMode", (data) => {
  if (data.popupDarkMode) {
    document.documentElement.classList.add("dark-popup");
  }
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.popupDarkMode !== undefined) {
    if (changes.popupDarkMode.newValue) {
      document.documentElement.classList.add("dark-popup");
    } else {
      document.documentElement.classList.remove("dark-popup");
    }
  }
});

const BtnlightDarkMode = document.querySelector(".light-dark-mode");

if (BtnlightDarkMode) {
  BtnlightDarkMode.addEventListener("click", () => {
    const isDark = document.documentElement.classList.contains("dark-popup");

    document.documentElement.classList.toggle("dark-popup");

    chrome.storage.local.set({
      popupDarkMode: !isDark
    });
  });
}
