// debounce() lives in scripts/util.js (loaded before this file).

function exportSettings() {
  try {
    chrome.storage.local.get(null, (allData) => {
      const exportData = {
        version: chrome.runtime.getManifest().version,
        exportDate: new Date().toISOString(),
        // statusNotifications legado agora vive dentro de queues[].statusNotify
        queues: allData.queues || [],
        general: allData.general || {},
        advanced: allData.advanced || {},
        audiosPersonalizados: allData.audiosPersonalizados || {},
        darkMode: !!allData.darkMode,
      };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `insv-refresh-backup-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast(t("exported"), "success");
    });
  } catch (e) {
    showToast(t("export_error") + e.message, "error");
  }
}

// Imported backups are user-supplied/social-engineered files. Coerce every
// field to its expected type/shape before persisting, so a crafted JSON can't
// inject unexpected data (defense-in-depth with the output-side escapeHtml).
function clampStr(v, max = 300) {
  return typeof v === "string" ? v.slice(0, max) : "";
}
function sanitizeImportedQueue(q) {
  if (!q || typeof q !== "object") return null;
  const out = {
    name: clampStr(q.name, 200),
    active: !!q.active,
    interval: Math.min(900, Math.max(5, parseInt(q.interval, 10) || 15)),
    soundEnabled: !!q.soundEnabled,
    customSound: clampStr(q.customSound, 120),
  };
  if (q.statusNotify && typeof q.statusNotify === "object") {
    const sn = q.statusNotify;
    out.statusNotify = {
      enabled: !!sn.enabled,
      statuses: Array.isArray(sn.statuses)
        ? sn.statuses.filter((s) => typeof s === "string").map((s) => s.slice(0, 120)).slice(0, 100)
        : [],
      sound: clampStr(sn.sound, 120) || "notification.mp3",
    };
  }
  return out;
}
function sanitizeImportedAudios(obj) {
  if (!obj || typeof obj !== "object") return {};
  const out = {};
  Object.keys(obj).slice(0, 50).forEach((k) => {
    const a = obj[k];
    if (!a || typeof a !== "object") return;
    // Must be an audio data URL; rejects arbitrary data:/javascript: payloads.
    if (typeof a.data !== "string" || !/^data:audio\//i.test(a.data)) return;
    out[clampStr(k, 80)] = {
      name: clampStr(a.name, 120),
      originalName: clampStr(a.originalName, 200),
      data: a.data,
    };
  });
  return out;
}

function importSettings(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const importData = JSON.parse(e.target.result);
      if (!importData.queues && !importData.statusNotifications) {
        throw new Error(t("invalid_file"));
      }
      // Backups antigos: mescla statusNotifications[] dentro de queues[]
      let queues = Array.isArray(importData.queues) ? importData.queues : [];
      if (importData.statusNotifications && importData.statusNotifications.length) {
        queues = mergeLegacyStatusNotifications(queues, importData.statusNotifications);
      }
      queues = queues.map(sanitizeImportedQueue).filter(Boolean);
      const vol = Number(importData.general && importData.general.volume);
      const toImport = {
        queues,
        general: { volume: isFinite(vol) ? Math.min(1, Math.max(0, vol)) : 0.5 },
        advanced: importData.advanced && typeof importData.advanced === "object" ? importData.advanced : {},
        audiosPersonalizados: sanitizeImportedAudios(importData.audiosPersonalizados),
      };
      if (importData.darkMode !== undefined) toImport.darkMode = !!importData.darkMode;
      chrome.storage.local.set(toImport, () => {
        showToast(t("imported"), "success");
        setTimeout(() => window.location.reload(), 1500);
      });
    } catch (err) {
      showToast(t("import_error") + err.message, "error");
    }
  };
  reader.readAsText(file);
  event.target.value = "";
}

function applyDarkMode(enabled) {
  document.documentElement.setAttribute("data-theme", enabled ? "dark" : "light");
  if (enabled) {
    document.body.classList.add("dark-mode");
  } else {
    document.body.classList.remove("dark-mode");
  }
}

function validateAudioFile(input) {
  const file = input.files[0];
  if (!file) {
    document.getElementById('save-audio-btn').disabled = true;
    document.getElementById('audio-preview').innerHTML = '';
    return;
  }

  const validTypes = ["audio/mpeg", "audio/wav", "audio/ogg", "audio/mp4", "audio/webm"];
  const maxSizeMB = 5;

  if (!validTypes.includes(file.type)) {
    showToast(t("invalid_format"), "error");
    input.value = "";
    document.getElementById('save-audio-btn').disabled = true;
    document.getElementById('audio-preview').innerHTML = '';
    resetDropArea();
    return;
  }

  if (file.size > maxSizeMB * 1024 * 1024) {
    showToast(t("file_too_big"), "error");
    input.value = "";
    document.getElementById('save-audio-btn').disabled = true;
    document.getElementById('audio-preview').innerHTML = '';
    resetDropArea();
    return;
  }

  showAudioPreview(file);
  
  const nameInput = document.getElementById('custom-audio-name');
  if (!nameInput.value) {
    const fileName = file.name.replace(/\.[^/.]+$/, "");
    nameInput.value = fileName;
  }
  
  document.getElementById('save-audio-btn').disabled = false;
  showDropSuccess();
}

function showAudioPreview(file) {
  const previewContainer = document.getElementById('audio-preview');
  const existingAudio = previewContainer.querySelector('audio');
  
  if (existingAudio) {
    existingAudio.remove();
  }

  const audio = document.createElement('audio');
  audio.controls = true;
  
  const url = URL.createObjectURL(file);
  audio.src = url;
  
  previewContainer.appendChild(audio);
}

function saveCustomAudio() {
  const fileInput = document.getElementById('custom-audio');
  const nameInput = document.getElementById('custom-audio-name');
  const file = fileInput.files[0];
  const customName = nameInput.value.trim();
  
  if (!file) {
    showToast(t("select_audio_first"), "warning");
    return;
  }

  if (!customName) {
    showToast(t("enter_audio_name"), "warning");
    nameInput.focus();
    return;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    const audioData = e.target.result;
    const fileName = file.name;
    
    chrome.storage.local.get('audiosPersonalizados', (data) => {
      const customAudios = data.audiosPersonalizados || {};
      const audioKey = 'custom_' + Date.now();
      
      customAudios[audioKey] = {
        data: audioData,
        name: customName,
        originalName: fileName,
        createdAt: new Date().toISOString()
      };
      
      chrome.storage.local.set({ audiosPersonalizados: customAudios }, () => {
        showToast(t("audio_saved"), "success");
        loadCustomAudios();
        clearAudioForm();
      });
    });
  };
  
  reader.readAsDataURL(file);
}

function clearAudioForm() {
  const fileInput = document.getElementById('custom-audio');
  const nameInput = document.getElementById('custom-audio-name');
  
  fileInput.value = '';
  nameInput.value = '';
  document.getElementById('save-audio-btn').disabled = true;
  document.getElementById('audio-preview').innerHTML = '';
  resetDropArea();
}

function loadCustomAudios() {
  chrome.storage.local.get('audiosPersonalizados', (data) => {
    const customAudios = data.audiosPersonalizados || {};
    const container = document.getElementById('custom-audios-list');
    if (!container) return;

    container.innerHTML = '';
    
    const audioKeys = Object.keys(customAudios);
    if (audioKeys.length === 0) {
      container.innerHTML = `<p>${t("no_custom_audio")}</p>`;
      return;
    }

    const dateLocale = { pt_BR: "pt-BR", en: "en-US", es: "es-ES" }[I18N.lang] || "pt-BR";

    audioKeys.forEach(key => {
      const audioInfo = customAudios[key];
      const audioItem = document.createElement('div');
      const sizeKB = audioInfo.data ? Math.round(audioInfo.data.length * 0.75 / 1024) : 0;

      const safeName = escapeHtml(audioInfo.name);
      const safeOriginal = escapeHtml(audioInfo.originalName);
      const safeKey = escapeHtml(key);
      audioItem.innerHTML = `
        <button class="audio-play-btn" aria-label="${t('play') || 'Reproduzir'} ${safeName}">
          <svg class="icon-play" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M5 3l14 9-14 9V3z"/></svg>
          <svg class="icon-pause" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
        </button>
        <div class="audio-info">
          <strong>${safeName}</strong>
          <div class="audio-meta">${safeOriginal}${sizeKB ? ' · ' + sizeKB + ' KB' : ''}</div>
        </div>
        <button class="delete-audio-btn" data-audio-key="${safeKey}" aria-label="${t('delete')} ${safeName}">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14"></path></svg>
        </button>
      `;

      container.appendChild(audioItem);

      const playBtn = audioItem.querySelector('.audio-play-btn');
      let audioObj = null;
      playBtn.addEventListener('click', function() {
        if (!audioObj) {
          audioObj = new Audio(audioInfo.data);
          audioObj.addEventListener('ended', () => {
            playBtn.classList.remove('playing');
          });
        }
        if (audioObj.paused) {
          audioObj.play();
          playBtn.classList.add('playing');
        } else {
          audioObj.pause();
          audioObj.currentTime = 0;
          playBtn.classList.remove('playing');
        }
      });

      const deleteBtn = audioItem.querySelector('.delete-audio-btn');
      deleteBtn.addEventListener('click', function() {
        if (audioObj) { audioObj.pause(); audioObj = null; }
        deleteCustomAudio(this.dataset.audioKey);
      });
    });
  });
}

function deleteCustomAudio(audioKey) {
  chrome.storage.local.get('audiosPersonalizados', (data) => {
    const customAudios = data.audiosPersonalizados || {};
    delete customAudios[audioKey];
    
    chrome.storage.local.set({ audiosPersonalizados: customAudios }, () => {
      showToast(t("audio_deleted"), "success");
      loadCustomAudios();
    });
  });
}

function showToast(message, type = "success", duration = 5000) {
  const container = document.getElementById("toast-container");
  
  if (!container) return;

  const toast = document.createElement("div");
  toast.classList.add("toast", `toast-${type}`);
  toast.textContent = message;

  container.appendChild(toast);
  
  setTimeout(() => {
    if (toast.parentNode) {
      toast.remove();
    }
  }, duration);
}

function setupDragAndDrop() {
  const dropArea = document.getElementById('drop-area');
  const fileInput = document.getElementById('custom-audio');
  const browseBtn = document.getElementById('browse-btn');

  if (!dropArea || !fileInput || !browseBtn) return;

  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropArea.addEventListener(eventName, preventDefaults, false);
    document.body.addEventListener(eventName, preventDefaults, false);
  });

  ['dragenter', 'dragover'].forEach(eventName => {
    dropArea.addEventListener(eventName, highlight, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropArea.addEventListener(eventName, unhighlight, false);
  });

  dropArea.addEventListener('drop', handleDrop, false);
  
  dropArea.addEventListener('click', (e) => {
    if (e.target !== browseBtn) {
      fileInput.click();
    }
  });
  
  browseBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    fileInput.click();
  });

  fileInput.addEventListener('change', function() {
    validateAudioFile(this);
  });
}

function preventDefaults(e) {
  e.preventDefault();
  e.stopPropagation();
}

function highlight() {
  const dropArea = document.getElementById('drop-area');
  dropArea.classList.add('dragover');
}

function unhighlight() {
  const dropArea = document.getElementById('drop-area');
  dropArea.classList.remove('dragover', 'error');
}

function handleDrop(e) {
  const dt = e.dataTransfer;
  const files = dt.files;
  
  if (files.length > 1) {
    showDropError(t("one_file_only"));
    return;
  }
  
  if (files.length === 1) {
    handleFiles(files[0]);
  }
}

function handleFiles(file) {
  const validTypes = ["audio/mpeg", "audio/wav", "audio/ogg", "audio/mp4", "audio/webm"];
  
  if (!validTypes.includes(file.type)) {
    showDropError(t("unsupported_type"));
    return;
  }

  const fileInput = document.getElementById('custom-audio');
  const dt = new DataTransfer();
  dt.items.add(file);
  fileInput.files = dt.files;
  
  validateAudioFile(fileInput);
}

function showDropError(message) {
  const dropArea = document.getElementById('drop-area');
  dropArea.classList.add('error');
  showToast(message, 'error');
  
  setTimeout(() => {
    dropArea.classList.remove('error');
  }, 2000);
}

function showDropSuccess() {
  const dropArea = document.getElementById('drop-area');
  const dropContent = dropArea.querySelector('.drop-content');
  
  const originalContent = dropContent.innerHTML;
  dropContent.innerHTML = `
    <div class="drop-icon" style="color: var(--success-500)"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg></div>
    <div class="drop-text">
      <strong>${t("file_loaded")}</strong>
      <p>${t("fill_and_save")}</p>
    </div>
  `;
  
  setTimeout(() => {
    dropContent.innerHTML = originalContent;
  }, 3000);
}

function resetDropArea() {
  const dropArea = document.getElementById('drop-area');
  const dropContent = dropArea.querySelector('.drop-content');
  
  dropArea.classList.remove('dragover', 'error');
  dropContent.innerHTML = `
    <div class="drop-icon"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg></div>
    <div class="drop-text">
      <strong>${t("drop_strong")}</strong>
      <p>${t("drop_or")} <button type="button" id="browse-btn" class="browse-btn">${t("drop_browse")}</button></p>
    </div>
    <div class="drop-formats">
      ${t("drop_formats")}
    </div>
  `;
  
  const newBrowseBtn = dropContent.querySelector('#browse-btn');
  if (newBrowseBtn) {
    newBrowseBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      document.getElementById('custom-audio').click();
    });
  }
}

function loadStatusNotificationSounds(selectEl, selectedValue, onPreview) {
  if (!selectEl) return;
  selectEl.innerHTML = "";
  const defaultSounds = [
    { value: "notification.mp3", text: t("sound_default") },
    { value: "tech.mp3", text: "Tech" },
    { value: "limba.mp3", text: "Limba" },
    { value: "lis.mp3", text: "LIS" },
    { value: "interface.mp3", text: "Interface" },
    { value: "bubble.mp3", text: "Bubbles" },
  ];
  defaultSounds.forEach((s) => {
    const opt = document.createElement("option");
    opt.value = s.value;
    opt.textContent = s.text;
    selectEl.appendChild(opt);
  });
  chrome.storage.local.get("audiosPersonalizados", (data) => {
    const custom = data.audiosPersonalizados || {};
    const keys = Object.keys(custom);
    if (keys.length > 0) {
      const sep = document.createElement("option");
      sep.disabled = true;
      sep.textContent = "───────";
      selectEl.appendChild(sep);
      keys.forEach((key) => {
        const o = document.createElement("option");
        o.value = key;
        o.textContent = custom[key].name;
        selectEl.appendChild(o);
      });
    }
    if (selectedValue) selectEl.value = selectedValue;
    if (onPreview) {
      selectEl.addEventListener("change", () => {
        if (selectEl.value) previewSound(selectEl.value);
      });
    }
  });
}

function previewSound(soundValue) {
  try {
    chrome.storage.local.get("general", (data) => {
      const volume = (data.general && data.general.volume) || 0.5;
      if (soundValue.startsWith("custom_")) {
        chrome.storage.local.get("audiosPersonalizados", (d) => {
          const custom = d.audiosPersonalizados || {};
          const audio = custom[soundValue];
          if (audio && audio.data) {
            const a = new Audio(audio.data);
            a.volume = volume;
            a.play().catch(() => {});
          }
        });
      } else {
        const a = new Audio(chrome.runtime.getURL("assets/sounds/" + soundValue));
        a.volume = volume;
        a.play().catch(() => {});
      }
    });
  } catch (e) {
    console.error("Preview error:", e);
  }
}

// ── Gerenciador de filas + notificação de status ─────────────
// Lê e grava as MESMAS queues exibidas no popup
// (chrome.storage.local.queues). Adicionar/remover/renomear aqui
// reflete no popup e vice-versa, via chrome.storage.onChanged.
// A config de notificação de status vive em cada fila:
// queues[i].statusNotify = { enabled, statuses[], sound }.

let qmQueues = [];
let qmSelfWrite = null;
// escapeHtml lives in scripts/util.js (loaded before this file).

// Mescla o storage legado statusNotifications[] dentro de queues[].
// Configs sem fila correspondente viram filas inativas para não perder dados.
function mergeLegacyStatusNotifications(queues, legacy) {
  (legacy || []).forEach((sn) => {
    const name = (sn.queueName || "").trim();
    if (!name) return;
    let q = queues.find((x) => (x.name || "").toLowerCase().trim() === name.toLowerCase());
    if (!q) {
      q = { name, active: false, interval: 15, soundEnabled: false, customSound: "notification.mp3" };
      queues.push(q);
    }
    q.statusNotify = {
      enabled: !!sn.enabled,
      statuses: sn.statuses || [],
      sound: sn.sound || "notification.mp3",
    };
  });
  return queues;
}

function createQueueManagerRow(queue) {
  const sn = queue.statusNotify || { enabled: false, statuses: [], sound: "notification.mp3" };
  const statusText = (sn.statuses || []).join(";");
  const div = document.createElement("div");
  div.className = "queue-manager-row";
  div.innerHTML = `
    <span class="status-rule-queue-label">
      <svg class="qm-label-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
      <input type="text" class="qm-queue-name" value="${escapeHtml(queue.name || t("queue_name_ph"))}" title="${escapeHtml(queue.name || t("queue_name_ph"))}" aria-label="${t("queue_name_ph")}" readonly tabindex="0">
    </span>
    <input type="text" class="qm-statuses" value="${escapeHtml(statusText)}" placeholder="${t("qm_statuses_ph")}" title="${t("qm_statuses_title")}" aria-label="${t("qm_statuses_ph")}">
    <div class="qm-sound-wrapper">
      <svg class="qm-bell-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
      <select class="qm-sound" title="${t("qm_sound_title")}" aria-label="${t("qm_sound_title")}"></select>
    </div>
  `;

  loadStatusNotificationSounds(div.querySelector(".qm-sound"), sn.sound || "notification.mp3", true);

  div.querySelectorAll("input, select").forEach((inp) => {
    inp.addEventListener("change", saveQueueManagerDebounced);
    inp.addEventListener("input", saveQueueManagerDebounced);
  });

  return div;
}

function renderQueueManager() {
  const container = document.getElementById("status-notifications-list");
  if (!container) return;
  container.innerHTML = "";
  qmQueues.forEach((q) => {
    container.appendChild(createQueueManagerRow(q));
  });
}

function collectQueueManagerRows() {
  const container = document.getElementById("status-notifications-list");
  if (!container) return qmQueues;
  const rows = container.querySelectorAll(".queue-manager-row");
  const result = [];
  rows.forEach((row, i) => {
    const base = qmQueues[i] || { active: true, interval: 15, soundEnabled: false, customSound: "notification.mp3" };
    const statuses = row.querySelector(".qm-statuses").value.split(";").map((s) => s.trim()).filter(Boolean);
    result.push(Object.assign({}, base, {
      statusNotify: {
        enabled: statuses.length > 0,
        statuses,
        sound: row.querySelector(".qm-sound").value || "notification.mp3",
      },
    }));
  });
  return result;
}

function persistQueueManager() {
  qmSelfWrite = JSON.stringify(qmQueues);
  chrome.storage.local.set({ queues: qmQueues }, () => {
    showToast(t("queues_saved"), "success");
  });
}

function saveQueueManager() {
  qmQueues = collectQueueManagerRows();
  persistQueueManager();
}

const saveQueueManagerDebounced = debounce(saveQueueManager, 600);

function loadQueueManager() {
  const container = document.getElementById("status-notifications-list");
  if (!container) return;
  chrome.storage.local.get(["queues", "statusNotifications"], (data) => {
    let queues = data.queues || [];
    if (data.statusNotifications && data.statusNotifications.length) {
      queues = mergeLegacyStatusNotifications(queues, data.statusNotifications);
      qmQueues = queues;
      qmSelfWrite = JSON.stringify(queues);
      chrome.storage.local.set({ queues });
      chrome.storage.local.remove("statusNotifications");
    } else {
      qmQueues = queues;
    }
    renderQueueManager();
  });
}

// Sincronização: mudanças vindas do popup re-renderizam a lista
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.queues) {
    const incoming = JSON.stringify(changes.queues.newValue || []);
    if (incoming === qmSelfWrite) return; // gravação desta própria página
    qmQueues = changes.queues.newValue || [];
    renderQueueManager();
  }
});

function applyPaidGateOptions(isPaid) {
  try {
    // Marcar h2 de seções premium com badge visual
    const premiumSections = [
      document.getElementById("upload-audio"),
      document.getElementById("status-notification"),
    ];

    premiumSections.forEach((section) => {
      if (!section) return;
      const h2 = section.querySelector("h2");

      // Adicionar badge premium no título se ainda não existir
      if (h2 && !h2.querySelector(".premium-badge")) {
        const badge = document.createElement("span");
        badge.className = "premium-badge";
        badge.textContent = t("premium_badge");
        h2.appendChild(badge);
      }

      if (!isPaid) {
        section.classList.add("section-locked");

        // Banner "Disponível no plano pago" — apenas 1, sem double wrapper
        if (!section.querySelector(".paid-gate-banner")) {
          const banner = document.createElement("div");
          banner.className = "paid-gate-banner";
          banner.innerHTML = `
            ${t("locked_paid")}
            <a href="${chrome.runtime.getURL('pricing.html')}">${t("see_plans")}</a>
          `;
          section.insertBefore(banner, section.firstChild);
        }

        // Desabilitar todos inputs/buttons/selects dentro da seção
        section.querySelectorAll("input, button, select, textarea").forEach((el) => {
          el.disabled = true;
          el.setAttribute("data-locked", "true");
        });

        // Bloquear drop area visualmente
        const dropArea = section.querySelector("#drop-area");
        if (dropArea) {
          dropArea.style.pointerEvents = "none";
        }

      } else {
        section.classList.remove("section-locked");

        // Remover banner se existir
        const banner = section.querySelector(".paid-gate-banner");
        if (banner) banner.remove();

        // Reabilitar elementos
        section.querySelectorAll("[data-locked='true']").forEach((el) => {
          el.disabled = false;
          el.removeAttribute("data-locked");
        });

        const dropArea = section.querySelector("#drop-area");
        if (dropArea) {
          dropArea.style.pointerEvents = "";
        }
      }
    });

  } catch (e) {
    console.error("Error applying paid gate:", e);
  }
}

// i18nReady resolve após DOMContentLoaded com o idioma carregado e o
// DOM estático traduzido — só então renderizamos o conteúdo dinâmico
i18nReady.then(function() {
  setupDragAndDrop();
  
  const saveBtn = document.getElementById('save-audio-btn');
  if (saveBtn) {
    saveBtn.addEventListener('click', saveCustomAudio);
  }
  
  loadCustomAudios();

  const legacyCheckbox = document.getElementById('legacyMode');
  if (legacyCheckbox) {
    chrome.storage.sync.get(['legacyMode'], (result) => {
      legacyCheckbox.checked = result.legacyMode || false;
    });

    legacyCheckbox.addEventListener('change', () => {
      chrome.storage.sync.set({ legacyMode: legacyCheckbox.checked });
      showToast(legacyCheckbox.checked ? t("legacy_on") : t("legacy_off"), "success");
    });
  }

  loadQueueManager();

  document.getElementById("export-settings-btn")?.addEventListener("click", exportSettings);
  document.getElementById("import-settings-input")?.addEventListener("change", importSettings);

  const darkModeToggle = document.getElementById("darkModeToggle");
  if (darkModeToggle) {
    chrome.storage.local.get("darkMode", (data) => {
      darkModeToggle.checked = !!data.darkMode;
      applyDarkMode(data.darkMode);
    });
    darkModeToggle.addEventListener("change", () => {
      chrome.storage.local.set({ darkMode: darkModeToggle.checked });
      applyDarkMode(darkModeToggle.checked);
    });
  }

  chrome.runtime.sendMessage({ type: "GET_ACCESS_LEVEL" }, (access) => {
    if (chrome.runtime.lastError) return;
    applyPaidGateOptions(!!(access && access.isPaid));

    // Aviso de dias restantes do teste grátis
    if (access && access.level === "trial") {
      const trialBanner = document.getElementById("trial-banner");
      if (trialBanner) {
        const dias = access.trialDaysLeft;
        trialBanner.innerHTML = `
          ⏳ <strong>${t("trial_active")}</strong> — ${dias === 1 ? t("trial_days_left_one") : t("trial_days_left", { n: dias })}.
          <a href="${chrome.runtime.getURL("pricing.html")}">${t("subscribe_now")}</a>
        `;
        trialBanner.style.display = "flex";
      }
    }
  });

  chrome.storage.local.get("pendingChangelogVersion", (data) => {
    const v = data.pendingChangelogVersion;
    if (!v) return;
    const banner = document.getElementById("changelog-banner");
    if (!banner) return;
    banner.style.display = "block";
    const items = ["cl_1", "cl_2", "cl_3", "cl_4", "cl_5", "cl_6", "cl_7", "cl_8"]
      .map((k) => `<li>${t(k)}</li>`)
      .join("");
    banner.innerHTML = `
      <strong>${t("changelog_title", { v })}</strong>
      <ul>${items}</ul>
      <button type="button" id="changelog-dismiss">${t("changelog_dismiss")}</button>
    `;
    banner.querySelector("#changelog-dismiss").addEventListener("click", () => {
      chrome.storage.local.remove("pendingChangelogVersion");
      banner.style.display = "none";
    });
  });

  setupShortcutCapture({
    captureBtnId: "accept-shortcut-capture",
    clearBtnId: "accept-shortcut-clear",
    storageProp: "acceptShortcut",
    legacyProp: "acceptShortcutKey",
  });

  setupShortcutCapture({
    captureBtnId: "pause-shortcut-capture",
    clearBtnId: "pause-shortcut-clear",
    storageProp: "pauseAllShortcut",
  });

  // Seletor de idioma (Aparência)
  const langSelect = document.getElementById("langSelect");
  if (langSelect) {
    langSelect.value = I18N.lang;
    langSelect.addEventListener("change", () => {
      chrome.storage.local.set({ lang: langSelect.value });
    });
  }
});

// Troca de idioma: recarrega a página para retraduzir todo o conteúdo
// dinâmico (listas, capturadores, banners) de uma vez
document.addEventListener("insv-lang-changed", () => {
  window.location.reload();
});

// ── Capturador de atalho de teclado ─────────────────────────
// Grava combinações como {ctrl, alt, shift, meta, code} em
// chrome.storage.local.advanced[storageProp]. Exige >= 1 modificador
// + 1 tecla. Esc cancela a captura.

function shortcutCodeLabel(code) {
  if (!code) return "";
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  if (code.startsWith("Numpad")) return "Num " + code.slice(6);
  const map = {
    Space: "Espaço", Enter: "Enter", Tab: "Tab", Backspace: "Backspace",
    ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→",
    Minus: "-", Equal: "=", Comma: ",", Period: ".", Slash: "/",
    Backslash: "\\", BracketLeft: "[", BracketRight: "]",
    Semicolon: ";", Quote: "'", Backquote: "`",
  };
  return map[code] || code;
}

function shortcutChipsHTML(sc) {
  const parts = [];
  if (sc.ctrl) parts.push("Ctrl");
  if (sc.alt) parts.push("Alt");
  if (sc.shift) parts.push("Shift");
  if (sc.meta) parts.push("Meta");
  if (sc.code) parts.push(shortcutCodeLabel(sc.code));
  return parts.map((p) => `<kbd>${p}</kbd>`).join('<span class="kbd-plus">+</span>');
}

function legacyKeyToShortcut(key) {
  if (!key) return null;
  const k = key.trim();
  if (!k) return null;
  let code = k;
  if (/^[a-z]$/i.test(k)) code = "Key" + k.toUpperCase();
  else if (/^[0-9]$/.test(k)) code = "Digit" + k;
  return { ctrl: false, alt: false, shift: false, meta: false, code, legacy: true };
}

function setupShortcutCapture({ captureBtnId, clearBtnId, storageProp, legacyProp }) {
  const captureBtn = document.getElementById(captureBtnId);
  const clearBtn = document.getElementById(clearBtnId);
  if (!captureBtn) return;

  let capturing = false;
  let savedShortcut = null;

  function render() {
    if (savedShortcut && savedShortcut.code) {
      captureBtn.innerHTML = shortcutChipsHTML(savedShortcut);
      captureBtn.classList.add("has-shortcut");
    } else {
      captureBtn.innerHTML = `<span class="shortcut-placeholder">${t("shortcut_click")}</span>`;
      captureBtn.classList.remove("has-shortcut");
    }
  }

  function stopCapture() {
    capturing = false;
    captureBtn.classList.remove("capturing", "capture-error");
    render();
  }

  function startCapture() {
    capturing = true;
    captureBtn.classList.add("capturing");
    captureBtn.classList.remove("capture-error");
    captureBtn.innerHTML = `<span class="shortcut-placeholder">${t("shortcut_press")}</span>`;
  }

  function showCaptureError(msg) {
    captureBtn.classList.add("capture-error");
    captureBtn.innerHTML = `<span class="shortcut-placeholder">${msg}</span>`;
    setTimeout(() => {
      if (capturing) startCapture();
    }, 1200);
  }

  function persist(sc) {
    chrome.storage.local.get("advanced", (data) => {
      const adv = data.advanced || {};
      adv[storageProp] = sc;
      if (legacyProp) delete adv[legacyProp];
      chrome.storage.local.set({ advanced: adv }, () => {
        savedShortcut = sc;
        stopCapture();
        showToast(sc ? t("shortcut_saved") : t("shortcut_removed"), "success");
      });
    });
  }

  chrome.storage.local.get("advanced", (data) => {
    const adv = data.advanced || {};
    savedShortcut = adv[storageProp] || (legacyProp ? legacyKeyToShortcut(adv[legacyProp]) : null);
    render();
  });

  captureBtn.addEventListener("click", () => {
    if (!capturing) startCapture();
  });

  captureBtn.addEventListener("keydown", (e) => {
    if (!capturing) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        startCapture();
      }
      return;
    }
    e.preventDefault();
    e.stopPropagation();

    if (e.key === "Escape") {
      stopCapture();
      return;
    }

    const isModifierKey = ["Control", "Alt", "Shift", "Meta"].includes(e.key);
    if (isModifierKey) {
      // Mostra os modificadores pressionados em tempo real
      const partial = { ctrl: e.ctrlKey, alt: e.altKey, shift: e.shiftKey, meta: e.metaKey, code: "" };
      const chips = shortcutChipsHTML(partial);
      captureBtn.innerHTML = chips
        ? chips + '<span class="kbd-plus">+</span><span class="shortcut-placeholder">…</span>'
        : `<span class="shortcut-placeholder">${t("shortcut_press")}</span>`;
      return;
    }

    const sc = { ctrl: e.ctrlKey, alt: e.altKey, shift: e.shiftKey, meta: e.metaKey, code: e.code };
    const modCount = (sc.ctrl ? 1 : 0) + (sc.alt ? 1 : 0) + (sc.shift ? 1 : 0) + (sc.meta ? 1 : 0);
    if (modCount < 1) {
      showCaptureError(t("shortcut_min2"));
      return;
    }
    persist(sc);
  });

  captureBtn.addEventListener("blur", () => {
    if (capturing) stopCapture();
  });

  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      persist(null);
    });
  }
}


document.getElementById("nav-pricing") && document.getElementById("nav-pricing").addEventListener("click", (e) => {
  e.preventDefault();
  window.location.href = chrome.runtime.getURL("pricing.html");
});

document.querySelectorAll(".menu a").forEach(link => {
    link.addEventListener("click", function (e) {
        e.preventDefault();
        const targetId = this.getAttribute("href").substring(1);
        var section = document.getElementById(targetId);

        // Remove highlight de todos os h1/h2 e dos links da nav
        document.querySelectorAll(".highlight").forEach(el => {
            el.classList.remove("highlight");
        });
        document.querySelectorAll(".menu a.highlight-nav").forEach(el => {
            el.classList.remove("highlight-nav");
        });

        // Marcar o link clicado na nav
        this.classList.add("highlight-nav");

        if (targetId == "top"){
          document.querySelector('.content').scrollTo({ top: 0, behavior: "smooth" });
          section = document.getElementById('intro');
        }

        if (section) {
            const title = section.querySelector("h1, h2, .advanced-bottom-card-header strong");
            if (title) title.classList.add("highlight");

            if (targetId !== "top"){
              section.scrollIntoView({ behavior: "smooth", block: "start" });
            }
        }
    });
});
