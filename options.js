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

function trackEvent(eventName, data) {
  try {
    chrome.storage.local.get("analytics", (result) => {
      const analytics = result.analytics || { events: [], lastCleanup: Date.now() };
      analytics.events.push({ name: eventName, data, timestamp: Date.now() });
      if (analytics.events.length > 1000) {
        analytics.events = analytics.events.slice(-500);
        analytics.lastCleanup = Date.now();
      }
      chrome.storage.local.set({ analytics });
    });
  } catch (e) {}
}

function exportSettings() {
  try {
    chrome.storage.local.get(null, (allData) => {
      const exportData = {
        version: chrome.runtime.getManifest().version,
        exportDate: new Date().toISOString(),
        queues: allData.queues || [],
        general: allData.general || {},
        statusNotifications: allData.statusNotifications || [],
        advanced: allData.advanced || {},
        audiosPersonalizados: allData.audiosPersonalizados || {},
      };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `insv-refresh-backup-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast("Configurações exportadas!", "success");
      trackEvent("settings_exported");
    });
  } catch (e) {
    showToast("Erro ao exportar: " + e.message, "error");
  }
}

function importSettings(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const importData = JSON.parse(e.target.result);
      if (!importData.queues && !importData.statusNotifications) {
        throw new Error("Arquivo inválido");
      }
      const toImport = {
        queues: importData.queues || [],
        general: importData.general || {},
        statusNotifications: importData.statusNotifications || [],
        advanced: importData.advanced || {},
        audiosPersonalizados: importData.audiosPersonalizados || {},
      };
      chrome.storage.local.set(toImport, () => {
        showToast("Configurações importadas! Recarregue a página.", "success");
        trackEvent("settings_imported");
        setTimeout(() => window.location.reload(), 1500);
      });
    } catch (err) {
      showToast("Erro ao importar: " + err.message, "error");
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
    showToast("Formato inválido. Por favor, envie um arquivo MP3, WAV, OGG, MP4 ou WebM.", "error");
    input.value = "";
    document.getElementById('save-audio-btn').disabled = true;
    document.getElementById('audio-preview').innerHTML = '';
    resetDropArea();
    return;
  }

  if (file.size > maxSizeMB * 1024 * 1024) {
    showToast("Arquivo muito grande. O tamanho máximo permitido é 5MB.", "error");
    input.value = "";
    document.getElementById('save-audio-btn').disabled = true;
    document.getElementById('audio-preview').innerHTML = '';
    resetDropArea();
    return;
  }

  showAudioPreview(file);
  
  const nameInput = document.getElementById('custom-audio-name');
  if (!nameInput.value) {
    const fileName = file.name.replace(/.[^/.]+$/, "");
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
    showToast('Por favor, selecione um arquivo de áudio primeiro.', "warning");
    return;
  }
  
  if (!customName) {
    showToast('Por favor, insira um nome para o áudio.', "warning");
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
        showToast('Áudio personalizado salvo com sucesso!', "success"); 
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
    
    if (!container) {
      const newContainer = document.createElement('div');
      newContainer.id = 'custom-audios-list';
      document.getElementById('upload-audio').appendChild(newContainer);
      return loadCustomAudios();
    }
    
    container.innerHTML = '';
    
    const audioKeys = Object.keys(customAudios);
    if (audioKeys.length === 0) {
      container.innerHTML = '<p>Nenhum áudio personalizado encontrado.</p>';
      return;
    }
    
    audioKeys.forEach(key => {
      const audioInfo = customAudios[key];
      const audioItem = document.createElement('div');
      
      audioItem.innerHTML = `
        <div>
          <strong>${audioInfo.name}</strong>
          <div class="background-audio-viewer">
            Arquivo: ${audioInfo.originalName}
            ${audioInfo.createdAt ? ' • Adicionado em: ' + new Date(audioInfo.createdAt).toLocaleDateString('pt-BR') : ''}
          </div>
          <audio controls>
            <source src="${audioInfo.data}" type="audio/mpeg">
            Seu navegador não suporta áudio.
          </audio>
        </div>
        <button class="delete-audio-btn" data-audio-key="${key}">
          Excluir
        </button>
      `;
      
      container.appendChild(audioItem);
      
      const deleteBtn = audioItem.querySelector('.delete-audio-btn');
      deleteBtn.addEventListener('click', function() {
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
      showToast('Áudio deletado com sucesso!', "success");
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
    showDropError('Por favor, selecione apenas um arquivo por vez.');
    return;
  }
  
  if (files.length === 1) {
    handleFiles(files[0]);
  }
}

function handleFiles(file) {
  const validTypes = ["audio/mpeg", "audio/wav", "audio/ogg", "audio/mp4", "audio/webm"];
  
  if (!validTypes.includes(file.type)) {
    showDropError('Tipo de arquivo não suportado. Use MP3, WAV, OGG, MP4 ou WebM.');
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
    <div class="drop-icon">✅</div>
    <div class="drop-text">
      <strong>Arquivo carregado com sucesso!</strong>
      <p>Preencha o nome e clique em "Salvar Áudio"</p>
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
    <div class="drop-icon">🎵</div>
    <div class="drop-text">
      <strong>Arraste um arquivo de áudio aqui</strong>
      <p>ou <button type="button" id="browse-btn" class="browse-btn">clique para procurar</button></p>
    </div>
    <div class="drop-formats">
      Formatos: MP3, WAV, OGG, MP4, WebM (máx. 5MB)
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
    { value: "notification.mp3", text: "Padrão" },
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

function createStatusNotificationItem(cfg, index) {
  const div = document.createElement("div");
  div.className = "status-notification-item";
  div.dataset.index = index;
  div.innerHTML = `
    <div class="status-notification-header">
      <strong>Notificação ${index + 1}</strong>
      <button type="button" class="remove-status-notification-btn" data-index="${index}">✕</button>
    </div>
    <div class="status-notification-fields">
      <label>
        <input type="checkbox" class="status-notification-enabled" ${cfg.enabled ? "checked" : ""}>
        Ativar
      </label>
      <label>Fila: <input type="text" class="status-notification-queue" value="${cfg.queueName || ""}" placeholder="Nome exato da fila"></label>
      <label>Status: <input type="text" class="status-notification-statuses" value="${(cfg.statuses || []).join(";")}" placeholder="Ex: Em andamento;Resolvido"></label>
      <small>Separe vários status com <strong>;</strong></small>
      <label>Som: <select class="status-notification-sound"></select></label>
    </div>
  `;
  const soundSelect = div.querySelector(".status-notification-sound");
  loadStatusNotificationSounds(soundSelect, cfg.sound || "notification.mp3", true);
  return div;
}

function loadStatusNotificationOptions() {
  const container = document.getElementById("status-notifications-list");
  if (!container) return;
  chrome.storage.local.get("statusNotifications", (data) => {
    const configs = data.statusNotifications || [];
    if (configs.length === 0) {
      configs.push({ enabled: false, queueName: "", statuses: [], sound: "notification.mp3" });
    }
    container.innerHTML = "";
    configs.forEach((cfg, idx) => {
      container.appendChild(createStatusNotificationItem(cfg, idx));
    });
    attachStatusNotificationListeners();
  });
}

function attachStatusNotificationListeners() {
  document.querySelectorAll(".status-notification-item").forEach((item) => {
    const inputs = item.querySelectorAll("input, select");
    inputs.forEach((inp) => {
      inp.addEventListener("change", saveAllStatusNotificationsDebounced);
      inp.addEventListener("input", saveAllStatusNotificationsDebounced);
    });
    const removeBtn = item.querySelector(".remove-status-notification-btn");
    if (removeBtn) {
      removeBtn.addEventListener("click", () => {
        item.remove();
        saveAllStatusNotifications();
      });
    }
  });
}

function saveAllStatusNotifications() {
  const items = document.querySelectorAll(".status-notification-item");
  const configs = [];
  items.forEach((item) => {
    const enabled = item.querySelector(".status-notification-enabled")?.checked || false;
    const queueName = item.querySelector(".status-notification-queue")?.value.trim() || "";
    const statusesStr = item.querySelector(".status-notification-statuses")?.value || "";
    const statuses = statusesStr.split(";").map((s) => s.trim()).filter(Boolean);
    const sound = item.querySelector(".status-notification-sound")?.value || "notification.mp3";
    configs.push({ enabled, queueName, statuses, sound });
  });
  chrome.storage.local.set({ statusNotifications: configs }, () => {
    showToast("Notificações de status salvas.", "success");
    trackEvent("status_notification_saved", { count: configs.length });
  });
}

const saveAllStatusNotificationsDebounced = debounce(saveAllStatusNotifications, 500);

function addStatusNotification() {
  const container = document.getElementById("status-notifications-list");
  if (!container) return;
  const newCfg = { enabled: false, queueName: "", statuses: [], sound: "notification.mp3" };
  container.appendChild(createStatusNotificationItem(newCfg, container.children.length));
  attachStatusNotificationListeners();
  saveAllStatusNotifications();
}

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
        badge.textContent = "⭐ Premium";
        h2.appendChild(badge);
      }

      if (!isPaid) {
        section.classList.add("section-locked");

        // Banner "Disponível no plano pago" — apenas 1, sem double wrapper
        if (!section.querySelector(".paid-gate-banner")) {
          const banner = document.createElement("div");
          banner.className = "paid-gate-banner";
          banner.innerHTML = `
            🔒 Disponível no plano pago.
            <a href="${chrome.runtime.getURL('pricing.html')}" target="_blank">Ver planos →</a>
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

    // Gerenciar botão add-status-notification especificamente
    const addBtn = document.getElementById("add-status-notification-btn");
    if (addBtn) {
      addBtn.disabled = !isPaid;
      addBtn.style.opacity = isPaid ? "1" : "0.6";
    }

  } catch (e) {
    console.error("Error applying paid gate:", e);
  }
}

document.addEventListener('DOMContentLoaded', function() {
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
      showToast("Modo Legacy " + (legacyCheckbox.checked ? "ativado" : "desativado"), "success");
    });
  }

  loadStatusNotificationOptions();
  document.getElementById("add-status-notification-btn")?.addEventListener("click", addStatusNotification);

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
      trackEvent("dark_mode_toggled", { enabled: darkModeToggle.checked });
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
          ⏳ <strong>Teste grátis ativo</strong> — ${dias === 1 ? "resta 1 dia" : `restam ${dias} dias`}.
          <a href="${chrome.runtime.getURL("pricing.html")}" target="_blank">Assinar agora →</a>
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
    banner.innerHTML = `
      <strong>Novidades da versão ${v}</strong>
      <ul>
        <li>Botão para copiar o nome da fila (evita erros de digitação)</li>
        <li>Refresh sem interromper busca (usa atualização nativa da página)</li>
        <li>Som quando o status do chamado muda (config. em Notificar status)</li>
        <li>Ícone da extensão fica cinza quando não há filas ativas</li>
        <li>Planos: Grátis, Normal e Empresa (página Planos)</li>
        <li>Atalho de teclado para aceitar chamado (Avançado)</li>
        <li>Validação mais rápida após o refresh</li>
      </ul>
      <button type="button" id="changelog-dismiss">Entendi</button>
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
      captureBtn.innerHTML = '<span class="shortcut-placeholder">Clique e pressione o atalho</span>';
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
    captureBtn.innerHTML = '<span class="shortcut-placeholder">Pressione a combinação… (Esc cancela)</span>';
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
        showToast(sc ? "Atalho salvo." : "Atalho removido.", "success");
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
        : '<span class="shortcut-placeholder">Pressione a combinação…</span>';
      return;
    }

    const sc = { ctrl: e.ctrlKey, alt: e.altKey, shift: e.shiftKey, meta: e.metaKey, code: e.code };
    const modCount = (sc.ctrl ? 1 : 0) + (sc.alt ? 1 : 0) + (sc.shift ? 1 : 0) + (sc.meta ? 1 : 0);
    if (modCount < 1) {
      showCaptureError("Mínimo 2 teclas (use um modificador)");
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
  window.open(chrome.runtime.getURL("pricing.html"), "_blank");
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
          window.scrollTo({ top: 0, behavior: "smooth" });
          section = document.getElementById('intro');
        }

        if (section) {
            const title = section.querySelector("h1, h2");
            if (title) title.classList.add("highlight");

            if (targetId !== "top"){
              section.scrollIntoView({ behavior: "smooth", block: "start" });
            }
        }
    });
});
