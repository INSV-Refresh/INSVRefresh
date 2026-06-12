// Logger de debug — mude para true para habilitar logs em desenvolvimento
const DEBUG = false;
const log = (...args) => DEBUG && console.log(...args);

window.onload = function () {
  log("[Debug] GRID REFRESH ATIVADO");

  chrome.storage.sync.get(["legacyMode", "legacyInterval", "legacyActive"], (result) => {
    if (result.legacyMode) {
      if (result.legacyActive) {
        log("[Debug] LEGACY MODE ATIVADO");
        initLegacyMode(result.legacyInterval || 10);
      } else {
        log("[Debug] LEGACY MODE CONFIGURADO MAS INATIVO");
        initLegacyModeListener();
      }
      return;
    }

    initNormalMode();
  });
};

function initLegacyModeListener() {
  log("[Debug] Aguardando ativação do Legacy Mode");

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync") {
      if (changes.legacyMode && !changes.legacyMode.newValue) {
        log("[Debug] Legacy Mode desativado. Recarregando página...");
        window.location.reload();
        return;
      }

      if (changes.legacyActive && changes.legacyActive.newValue) {
        chrome.storage.sync.get(["legacyInterval"], (result) => {
          log("[Debug] Legacy Mode foi ativado");
          initLegacyMode(result.legacyInterval || 10);
        });
      }
    }
  });
}

function doRefresh() {
  const refreshButton = document.querySelector('button[name="refreshButton"]');
  if (refreshButton) {
    refreshButton.click();
    return true;
  }
  return false;
}

function initLegacyMode(intervalSeconds) {
  log(`[Debug] Iniciando Legacy Mode com intervalo de ${intervalSeconds} segundos`);

  let legacyTimer = null;

  function legacyRefresh() {
    log("[Debug] Executando refresh legacy");
    doRefresh();
  }

  function startLegacyTimer(interval) {
    if (legacyTimer) {
      clearInterval(legacyTimer);
    }
    legacyTimer = setInterval(legacyRefresh, interval * 1000);
    log(`[Debug] Timer do Legacy Mode configurado para ${interval} segundos`);
  }

  function stopLegacyTimer() {
    if (legacyTimer) {
      clearInterval(legacyTimer);
      legacyTimer = null;
      log("[Debug] Timer do Legacy Mode parado");
    }
  }

  legacyRefresh();

  startLegacyTimer(intervalSeconds);

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync") {
      if (changes.legacyMode && !changes.legacyMode.newValue) {
        log("[Debug] Legacy Mode desativado. Recarregando página...");
        stopLegacyTimer();
        window.location.reload();
        return;
      }

      chrome.storage.sync.get(["legacyMode", "legacyActive", "legacyInterval"], (result) => {
        if (!result.legacyMode) return;

        if (changes.legacyActive) {
          if (changes.legacyActive.newValue) {
            log("[Debug] Legacy Mode ativado");
            startLegacyTimer(result.legacyInterval || 10);
          } else {
            log("[Debug] Legacy Mode pausado");
            stopLegacyTimer();
          }
        }

        if (changes.legacyInterval && result.legacyActive) {
          log(`[Debug] Intervalo do Legacy Mode alterado para ${changes.legacyInterval.newValue} segundos`);
          startLegacyTimer(changes.legacyInterval.newValue);
        }
      });
    }
  });

  log("[Debug] Legacy Mode configurado com sucesso");
}

