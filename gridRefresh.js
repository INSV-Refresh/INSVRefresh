// Logger de debug — mude para true para habilitar logs em desenvolvimento
const DEBUG = false;
const log = (...args) => DEBUG && console.log(...args);

// ── Toast ─────────────────────────────────────────────────────
// showToast is shared from scripts/util.js (loaded as a content script
// before this file). Its injected CSS reads brand tokens on our own pages and
// falls back to literal hex here, where the Salesforce page can't see them.
// Strings are localized via t() (scripts/i18n.js, also a content script).

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

  // Compartilhado por getNewCaseIds e showNewCaseToast — mesma extração de
  // texto (.textContent.trim()) não pode divergir entre os dois pontos.
  const CASE_LINK_SELECTOR = '.mainContentMark .split-left table[role="grid"] tbody tr th span a';

  function getNewCaseIds(seenCaseIds) {
    const caseLinks = document.querySelectorAll(CASE_LINK_SELECTOR);
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

  // Canal único de áudio para todo o monitoramento. Sons sobrepostos somam
  // amplitude: quando vários alertas disparavam no mesmo instante (ao voltar
  // para a aba com um lote de casos novos, ou casos novos + mudança de status
  // no mesmo ciclo) o resultado soava muito mais alto que o volume configurado.
  // Agora só um som toca por vez e há um intervalo mínimo entre disparos.
  const SOUND_COOLDOWN_MS = 1500;
  let _currentAudio = null;
  let _lastSoundAt = 0;

  // ── Detecção por mutation-settle ─────────────────────────────
  // Um MutationObserver não distingue "refresh ainda não respondeu" de
  // "respondeu e nada mudou" — os dois parecem silêncio. GRID_SETTLE_INITIAL_GRACE_MS
  // cobre o primeiro caso (espera mais antes de concluir que nada aconteceu);
  // GRID_SETTLE_QUIET_MS detecta quando a rajada de mutações do render parou,
  // pra não ler o grid no meio do render.
  const GRID_SETTLE_QUIET_MS = 300;
  const GRID_SETTLE_INITIAL_GRACE_MS = 700;
  const GRID_SETTLE_HARD_FALLBACK_MS = 5000;

  // ── Notificação de chamado novo ──────────────────────────────
  const CASE_TOAST_DURATION_MS = 10000;

  function podeTocarSom() {
    const now = Date.now();
    if (now - _lastSoundAt < SOUND_COOLDOWN_MS) {
      log("[Debug] Som suprimido — dentro do cooldown");
      return false;
    }
    _lastSoundAt = now;
    return true;
  }

  function reproduzir(src, volume) {
    // Corta o som anterior antes de iniciar o próximo — nunca dois elementos
    // de áudio tocando ao mesmo tempo.
    if (_currentAudio) {
      try {
        _currentAudio.pause();
        _currentAudio.currentTime = 0;
      } catch (e) {
        log("[Debug] Erro ao parar áudio anterior:", e);
      }
      _currentAudio = null;
    }
    const audio = new Audio(src);
    audio.volume = Math.min(1, Math.max(0, Number(volume) || 0));
    _currentAudio = audio;
    audio.addEventListener("ended", () => {
      if (_currentAudio === audio) _currentAudio = null;
    });
    return audio;
  }

  function tocarSom(soundName, volume) {
    try {
      if (!audioEnabled) {
        log("[Debug] Audio desabilitado, clique na tela");
        if (!_needsClickToastShown) {
          _needsClickToastShown = true;
          showToast(t('audio_activation_required'), 'warning', 5000);
        }
        return;
      }

      if (!podeTocarSom()) return;

      if (soundName.startsWith("custom_")) {
      chrome.storage.local.get("audiosPersonalizados", (data) => {
        const customAudios = data.audiosPersonalizados || {};
        const customAudio = customAudios[soundName];

        if (customAudio && customAudio.data) {
          log(`[Debug] Tocando áudio personalizado: ${customAudio.name}`);
          try {
            // Data URLs play directly — no manual base64 → Blob → object URL.
            const audio = reproduzir(customAudio.data, volume);
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

  // Chamada só a partir de tocarSom (direto ou como fallback do áudio
  // personalizado), que já consumiu o cooldown — não re-checa podeTocarSom.
  function tocarSomPadrao(soundName, volume) {
    log(`[Debug] Tocando áudio padrão: ${soundName}`);
    const audioSrc = chrome.runtime.getURL("assets/sounds/" + soundName);
    reproduzir(audioSrc, volume).play().catch(() => {});
  }

  // Espera o grid "assentar" após um refresh, em vez de confiar só no spinner
  // (que às vezes não aparece em refreshes silenciosos) ou num timeout fixo.
  // Cobre spinner e refresh silencioso com o mesmo mecanismo: observa mutações
  // no grid e só chama onSettle quando elas param por um tempo (quiet period),
  // com um fallback duro pra nunca travar um ciclo indefinidamente.
  function waitForGridSettle(onSettle) {
    const grid = document.querySelector(".mainContentMark .split-left");
    if (!grid) {
      // Grid can be transiently absent right after the refresh click (a
      // Lightning component teardown/rebuild in flight) — give it the same
      // grace period a silent refresh gets instead of reading on the very
      // next tick. Retry once; if it's still gone, give up rather than hang
      // the cycle (afterRefreshReady's own querySelectorAlls just no-op on a
      // missing grid).
      setTimeout(() => {
        const retryGrid = document.querySelector(".mainContentMark .split-left");
        if (retryGrid) {
          watchGridUntilSettle(retryGrid, onSettle);
        } else {
          onSettle();
        }
      }, GRID_SETTLE_INITIAL_GRACE_MS);
      return;
    }
    watchGridUntilSettle(grid, onSettle);
  }

  function watchGridUntilSettle(grid, onSettle) {
    let concluido = false;
    let quietTimer = null;
    let hardFallback = null;
    let observer = null;

    const done = () => {
      if (concluido) return;
      concluido = true;
      clearTimeout(quietTimer);
      clearTimeout(hardFallback);
      observer.disconnect();
      onSettle();
    };

    hardFallback = setTimeout(done, GRID_SETTLE_HARD_FALLBACK_MS);
    quietTimer = setTimeout(done, GRID_SETTLE_INITIAL_GRACE_MS);

    observer = new MutationObserver(() => {
      clearTimeout(quietTimer);
      quietTimer = setTimeout(done, GRID_SETTLE_QUIET_MS);
    });
    observer.observe(grid, { childList: true, subtree: true });
  }

  // Toast com o(s) número(s) do(s) chamado(s) novo(s): número é clicável
  // (abre o chamado, igual clicar nele na grid) e tem botão de copiar do
  // lado. Fica na tela por CASE_TOAST_DURATION_MS, mas pausa a contagem
  // enquanto o mouse estiver em cima — só reinicia quando o hover sai.
  function ensureCaseToastStyle() {
    if (document.getElementById("insv-case-toast-style")) return;
    const s = document.createElement("style");
    s.id = "insv-case-toast-style";
    s.textContent = [
      ".insv-case-toast{display:flex;flex-direction:column;gap:6px}",
      ".insv-case-toast-row{display:flex;align-items:center;gap:8px}",
      ".insv-case-toast-link{color:inherit;text-decoration:underline;font-weight:700;flex:1;cursor:pointer}",
      ".insv-case-toast-link:hover{opacity:0.85}",
      ".insv-case-toast-copy{background:rgba(255,255,255,0.18);border:none;border-radius:4px;",
      "color:inherit;padding:4px;display:inline-flex;cursor:pointer;flex-shrink:0}",
      ".insv-case-toast-copy:hover{background:rgba(255,255,255,0.3)}",
      ".insv-case-toast-copy.copied{background:rgba(255,255,255,0.45)}",
    ].join("");
    document.head.appendChild(s);
  }

  function showNewCaseToast(caseIds) {
    const idSet = new Set(caseIds);
    const cases = [];
    document.querySelectorAll(CASE_LINK_SELECTOR).forEach((link) => {
      const id = link.textContent.trim();
      if (idSet.has(id) && !cases.some((c) => c.id === id)) {
        cases.push({ id, href: link.getAttribute("href") || "" });
      }
    });
    if (!cases.length) return;

    ensureCaseToastStyle();

    // showToast() (util.js) já criou style+container do toast no primeiro
    // ciclo desta fila (toast "monitoring_active" sempre dispara antes de
    // qualquer detecção) — este fallback só importa se essa ordem mudar.
    let container = document.getElementById("insv-toast-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "insv-toast-container";
      container.setAttribute("role", "status");
      container.setAttribute("aria-live", "polite");
      document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    toast.className = "insv-toast info insv-case-toast";

    cases.forEach((c) => {
      const row = document.createElement("div");
      row.className = "insv-case-toast-row";

      const link = document.createElement("a");
      link.className = "insv-case-toast-link";
      link.href = c.href || "javascript:void(0)";
      link.textContent = c.id;
      link.addEventListener("click", (e) => {
        if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey) return; // deixa o navegador abrir em nova aba etc.
        e.preventDefault();
        // Reconsulta na hora do clique — a linha pode ter se movido/sido
        // reciclada desde que o toast apareceu. Clique sintético no link
        // real, pra se comportar exatamente como o usuário clicando nele.
        const current = Array.from(document.querySelectorAll(CASE_LINK_SELECTOR))
          .find((a) => a.textContent.trim() === c.id);
        if (current) current.click();
        else if (c.href) window.location.assign(c.href);
      });
      row.appendChild(link);

      const copyBtn = document.createElement("button");
      copyBtn.type = "button";
      copyBtn.className = "insv-case-toast-copy";
      copyBtn.setAttribute("aria-label", t("copy_case_number"));
      copyBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
      copyBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        navigator.clipboard.writeText(c.id).then(() => {
          copyBtn.classList.add("copied");
          setTimeout(() => copyBtn.classList.remove("copied"), 1200);
        }).catch(() => {});
      });
      row.appendChild(copyBtn);

      toast.appendChild(row);
    });

    container.appendChild(toast);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => toast.classList.add("show"));
    });

    let hideTimer = null;
    let remaining = CASE_TOAST_DURATION_MS;
    let startedAt = Date.now();

    const remove = () => {
      toast.classList.remove("show");
      setTimeout(() => { if (toast.parentNode) toast.remove(); }, 250);
    };
    const startHide = () => {
      startedAt = Date.now();
      hideTimer = setTimeout(remove, remaining);
    };

    toast.addEventListener("mouseenter", () => {
      clearTimeout(hideTimer);
      remaining -= Date.now() - startedAt;
      if (remaining < 0) remaining = 0;
    });
    toast.addEventListener("mouseleave", startHide);

    startHide();
  }

  // Lista, não Map por nome: duas filas com o mesmo nome sobrescreviam a
  // entrada e o monitor antigo virava órfão — timer e listener de
  // visibilitychange vivos para sempre, cada um com seu próprio seenCaseIds,
  // todos tocando som ao mesmo tempo quando a aba voltava a ficar visível.
  let filaMonitores = [];
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
        showToast(t('monitoring_active', { name: fila.name }), 'info', 4000);
      }

      const userIsEditing = document.querySelector(".mainContentMark .split-left .slds-checkbox [type=checkbox]:checked");

      if (!userIsEditing) {
        log(`[Debug] Executando refresh da fila: "${fila.name}"`);
        doRefresh();
      } else {
        log("[Debug] Ignorou refresh - usuário está com chamado selecionado");
      }

      function afterRefreshReady() {
        cicloEmAndamento = false;
        // O ciclo é assíncrono (espera o grid assentar). Se o monitor foi
        // cancelado nesse meio-tempo — qualquer gravação em storage recria
        // todos os monitores — este callback ainda estava agendado e tocava
        // som com o seenCaseIds antigo, somando ao som do monitor novo.
        if (cancelled) {
          log(`[Debug] Ciclo descartado, monitor cancelado: "${fila.name}"`);
          return;
        }

        const novos = getNewCaseIds(seenCaseIds);

        if (primed && novos.length > 0 && fila.soundEnabled && isRightQueue(fila.name)) {
          showNewCaseToast(novos);
        }

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
          // isFirstStatusCheck must be read BEFORE the map is created below —
          // same "prime silently" gate as `primed` above, applied here too:
          // without it, the first status poll ever for this queue name (page
          // load / extension reload) has no baseline, prev is undefined for
          // every case, and any case already sitting in a target status dings
          // immediately even though nothing changed.
          const filaPrev = statusNotificationPrevious[fila.name];
          const isFirstStatusCheck = !filaPrev;
          const filaMap = filaPrev || (statusNotificationPrevious[fila.name] = {});
          let played = false;
          for (const [caseId, status] of Object.entries(currentMap)) {
            const statusLower = status.toLowerCase();
            const prev = filaMap[caseId];
            if (!isFirstStatusCheck && targetStatuses.has(statusLower) && prev !== status) {
              if (!played) {
                tocarSom(sn.sound || "notification.mp3", globalVolume);
                played = true;
              }
            }
            filaMap[caseId] = status;
          }
          // Evict cases that have left the queue so the map stays bounded.
          for (const id of Object.keys(filaMap)) {
            if (!(id in currentMap)) delete filaMap[id];
          }
        }
      }

      cicloEmAndamento = true;

      waitForGridSettle(afterRefreshReady);
    };
    // Agendamento por timestamp em vez de setInterval: navegadores
    // limitam timers em abas em background, então ao voltar a aba
    // visível comparamos com lastRefreshAt para respeitar o intervalo
    // configurado — no máximo 1 refresh imediato, nunca em rajada.
    const intervalMs = (fila.interval || 15) * 1000;
    let timerId = null;
    let lastRefreshAt = Date.now();
    let cancelled = false;
    let cicloEmAndamento = false;

    function schedule(delay) {
      if (cancelled) return;
      clearTimeout(timerId);
      timerId = setTimeout(runCycle, delay);
    }

    function runCycle() {
      if (cancelled) return;
      // Não empilha ciclos: o anterior ainda está esperando o grid terminar de
      // carregar (até 5s). Dois ciclos em paralelo detectam o mesmo lote de
      // casos novos e disparam dois sons juntos.
      if (cicloEmAndamento) {
        log(`[Debug] Ciclo anterior ainda em andamento: "${fila.name}"`);
        schedule(intervalMs);
        return;
      }
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

    filaMonitores.push({
      name: fila.name,
      cancel() {
        cancelled = true;
        clearTimeout(timerId);
        document.removeEventListener("visibilitychange", onVisibilityChange);
      },
    });
  }

  function pararMonitoramentosAtuais() {
    filaMonitores.forEach((monitor) => {
      monitor.cancel();
      log(`[Debug] Parando monitoramento da fila: ${monitor.name}`);
    });
    filaMonitores = [];
  }

  // Chamada de novo a cada storage change relevante (debounced) — sem
  // sequenciamento, uma chamada mais lenta (ex.: GET_ACCESS_LEVEL sem cache)
  // podia resolver DEPOIS de uma mais rápida e disparada depois dela,
  // sobrescrevendo os monitores recém-criados com um snapshot mais antigo.
  let _cargaSeq = 0;

  function carregarEIniciarTodos() {
    const minhaSeq = ++_cargaSeq;
    try {
      chrome.storage.local.get(["queues", "general", "advanced"], (data) => {
        if (minhaSeq !== _cargaSeq) {
          log("[Debug] carregarEIniciarTodos superado por chamada mais recente, descartando");
          return;
        }
        try {
          // Pausa global: suspende todos os timers sem alterar o flag
          // active de cada fila — ao retomar, o conjunto ativo é restaurado
          if (data.advanced && data.advanced.globalPaused) {
            log("[Debug] Pausa global ativa — monitoramento suspenso");
            pararMonitoramentosAtuais();
            return;
          }
          chrome.runtime.sendMessage({ type: "GET_ACCESS_LEVEL" }, (access) => {
            if (minhaSeq !== _cargaSeq) {
              log("[Debug] carregarEIniciarTodos (pós GET_ACCESS_LEVEL) superado, descartando");
              return;
            }
            try {
              if (chrome.runtime.lastError) {
                console.warn("[INSV] Erro ao obter nível de acesso:", chrome.runtime.lastError);
              }
              const isPaid = !!(access && access.isPaid);
              let filas = (data.queues || []).filter((q) => q.active);
              // Uma fila só pode ser monitorada uma vez: entradas duplicadas
              // (mesmo nome, ignorando caixa) rodariam monitores paralelos na
              // mesma página, cada um tocando seu próprio som.
              const vistos = new Set();
              filas = filas.filter((q) => {
                const chave = (q.name || "").toLowerCase().trim();
                if (!chave || vistos.has(chave)) return false;
                vistos.add(chave);
                return true;
              });
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

  // Um único ajuste na UI (arrastar o slider de volume, editar uma fila) gera
  // uma rajada de gravações em storage. Sem debounce cada uma recriava todos os
  // monitores, deixando ciclos assíncronos anteriores em voo.
  let _recargaTimer = null;
  function agendarRecarga() {
    clearTimeout(_recargaTimer);
    _recargaTimer = setTimeout(() => {
      carregarEIniciarTodos();
      reportExtensionActive();
    }, 300);
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
        showToast(t('case_accepted'), 'success', 2500);
        return true;
      }
    }
    log("[Debug] Botão Aceitar não encontrado");
    showToast(t('no_case_selected'), 'warning', 2500);
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

  // Duas mudanças rápidas em "advanced" (ex.: import de settings + edição
  // manual do atalho em seguida) disparam duas leituras assíncronas; sem
  // sequenciamento, a mais antiga podia resolver por último e deixar o
  // atalho velho religado, revertendo silenciosamente a mudança mais nova.
  let _acceptShortcutSeq = 0;
  function setupAcceptShortcut() {
    const minhaSeq = ++_acceptShortcutSeq;
    chrome.storage.local.get("advanced", (data) => {
      if (minhaSeq !== _acceptShortcutSeq) return;
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

  let _pauseShortcutSeq = 0;
  function setupPauseShortcut() {
    const minhaSeq = ++_pauseShortcutSeq;
    chrome.storage.local.get("advanced", (data) => {
      if (minhaSeq !== _pauseShortcutSeq) return;
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
      agendarRecarga();
    }
    if (area === "local" && changes.advanced) {
      setupAcceptShortcut();
      setupPauseShortcut();
      const wasPaused = !!(changes.advanced.oldValue && changes.advanced.oldValue.globalPaused);
      const isPaused = !!(changes.advanced.newValue && changes.advanced.newValue.globalPaused);
      if (wasPaused !== isPaused) {
        log(`[Debug] Pausa global ${isPaused ? "ativada" : "desativada"}`);
        showToast(
          isPaused ? t('queues_paused') : t('queues_resumed'),
          isPaused ? 'warning' : 'success',
          3000
        );
        agendarRecarga();
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
