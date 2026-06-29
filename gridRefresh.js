// Logger de debug — mude para true para habilitar logs em desenvolvimento
const DEBUG = false;
const log = (...args) => DEBUG && console.log(...args);

// ── Toast de notificação visual na página do Salesforce ──────
function showInsvToast(message, type, duration) {
  if (!type) type = 'success';
  if (!duration) duration = 3000;

  if (!document.getElementById('insv-toast-style')) {
    const s = document.createElement('style');
    s.id = 'insv-toast-style';
    // Mirrors the options-page toast (.toast in styles/options.css): solid
    // per-type fill, white text (dark on gold), 300px, weight 600, brand
    // box-shadow. Tokens hardcoded — can't import variaveis.css into a
    // content script.
    s.textContent = [
      '#insv-toast-container{position:fixed;bottom:30px;right:20px;z-index:2147483647;',
      'display:flex;flex-direction:column;gap:10px;pointer-events:none;',
      "font-family:'Outfit',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}",
      '.insv-toast{width:300px;padding:14px 18px;border-radius:8px;color:#fff;',
      'font-size:0.9rem;font-weight:600;line-height:1.4;',
      'box-shadow:0 8px 24px -8px rgba(0,0,0,.35),0 2px 6px -2px rgba(0,0,0,.25);',
      // AA: white text needs brand-600/success-700, not brand-500/success-500
      'background:#0085BB;opacity:0;transform:translateY(10px);',
      'transition:opacity .3s ease,transform .3s ease}',
      '.insv-toast.show{opacity:1;transform:translateY(0)}',
      '.insv-toast.success{background:#15803D}',
      '.insv-toast.error{background:#EF4444}',
      '.insv-toast.warning{background:#FFD166;color:#1B2340}',
      '.insv-toast.info{background:#0085BB}',
      '@media (prefers-reduced-motion:reduce){.insv-toast{transition:opacity .2s linear;',
      'transform:none}.insv-toast.show{transform:none}}',
    ].join('');
    document.head.appendChild(s);
  }

  let container = document.getElementById('insv-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'insv-toast-container';
    container.setAttribute('role', 'status');
    container.setAttribute('aria-live', 'polite');
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = 'insv-toast ' + type;
  toast.textContent = message;
  container.appendChild(toast);

  requestAnimationFrame(function() {
    requestAnimationFrame(function() { toast.classList.add('show'); });
  });
  setTimeout(function() {
    toast.classList.remove('show');
    setTimeout(function() { if (toast.parentNode) toast.remove(); }, 250);
  }, duration);
}

function insvStart() {
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

let legacyModeStarted = false;
function initLegacyMode(intervalSeconds) {
  // Guard against stacked timers/listeners: initLegacyModeListener calls this
  // again on every legacyActive toggle, and this function registers its own
  // storage.onChanged listener + interval. Initialise the controller once per
  // page; subsequent activate/deactivate is handled by its own listener below.
  if (legacyModeStarted) return;
  legacyModeStarted = true;

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
    // Guard NaN (cleared interval field) / out-of-range: NaN*1000 clamps to the
    // browser minimum and spins a tight refresh loop.
    const sec = Number(interval);
    const safe = isFinite(sec) && sec >= 5 ? sec : 10;
    legacyTimer = setInterval(legacyRefresh, safe * 1000);
    log(`[Debug] Timer do Legacy Mode configurado para ${safe} segundos`);
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
  const _initToastShown = new Set();
  let _needsClickToastShown = false;

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
        if (!_needsClickToastShown) {
          _needsClickToastShown = true;
          showInsvToast('Ação necessária — clique na página para ativar o áudio', 'warning', 5000);
        }
        return;
      }

      if (soundName.startsWith("custom_")) {
      chrome.storage.local.get("audiosPersonalizados", (data) => {
        const customAudios = data.audiosPersonalizados || {};
        const customAudio = customAudios[soundName];

        if (customAudio && customAudio.data) {
          log(`[Debug] Tocando áudio personalizado: ${customAudio.name}`);
          try {
            // Data URLs play directly — no manual base64 → Blob → object URL.
            const audio = new Audio(customAudio.data);
            audio.volume = volume;
            audio.addEventListener("error", (e) => {
              log("Erro ao tocar áudio personalizado:", e);
              tocarSomPadrao("notification.mp3", volume);
            });
            audio.play().catch((e) => {
              log("Erro ao tocar áudio personalizado:", e);
              tocarSomPadrao("notification.mp3", volume);
            });
          } catch (error) {
            log("Erro ao processar áudio personalizado:", error);
            tocarSomPadrao("notification.mp3", volume);
          }
        } else {
          log(`[INSV] Áudio personalizado não encontrado: ${soundName}`);
          tocarSomPadrao("notification.mp3", volume);
        }
      });
      } else {
        tocarSomPadrao(soundName, volume);
      }
    } catch (e) {
      log("[Debug] Erro ao tocar som:", e);
      try {
        tocarSomPadrao("notification.mp3", volume);
      } catch (e2) {
        log("[Debug] Erro ao tocar som padrão:", e2);
      }
    }
  }

  function tocarSomPadrao(soundName, volume) {
    log(`[Debug] Tocando áudio padrão: ${soundName}`);
    const audioSrc = chrome.runtime.getURL("assets/sounds/" + soundName);
    const audio = new Audio(audioSrc);
    audio.volume = volume;
    audio.play().catch(() => {});
  }

  const filaMonitores = new Map();
  const statusNotificationPrevious = {};

  function iniciarMonitoramentoFila(fila, globalSound, globalVolume, isPaid) {
    let seenCaseIds = new Set();
    // Monitors are recreated on any settings change (volume nudge included).
    // Without this, the first cycle treats every case already on screen as new
    // and rings. The first cycle seeds the baseline silently.
    let primed = false;

    const loop = () => {
      if (!isRightQueue(fila.name)) {
        log(`[Debug] Retornando, fila incorreta: ${fila.name}`);
        return;
      }

      if (!_initToastShown.has(fila.name)) {
        _initToastShown.add(fila.name);
        showInsvToast('INSV ativo — monitorando ' + fila.name, 'info', 4000);
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

        if (primed && novos.length > 0 && fila.soundEnabled) {
          log(`[Debug] Novos casos na fila "${fila.name}": "${novos}"`);
          const soundToUse = fila.customSound || globalSound;
          log(`[Debug] Som para fila "${fila.name}": ${soundToUse}`);
          if (isRightQueue(fila.name)) {
            tocarSom(soundToUse, globalVolume);
          }
        }

        novos.forEach((id) => seenCaseIds.add(id));
        primed = true;

        // Notificação de mudança de status — config por fila
        // (queues[].statusNotify), recurso premium
        const sn = fila.statusNotify;
        if (isPaid && sn && sn.enabled && (sn.statuses || []).length > 0 && isRightQueue(fila.name)) {
          const currentMap = getCaseStatusMap();
          const targetStatuses = new Set(sn.statuses.map((s) => s.trim().toLowerCase()));
          // Per-queue sub-map keyed by caseId. Nested (not "name_caseId") so
          // eviction can't be fooled by queue names sharing a prefix.
          const filaPrev =
            statusNotificationPrevious[fila.name] ||
            (statusNotificationPrevious[fila.name] = {});
          let played = false;
          for (const [caseId, status] of Object.entries(currentMap)) {
            const statusLower = status.toLowerCase();
            const prev = filaPrev[caseId];
            if (targetStatuses.has(statusLower) && prev !== status) {
              if (!played) {
                tocarSom(sn.sound || "notification.mp3", globalVolume);
                played = true;
              }
            }
            filaPrev[caseId] = status;
          }
          // Evict cases that have left the queue so the map stays bounded.
          for (const id of Object.keys(filaPrev)) {
            if (!(id in currentMap)) delete filaPrev[id];
          }
        }
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
    // Agendamento por timestamp em vez de setInterval: navegadores
    // limitam timers em abas em background, então ao voltar a aba
    // visível comparamos com lastRefreshAt para respeitar o intervalo
    // configurado — no máximo 1 refresh imediato, nunca em rajada.
    const intervalMs = (fila.interval || 15) * 1000;
    let timerId = null;
    let lastRefreshAt = Date.now();
    let cancelled = false;

    function schedule(delay) {
      if (cancelled) return;
      clearTimeout(timerId);
      timerId = setTimeout(runCycle, delay);
    }

    function runCycle() {
      if (cancelled) return;
      lastRefreshAt = Date.now();
      loop();
      schedule(intervalMs);
    }

    function onVisibilityChange() {
      if (cancelled || document.visibilityState !== "visible") return;
      const elapsed = Date.now() - lastRefreshAt;
      if (elapsed >= intervalMs) {
        log(`[Debug] Aba voltou a ficar visível — refresh imediato da fila "${fila.name}"`);
        runCycle();
      } else {
        schedule(intervalMs - elapsed);
      }
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    schedule(intervalMs);

    filaMonitores.set(fila.name, {
      cancel() {
        cancelled = true;
        clearTimeout(timerId);
        document.removeEventListener("visibilitychange", onVisibilityChange);
      },
    });
  }

  function pararMonitoramentosAtuais() {
    filaMonitores.forEach((monitor, nomeFila) => {
      monitor.cancel();
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
                  iniciarMonitoramentoFila(fila, defaultSound, volume, isPaid);
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
        showInsvToast('Chamado aceito', 'success', 2500);
        return true;
      }
    }
    log("[Debug] Botão Aceitar não encontrado");
    showInsvToast('Nenhum chamado selecionado', 'warning', 2500);
    return false;
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
    // Only flip the stored state. The toast is fired from the storage
    // onChanged handler below, so it shows on every page that observes the
    // change — no page refresh, and the same toast whether the toggle came
    // from this shortcut, the popup, or another tab.
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
        showInsvToast(
          isPaused ? 'Atualização de filas pausada' : 'Atualização de filas retomada',
          isPaused ? 'warning' : 'success',
          3000
        );
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

// run_at:document_idle can inject this script AFTER the window 'load' event has
// already fired, and on the Salesforce Lightning SPA 'load' never fires again
// on in-app (soft) navigations. Gating startup on window.onload left the script
// inert in both cases. Start as soon as the document is parsed instead.
if (document.readyState === "interactive" || document.readyState === "complete") {
  insvStart();
} else {
  document.addEventListener("DOMContentLoaded", insvStart, { once: true });
}