function initNormalMode() {
  log("[Debug] Iniciando modo normal com todas as funcionalidades");

  let audioEnabled = false;

  document.addEventListener(
    "click",
    () => {
      audioEnabled = true;
      log("[Debug] Som ativado após clique");
      if (typeof reportExtensionActive === "function") reportExtensionActive();
    },
    { once: true }
  );

  function isRightQueue(queueName) {
    const title = document.querySelector(".slds-page-header__title");
    return title && title.innerText.toLowerCase().trim() === queueName.toLowerCase().trim();
  }

  function getNewCaseIds(seenCaseIds) {
    const caseLinks = document.querySelectorAll('.mainContentMark .split-left table[role="grid"] tbody tr th span a');
    const newIds = [];

    caseLinks.forEach((link) => {
      const caseId = link.textContent.trim();
      if (!seenCaseIds.has(caseId)) {
        newIds.push(caseId);
      }
    });

    return newIds;
  }

  function getStatusColumnIndex() {
    const table = document.querySelector('.mainContentMark .split-left table[role="grid"]');
    if (!table) return -1;
    const headers = table.querySelectorAll('thead th, thead tr th, [role="columnheader"]');
    for (let i = 0; i < headers.length; i++) {
      const text = (headers[i].textContent || "").trim().toLowerCase();
      if (text.includes("status")) return i;
    }
    return -1;
  }

  function getCaseStatusMap() {
    const table = document.querySelector('.mainContentMark .split-left table[role="grid"]');
    const statusCol = getStatusColumnIndex();
    if (!table || statusCol < 0) return {};
    const rows = table.querySelectorAll('tbody tr');
    const map = {};
    rows.forEach((row) => {
      const caseLink = row.querySelector('th span a');
      const cells = row.querySelectorAll('th, td');
      const caseId = caseLink ? caseLink.textContent.trim() : "";
      const status = (cells[statusCol] && cells[statusCol].textContent || "").trim();
      if (caseId) map[caseId] = status;
    });
    return map;
  }

  function tocarSom(soundName, volume) {
    try {
      if (!audioEnabled) {
        log("[Debug] Audio desabilitado, clique na tela");
        return;
      }

      if (soundName.startsWith("custom_")) {
      chrome.storage.local.get("audiosPersonalizados", (data) => {
        const customAudios = data.audiosPersonalizados || {};
        const customAudio = customAudios[soundName];

        if (customAudio && customAudio.data) {
          log(`[Debug] Tocando áudio personalizado: ${customAudio.name}`);
          try {
            const base64Data = customAudio.data.split(",")[1];
            const mimeType = customAudio.data.split(",")[0].split(":")[1].split(";")[0];
            const binaryString = atob(base64Data);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            const blob = new Blob([bytes], { type: mimeType });
            const blobUrl = URL.createObjectURL(blob);
            const audio = new Audio(blobUrl);
            audio.volume = volume;
            audio.addEventListener("ended", () => {
              URL.revokeObjectURL(blobUrl);
            });
            audio.addEventListener("error", (e) => {
              console.error("Erro ao tocar áudio personalizado:", e);
              URL.revokeObjectURL(blobUrl);
              tocarSomPadrao("notification.mp3", volume);
            });
            audio.play().catch((e) => {
              console.error("Erro ao tocar áudio personalizado:", e);
              URL.revokeObjectURL(blobUrl);
              tocarSomPadrao("notification.mp3", volume);
            });
          } catch (error) {
            console.error("Erro ao processar áudio personalizado:", error);
            tocarSomPadrao("notification.mp3", volume);
          }
        } else {
          console.warn(`[INSV] Áudio personalizado não encontrado: ${soundName}`);
          tocarSomPadrao("notification.mp3", volume);
        }
      });
      } else {
        tocarSomPadrao(soundName, volume);
      }
    } catch (e) {
      console.error("[Debug] Erro ao tocar som:", e);
      try {
        tocarSomPadrao("notification.mp3", volume);
      } catch (e2) {
        console.error("[Debug] Erro ao tocar som padrão:", e2);
      }
    }
  }

  function tocarSomPadrao(soundName, volume) {
    log(`[Debug] Tocando áudio padrão: ${soundName}`);
    const audioSrc = chrome.runtime.getURL("assets/sounds/" + soundName);
    const audio = new Audio(audioSrc);
    audio.volume = volume;
    audio.play().catch((e) => console.error("Erro ao tocar o som padrão:", e));
  }

  const filaMonitores = new Map();
  const statusNotificationPrevious = {};

  function iniciarMonitoramentoFila(fila, globalSound, globalVolume) {
    let seenCaseIds = new Set();

    const loop = () => {
      if (!isRightQueue(fila.name)) {
        log(`[Debug] Retornando, fila incorreta: ${fila.name}`);
        return;
      }

      const userIsEditing = document.querySelector(".mainContentMark .split-left .slds-checkbox [type=checkbox]:checked");

      if (!userIsEditing) {
        log(`[Debug] Executando refresh da fila: "${fila.name}"`);
        doRefresh();
      } else {
        log("[Debug] Ignorou refresh - usuário está com chamado selecionado");
      }

      function afterRefreshReady() {
        const novos = getNewCaseIds(seenCaseIds);

        if (novos.length > 0 && fila.soundEnabled) {
          log(`[Debug] Novos casos na fila "${fila.name}": "${novos}"`);
          const soundToUse = fila.customSound || globalSound;
          log(`[Debug] Som para fila "${fila.name}": ${soundToUse}`);
          if (isRightQueue(fila.name)) {
            tocarSom(soundToUse, globalVolume);
          }
        }

        novos.forEach((id) => seenCaseIds.add(id));

        chrome.storage.local.get(["statusNotifications", "general"], (data) => {
          chrome.runtime.sendMessage({ type: "GET_ACCESS_LEVEL" }, (access) => {
            const isPaid = !!(access && access.isPaid);
            if (!isPaid) return;
            const configs = data.statusNotifications || [];
            const volume = (data.general && data.general.volume) || 0.5;
            const currentMap = getCaseStatusMap();
            let played = false;
            configs.forEach((sn) => {
              if (
                sn.enabled &&
                sn.queueName &&
                (sn.statuses || []).length > 0 &&
                isRightQueue(sn.queueName) &&
                fila.name.toLowerCase().trim() === (sn.queueName || "").toLowerCase().trim()
              ) {
                const targetStatuses = new Set((sn.statuses || []).map((s) => s.trim().toLowerCase()));
                for (const [caseId, status] of Object.entries(currentMap)) {
                  const statusLower = status.toLowerCase();
                  const key = `${sn.queueName}_${caseId}`;
                  const prev = statusNotificationPrevious[key];
                  if (targetStatuses.has(statusLower) && prev !== status) {
                    if (!played) {
                      tocarSom(sn.sound || "notification.mp3", volume);
                      played = true;
                    }
                  }
                  statusNotificationPrevious[key] = status;
                }
              }
            });
          });
        });
      }

      (function waitForRefreshDone() {
        const grid = document.querySelector(".mainContentMark .split-left");
        const spinner = grid && grid.querySelector('.slds-spinner, [class*="spinner"], [role="progressbar"]');
        if (!spinner) {
          setTimeout(afterRefreshReady, 400);
          return;
        }
        const done = () => {
          clearTimeout(fallback);
          afterRefreshReady();
        };
        const fallback = setTimeout(done, 5000);
        const observer = new MutationObserver(() => {
          const still = grid && grid.querySelector('.slds-spinner, [class*="spinner"], [role="progressbar"]');
          if (!still) {
            observer.disconnect();
            done();
          }
        });
        if (grid) observer.observe(grid, { childList: true, subtree: true });
      })();
    };
    const intervalo = setInterval(loop, (fila.interval || 15) * 1000);
    filaMonitores.set(fila.name, intervalo);
  }

  function pararMonitoramentosAtuais() {
    filaMonitores.forEach((intervalId, nomeFila) => {
      clearInterval(intervalId);
      log(`[Debug] Parando monitoramento da fila: ${nomeFila}`);
    });
    filaMonitores.clear();
  }

  function carregarEIniciarTodos() {
    try {
      chrome.storage.local.get(["queues", "general", "advanced"], (data) => {
        try {
          // Pausa global: suspende todos os timers sem alterar o flag
          // active de cada fila — ao retomar, o conjunto ativo é restaurado
          if (data.advanced && data.advanced.globalPaused) {
            log("[Debug] Pausa global ativa — monitoramento suspenso");
            pararMonitoramentosAtuais();
            return;
          }
          chrome.runtime.sendMessage({ type: "GET_ACCESS_LEVEL" }, (access) => {
            try {
              if (chrome.runtime.lastError) {
                console.warn("[INSV] Erro ao obter nível de acesso:", chrome.runtime.lastError);
              }
              const isPaid = !!(access && access.isPaid);
              let filas = (data.queues || []).filter((q) => q.active);
              if (!isPaid && filas.length > 1) filas = filas.slice(0, 1);
              const defaultSound = "notification.mp3";
              const volume = (data.general && data.general.volume) || 0.5;

              log(`[Debug] Som padrão: ${defaultSound}`);
              log(`[Debug] Volume: ${volume}`);

              pararMonitoramentosAtuais();

              filas.forEach((fila) => {
                if (fila.name) {
                  log(`[Debug] Iniciando monitoramento da fila: "${fila.name}"`);
                  iniciarMonitoramentoFila(fila, defaultSound, volume);
                }
              });
            } catch (e) {
              console.error("[Debug] Erro ao processar filas:", e);
            }
          });
        } catch (e) {
          console.error("[Debug] Erro ao obter dados:", e);
        }
      });
    } catch (e) {
      console.error("[Debug] Erro ao carregar configurações:", e);
    }
  }

  function reportExtensionActive() {
    chrome.storage.local.get(["queues", "advanced"], (data) => {
      const queues = (data.queues || []).filter((q) => q.active);
      const paused = !!(data.advanced && data.advanced.globalPaused);
      const active = audioEnabled && queues.length > 0 && !paused;
      chrome.runtime.sendMessage({ type: "INSV_EXTENSION_ACTIVE", active }).catch(() => {});
    });
  }

  function clickAcceptButton() {
    const buttons = document.querySelectorAll("button");
    for (const btn of buttons) {
      const text = (btn.textContent || "").trim();
      const ariaLabel = (btn.getAttribute("aria-label") || "").toLowerCase();
      const title = (btn.getAttribute("title") || "").toLowerCase();
      const hasAcceptText = /aceitar|accept|assumir|assume|take|tomar/i.test(text + " " + ariaLabel + " " + title);
      if (hasAcceptText && !btn.disabled && btn.offsetParent !== null) {
        btn.click();
        log("[Debug] Botão Aceitar clicado via atalho");
        return;
      }
    }
    log("[Debug] Botão Aceitar não encontrado");
  }

  function matchesShortcut(e, sc) {
    return (
      e.ctrlKey === !!sc.ctrl &&
      e.altKey === !!sc.alt &&
      e.shiftKey === !!sc.shift &&
      e.metaKey === !!sc.meta &&
      e.code === sc.code
    );
  }

  function setupAcceptShortcut() {
    chrome.storage.local.get("advanced", (data) => {
      const adv = data.advanced || {};
      const shortcut = adv.acceptShortcut && adv.acceptShortcut.code ? adv.acceptShortcut : null;
      const legacyKey = (adv.acceptShortcutKey || "").trim();
      if (window._insvAcceptShortcutHandler) {
        document.removeEventListener("keydown", window._insvAcceptShortcutHandler);
        window._insvAcceptShortcutHandler = null;
      }
      if (!shortcut && !legacyKey) return;
      window._insvAcceptShortcutHandler = (e) => {
        if (e.target && (e.target.matches("input, textarea, select") || e.target.isContentEditable)) return;
        let match = false;
        if (shortcut) {
          match = matchesShortcut(e, shortcut);
        } else {
          // Retrocompat: atalho antigo salvo como string de tecla única
          const k = (e.key || e.code || "").toUpperCase();
          const keyUpper = legacyKey.toUpperCase();
          match = k === keyUpper || e.code === legacyKey || e.code === "Key" + keyUpper;
        }
        if (match) {
          e.preventDefault();
          clickAcceptButton();
        }
      };
      document.addEventListener("keydown", window._insvAcceptShortcutHandler);
    });
  }
  setupAcceptShortcut();

  function toggleGlobalPause() {
    chrome.storage.local.get("advanced", (data) => {
      const adv = data.advanced || {};
      adv.globalPaused = !adv.globalPaused;
      chrome.storage.local.set({ advanced: adv });
    });
  }

  function setupPauseShortcut() {
    chrome.storage.local.get("advanced", (data) => {
      const adv = data.advanced || {};
      const shortcut = adv.pauseAllShortcut && adv.pauseAllShortcut.code ? adv.pauseAllShortcut : null;
      if (window._insvPauseShortcutHandler) {
        document.removeEventListener("keydown", window._insvPauseShortcutHandler);
        window._insvPauseShortcutHandler = null;
      }
      if (!shortcut) return;
      window._insvPauseShortcutHandler = (e) => {
        if (e.target && (e.target.matches("input, textarea, select") || e.target.isContentEditable)) return;
        if (matchesShortcut(e, shortcut)) {
          e.preventDefault();
          toggleGlobalPause();
        }
      };
      document.addEventListener("keydown", window._insvPauseShortcutHandler);
    });
  }
  setupPauseShortcut();

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg && msg.type === "GET_QUEUE_NAME") {
      try {
        const title = document.querySelector(".slds-page-header__title");
        const queueName = title ? title.innerText.trim() : "";
        sendResponse({ queueName });
      } catch (e) {
        sendResponse({ queueName: "", error: e.message });
      }
      return true;
    }
    return false;
  });

  carregarEIniciarTodos();
  reportExtensionActive();

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && (changes.queues || changes.general || changes.audiosPersonalizados)) {
      log("[Debug] Alterações detectadas no storage. Reiniciando monitoramento...");
      carregarEIniciarTodos();
      if (typeof reportExtensionActive === "function") reportExtensionActive();
    }
    if (area === "local" && changes.advanced) {
      setupAcceptShortcut();
      setupPauseShortcut();
      const wasPaused = !!(changes.advanced.oldValue && changes.advanced.oldValue.globalPaused);
      const isPaused = !!(changes.advanced.newValue && changes.advanced.newValue.globalPaused);
      if (wasPaused !== isPaused) {
        log(`[Debug] Pausa global ${isPaused ? "ativada" : "desativada"}`);
        carregarEIniciarTodos();
        reportExtensionActive();
      }
    }

    if (area === "sync" && changes.legacyMode && changes.legacyMode.newValue && !changes.legacyMode.oldValue) {
      log("[Debug] Legacy Mode foi ativado pela primeira vez. Recarregando página...");
      window.location.reload();
    }
  });
}
