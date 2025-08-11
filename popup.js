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
<input type="text" placeholder="Nome da fila" value="${queue.name || ""}" class="queue-name">
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
    });
  } else {
    div.setAttribute("draggable", "false");
  }

  div.querySelectorAll("input").forEach((input) => {
    input.addEventListener("input", saveOptions);
    input.addEventListener("change", saveOptions);
  });

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
    saveOptions();
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
    saveOptions();
  });

  const queueSoundSelect = div.querySelector(".queue-sound-select");

  if (queueSoundSelect) {
    queueSoundSelect.addEventListener("change", () => {
      if (queueSoundSelect.value) {
        playQueueTestSound(queueSoundSelect.value);
      }
      saveOptions();
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

  chrome.storage.local.set({ queues, general }, showSaving);
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

    queueList.innerHTML = "";
    queues.forEach((queue) => {
      const el = createQueueElement(queue);
      queueList.appendChild(el);
    });

    const general = data.general || {
      volume: 0.5,
    };

    volumeSlider.value = general.volume * 100;
  });
}

function addQueueHandler() {
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
    saveOptions();
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