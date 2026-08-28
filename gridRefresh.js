// Logger de debug — mude para true para habilitar logs em desenvolvimento
const DEBUG = false;
const log = (...args) => DEBUG && console.log(...args);

// ── Ponte com o Aura ──────────────────────────────────────────
// scripts/sf-nav-bridge.js roda no mundo da página e fala com o $A do
// Lightning; aqui (mundo isolado) só despachamos pedidos e esperamos a
// resposta. Resolve false quando não há $A na página ou quando a ponte nem
// existe (Chrome sem suporte a "world": "MAIN") — todo chamador precisa ter
// seu próprio plano B para esse caso.
const AURA_BRIDGE_TIMEOUT_MS = 400;
let _auraReqSeq = 0;

function pedirAoAura(action, payload) {
  return new Promise((resolve) => {
    const reqId = "insv-aura-" + ++_auraReqSeq;
    let resolvido = false;
    const finalizar = (ok) => {
      if (resolvido) return;
      resolvido = true;
      window.removeEventListener("insv:aura-result", onResultado);
      clearTimeout(timer);
      resolve(ok);
    };
    const onResultado = (event) => {
      const d = event.detail || {};
      if (d.reqId !== reqId) return;
      if (!d.ok) log(`[Debug] Ponte Aura recusou "${action}": ${d.motivo}`);
      finalizar(!!d.ok);
    };
    window.addEventListener("insv:aura-result", onResultado);
    const timer = setTimeout(() => finalizar(false), AURA_BRIDGE_TIMEOUT_MS);
    window.dispatchEvent(
      new CustomEvent("insv:aura-request", {
        detail: Object.assign({ reqId, action }, payload || {}),
      })
    );
  });
}

// ── Toast ─────────────────────────────────────────────────────
// showToast is shared from scripts/util.js (loaded as a content script
// before this file). Its injected CSS reads brand tokens on our own pages and
// falls back to literal hex here, where the Salesforce page can't see them.
// Strings are localized via t() (scripts/i18n.js, also a content script).

// ── Supervisor de modo ────────────────────────────────────────
// Três estados possíveis: "normal" (monitoramento completo), "legacy" (só
// refresh periódico) e "idle" (legacy configurado porém desligado).
// Antes cada troca de estado passava por window.location.reload(), o que
// derruba o one.app inteiro e custa dezenas de segundos pro usuário. Agora
// cada modo devolve seu próprio teardown e a troca acontece em memória.
let _modoAtual = null;
let _pararModoAtual = null;
let _ajustarIntervaloLegacy = null;

function aplicarModo(cfg) {
  const alvo = cfg.legacyMode ? (cfg.legacyActive ? "legacy" : "idle") : "normal";
  const intervalo = cfg.legacyInterval || 10;

  if (alvo === _modoAtual) {
    // Mesmo modo, só o intervalo mudou — não recria nada.
    if (alvo === "legacy" && _ajustarIntervaloLegacy) _ajustarIntervaloLegacy(intervalo);
    return;
  }

  if (_pararModoAtual) {
    log(`[Debug] Encerrando modo "${_modoAtual}"`);
    try {
      _pararModoAtual();
    } catch (e) {
      console.warn("[INSV] Falha ao encerrar o modo anterior:", e);
    }
  }
  _pararModoAtual = null;
  _ajustarIntervaloLegacy = null;
  _modoAtual = alvo;

  if (alvo === "legacy") {
    log("[Debug] LEGACY MODE ATIVADO");
    _pararModoAtual = initLegacyMode(intervalo);
  } else if (alvo === "normal") {
    _pararModoAtual = initNormalMode();
  } else {
    log("[Debug] LEGACY MODE CONFIGURADO MAS INATIVO");
  }
}

function insvStart() {
  log("[Debug] GRID REFRESH ATIVADO");

  const CHAVES_MODO = ["legacyMode", "legacyInterval", "legacyActive"];
  chrome.storage.sync.get(CHAVES_MODO, aplicarModo);

  // Listener único e permanente: é ele que decide o modo, então nenhum modo
  // precisa vigiar a própria desativação (nem se recarregar pra isso).
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;
    if (!changes.legacyMode && !changes.legacyActive && !changes.legacyInterval) return;
    chrome.storage.sync.get(CHAVES_MODO, aplicarModo);
  });
}

// Retorna true quando um refresh foi disparado por algum caminho. O caminho
// da ponte é assíncrono e não confirma nada aqui: quem chama já espera o grid
// assentar (waitForGridSettle) antes de ler a tela.
function doRefresh() {
  const refreshButton = document.querySelector('button[name="refreshButton"]');
  if (refreshButton) {
    refreshButton.click();
    return true;
  }
  // Sem botão no DOM (splitview colapsada, chamado em foco, markup novo do
  // Salesforce) o ciclo antes virava no-op silencioso: o monitor seguia
  // rodando e lendo sempre a mesma tela velha. force:refreshView recarrega os
  // dados dos componentes padrão sem depender de DOM nenhum. É caminho de
  // exceção de propósito: as docs avisam que o evento é caro e que disparo
  // repetido não é suportado.
  log("[Debug] Botão de refresh ausente — usando force:refreshView");
  pedirAoAura("refresh");
  return true;
}

// Devolve o teardown do modo. Instância única garantida pelo supervisor:
// nenhum guard local é necessário aqui.
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

  // Mudança só de intervalo não passa por teardown: o supervisor chama isto.
  _ajustarIntervaloLegacy = (interval) => {
    log(`[Debug] Intervalo do Legacy Mode alterado para ${interval} segundos`);
    startLegacyTimer(interval);
  };

  log("[Debug] Legacy Mode configurado com sucesso");

  return stopLegacyTimer;
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

  // innerText de elemento oculto (splitview colapsada com um chamado
  // aberto/focado) degrada para textContent cru: espaços internos duplicados
  // deixam de ser colapsados e o nome não bate mais com o configurado.
  // Normalizar os dois lados mantém o monitoramento vivo com chamado em foco.
  function normalizarNomeFila(s) {
    return (s || "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  // filterName é o identificador de API da list view e aparece na URL do LEX
  // (/lightning/o/Case/list?filterName=...). No console ele também viaja
  // dentro do parâmetro ws quando um chamado está em foco, por isso a busca é
  // feita sobre a URL inteira já decodificada.
  function filterNameAtual() {
    let url = "";
    try {
      url = decodeURIComponent(location.href);
    } catch (e) {
      url = location.href;
    }
    const m = /[?&]filterName=([^&#]+)/.exec(url);
    return m ? m[1] : "";
  }

  // Casar por texto de cabeçalho é frágil: o rótulo muda com o idioma do
  // usuário, com renomeação da list view e com re-render do header. O
  // filterName visto quando o nome casou fica guardado e passa a valer como
  // segunda prova de identidade — nunca como veto, só como caminho extra.
  const _filterNameConhecido = new Map();

  function isRightQueue(queueName) {
    const alvo = normalizarNomeFila(queueName);
    const title = document.querySelector(".slds-page-header__title");
    const filterName = filterNameAtual();
    if (title && normalizarNomeFila(title.innerText) === alvo) {
      if (filterName) _filterNameConhecido.set(alvo, filterName);
      return true;
    }
    const conhecido = _filterNameConhecido.get(alvo);
    return !!(conhecido && filterName && conhecido === filterName);
  }

  const CASE_TABLE_SELECTOR = '.mainContentMark .split-left table[role="grid"]';
  // Compartilhado por lerLinhasDoDom e showCaseToast — mesma extração de
  // texto (.textContent.trim()) não pode divergir entre os dois pontos.
  const CASE_LINK_SELECTOR = CASE_TABLE_SELECTOR + " tbody tr th span a";

  // ── Fontes de dados ───────────────────────────────────────
  // As duas origens devolvem o mesmo formato de linha
  // ({ caseNumber, recordId, href, status }), então o diff e os alertas não
  // precisam saber de onde veio o dado.

  // Origem tela: só enxerga o que está renderizado, o status vem como texto
  // de célula e não há id de registro (o href da grid basta para navegar).
  function lerLinhasDoDom() {
    const statusMap = getCaseStatusMap();
    const vistos = new Set();
    const linhas = [];
    document.querySelectorAll(CASE_LINK_SELECTOR).forEach((link) => {
      const caseNumber = link.textContent.trim();
      if (!caseNumber || vistos.has(caseNumber)) return;
      vistos.add(caseNumber);
      linhas.push({
        caseNumber,
        recordId: "",
        href: link.getAttribute("href") || "",
        status: statusMap[caseNumber] || "",
      });
    });
    return linhas;
  }

  // Origem org: o service worker resolve a list view e lê os registros pela
  // UI API. Nunca rejeita a promise — quem chama decide o que fazer com o
  // erro, e o ciclo cai na leitura de tela.
  function lerLinhasDaApi(queueLabel) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ type: "SF_QUEUE_RECORDS", queueLabel }, (resp) => {
          if (chrome.runtime.lastError) {
            resolve({ erro: chrome.runtime.lastError.message || "sem resposta" });
            return;
          }
          if (!resp || !resp.ok) {
            resolve({ erro: (resp && resp.erro) || "falha na API" });
            return;
          }
          resolve({
            linhas: (resp.linhas || []).map((l) => ({
              caseNumber: l.caseNumber,
              recordId: l.recordId || "",
              // Link montado a partir do id: no modo API a fila pode nem
              // estar na tela, então não há link de grid para copiar.
              href: l.recordId ? `/lightning/r/Case/${l.recordId}/view` : "",
              status: l.status || "",
            })),
          });
        });
      } catch (e) {
        resolve({ erro: (e && e.message) || "erro" });
      }
    });
  }

  function getStatusColumnIndex() {
    const table = document.querySelector(CASE_TABLE_SELECTOR);
    if (!table) return -1;
    const headers = table.querySelectorAll('thead th, thead tr th, [role="columnheader"]');
    for (let i = 0; i < headers.length; i++) {
      const text = (headers[i].textContent || "").trim().toLowerCase();
      if (text.includes("status")) return i;
    }
    return -1;
  }

  function getCaseStatusMap() {
    const table = document.querySelector(CASE_TABLE_SELECTOR);
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
  const CASE_TOAST_DURATION_MS = 15000;
  // Teto de toasts de chamado simultâneos na tela. O excedente entra numa
  // fila e aparece conforme os visíveis expiram — sem som ao aparecer, o som
  // do lote já tocou na detecção.
  const MAX_CASE_TOASTS_VISIVEIS = 5;

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

  // ── Dedupe de som entre abas ─────────────────────────────────
  // Duas abas com a mesma fila detectam o mesmo lote (com defasagem de até
  // ~1min, timers de aba em background são estrangulados) e tocariam dois
  // sons. O service worker guarda por alguns minutos o que já tocou em
  // qualquer aba e só autoriza se o lote tiver algo inédito. Sem resposta
  // do service worker, toca assim mesmo — alerta perdido é pior que dobrado.
  // Toasts NÃO passam por aqui: cada aba mostra os seus.
  function tocarSomDedupado(queueName, kind, ids, ring) {
    // Sem gesto de clique o tocarSom só mostra o aviso "clique na página" —
    // não consome o registro do dedupe, senão silenciaria a aba que pode tocar.
    if (!audioEnabled) {
      ring();
      return;
    }
    try {
      chrome.runtime.sendMessage(
        { type: "DEDUPE_RING", queue: normalizarNomeFila(queueName), kind, ids },
        (res) => {
          if (chrome.runtime.lastError || !res) {
            ring();
            return;
          }
          if (res.ring) ring();
          else log(`[Debug] Som suprimido — outra aba já tocou este lote (${kind})`);
        }
      );
    } catch (e) {
      ring();
    }
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

  // Toast com o número de um chamado (caso novo ou mudança de status,
  // conforme labelKey): número é clicável (abre o chamado, igual clicar nele
  // na grid). Fica na tela por CASE_TOAST_DURATION_MS, mas hover em QUALQUER
  // toast pausa a contagem de TODOS os visíveis — nenhum some enquanto o
  // usuário está lendo/escolhendo qual abrir.
  function ensureCaseToastStyle() {
    if (document.getElementById("insv-case-toast-style")) return;
    const s = document.createElement("style");
    s.id = "insv-case-toast-style";
    s.textContent = [
      // #insv-toast-container (util.js) is pointer-events:none so toasts
      // never block clicks on the page behind them — fine for plain-text
      // toasts, but it also blocked our link/button AND hover events here.
      // Re-enable on our own toast specifically.
      ".insv-case-toast{display:flex;align-items:center;gap:8px;pointer-events:auto}",
      ".insv-case-toast-label{opacity:0.85}",
      ".insv-case-toast-link{color:inherit;text-decoration:underline;font-weight:700;flex:1;cursor:pointer;transition:opacity var(--dur-fast,150ms) var(--ease-out,cubic-bezier(0.23,1,0.32,1))}",
      ".insv-case-toast-link:hover{opacity:0.85}",
      ".insv-case-toast-close{flex:none;background:none;border:0;color:inherit;opacity:0.7;cursor:pointer;font:inherit;font-size:15px;line-height:1;padding:2px 5px;border-radius:4px;transition:opacity var(--dur-fast,150ms) var(--ease-out,cubic-bezier(0.23,1,0.32,1)),background var(--dur-fast,150ms) var(--ease-out,cubic-bezier(0.23,1,0.32,1))}",
      ".insv-case-toast-close:hover{opacity:1;background:rgba(255,255,255,0.18)}",
      ".insv-case-toast-close:active,#insv-case-toast-clearall:active{transform:scale(0.94)}",
      // Mudança de status usa outro azul da paleta (navy ink-700) — distinto
      // do azul brand dos casos novos de relance, ainda dentro do branding.
      ".insv-toast.info.insv-case-toast--status{background:var(--ink-700,#29325A)}",
      // Pill "fechar todos" — primeiro filho do container (fica acima da
      // pilha de toasts), só existe com 2+ notificações somando fila.
      // Entra com o mesmo fade+slide dos toasts (a classe .show é adicionada no
      // frame seguinte, igual showSingleCaseToast) em vez de aparecer seco.
      "#insv-case-toast-clearall{align-self:flex-end;pointer-events:auto;background:var(--ink-800,#1B2340);color:var(--white-color,#fff);border:0;border-radius:999px;padding:5px 12px;font-family:inherit;font-size:0.75rem;font-weight:700;cursor:pointer;opacity:0;transform:translateY(10px);box-shadow:var(--box-shadow,0 8px 24px -8px rgba(0,0,0,.35));transition:opacity var(--dur-base,200ms) var(--ease-out,cubic-bezier(0.23,1,0.32,1)),transform var(--dur-base,200ms) var(--ease-out,cubic-bezier(0.23,1,0.32,1))}",
      "#insv-case-toast-clearall.show{opacity:0.92;transform:translateY(0)}",
      "#insv-case-toast-clearall.show:hover{opacity:1}",
      "@media (prefers-reduced-motion:reduce){#insv-case-toast-clearall{transition:opacity var(--dur-fast,150ms) linear;transform:none}#insv-case-toast-clearall.show{transform:none}.insv-case-toast-close:active,#insv-case-toast-clearall:active{transform:none}}",
      // Anel de foco explícito — o CSS do Salesforce reseta outline em vários
      // lugares, não dá pra confiar no default do navegador aqui.
      ".insv-case-toast-close:focus-visible,.insv-case-toast-link:focus-visible,#insv-case-toast-clearall:focus-visible{outline:2px solid #fff;outline-offset:2px}",
    ].join("");
    document.head.appendChild(s);
  }

  // "Visível de verdade": com um chamado aberto/focado o console colapsa a
  // splitview — o link da grid continua no DOM porém oculto, e um clique
  // sintético em elemento oculto é ignorado pelo Lightning. Esta checagem
  // decide entre clique sintético e navegação direta pela URL.
  function isElementVisible(el) {
    if (!el || !el.isConnected) return false;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return false;
    const cs = window.getComputedStyle(el);
    return cs.display !== "none" && cs.visibility !== "hidden";
  }

  function ensureCaseToastContainer() {
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
    return container;
  }

  // Registro dos toasts de chamado na tela + fila do excedente. O hover é
  // global: entrar em qualquer toast pausa o timer de todos; sair retoma
  // todos. Toast criado durante um hover ativo já nasce pausado.
  const _caseToastsAtivos = new Set();
  const _caseToastsPendentes = [];
  let _caseToastHovered = false;

  function pausarTodosCaseToasts() {
    _caseToastsAtivos.forEach((h) => h.pause());
  }
  function retomarTodosCaseToasts() {
    _caseToastsAtivos.forEach((h) => h.resume());
  }
  function drenarCaseToastsPendentes() {
    while (_caseToastsPendentes.length && _caseToastsAtivos.size < MAX_CASE_TOASTS_VISIVEIS) {
      const p = _caseToastsPendentes.shift();
      showSingleCaseToast(p.caseInfo, p.labelKey, p.variant, ensureCaseToastContainer());
    }
  }

  function fecharTodosCaseToasts() {
    _caseToastsPendentes.length = 0; // antes dos dismiss — remove() drena a fila
    Array.from(_caseToastsAtivos).forEach((h) => h.dismiss());
    // O clique veio do pill, que some junto — mouseleave não dispara em
    // elemento removido e o estado de hover ficaria preso em true.
    _caseToastHovered = false;
    atualizarBotaoFecharTodos();
  }

  // Pill "Fechar todos (N)" — aparece com 2+ notificações (visíveis +
  // pendentes), some abaixo disso. N conta a fila também, pra deixar claro
  // que o clique descarta o que ainda nem apareceu.
  function atualizarBotaoFecharTodos() {
    const total = _caseToastsAtivos.size + _caseToastsPendentes.length;
    let btn = document.getElementById("insv-case-toast-clearall");
    if (total < 2) {
      if (btn) btn.remove();
      return;
    }
    const container = ensureCaseToastContainer();
    if (!btn) {
      btn = document.createElement("button");
      btn.id = "insv-case-toast-clearall";
      btn.type = "button";
      btn.addEventListener("click", fecharTodosCaseToasts);
      // Hover no pill também segura os toasts na tela, igual hover num toast.
      btn.addEventListener("mouseenter", () => {
        _caseToastHovered = true;
        pausarTodosCaseToasts();
      });
      btn.addEventListener("mouseleave", () => {
        _caseToastHovered = false;
        retomarTodosCaseToasts();
      });
    }
    btn.textContent = t("close_all_toasts") + " (" + total + ")";
    if (container.firstChild !== btn) {
      container.insertBefore(btn, container.firstChild);
      // .show no frame seguinte pra transição disparar, igual aos toasts.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => { if (btn.isConnected) btn.classList.add("show"); });
      });
    }
  }

  // ── Navegação nativa (sem reload) ─────────────────────────
  // ID do registro dentro da URL do chamado: /lightning/r/Case/500.../view.
  // O objeto no meio nem sempre aparece, por isso é opcional no padrão.
  function extrairRecordId(href) {
    const m = /\/lightning\/r\/(?:[^/]+\/)?([a-zA-Z0-9]{15,18})(?:\/|$|\?)/.exec(href || "");
    return m ? m[1] : "";
  }

  // Resolve true se o one.app aceitou navegar — aí o console abre o chamado
  // como aba de trabalho, sem reload. False cai no window.location.assign de
  // quem chamou, que recarrega tudo.
  function navegarViaAura(href) {
    return pedirAoAura("navigate", { recordId: extrairRecordId(href), url: href });
  }

  // Um toast independente por chamado — cada um com seu próprio link e timer,
  // pra não ter chamado nenhum "escondido" atrás de outro dentro da mesma
  // notificação. variant "status" troca o azul (ver ensureCaseToastStyle).
  function showSingleCaseToast(caseInfo, labelKey, variant, container) {
    const toast = document.createElement("div");
    toast.className =
      "insv-toast info insv-case-toast" +
      (variant === "status" ? " insv-case-toast--status" : "");

    const label = document.createElement("span");
    label.className = "insv-case-toast-label";
    label.textContent = t(labelKey) + ":";
    toast.appendChild(label);

    const link = document.createElement("a");
    link.className = "insv-case-toast-link";
    link.href = caseInfo.href || "javascript:void(0)";
    link.textContent = caseInfo.id;
    link.addEventListener("click", (e) => {
      if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey) return; // deixa o navegador abrir em nova aba etc.
      e.preventDefault();
      // Reconsulta na hora do clique — a linha pode ter se movido/sido
      // reciclada desde que o toast apareceu. Link visível: clique sintético,
      // igual o usuário clicando na grid. Link oculto (splitview colapsada,
      // chamado aberto/focado): o clique sintético é ignorado pelo Lightning,
      // então pedimos a navegação ao próprio one.app pelo bridge Aura, que
      // abre a aba de trabalho sem recarregar o console. Só se isso falhar é
      // que a URL é carregada direto (reload da página inteira).
      const current = Array.from(document.querySelectorAll(CASE_LINK_SELECTOR))
        .find((a) => a.textContent.trim() === caseInfo.id);
      if (current && isElementVisible(current)) {
        current.click();
        return;
      }
      if (caseInfo.href) {
        navegarViaAura(caseInfo.href).then((ok) => {
          if (!ok) window.location.assign(caseInfo.href);
        });
        return;
      }
      if (current) current.click();
    });
    toast.appendChild(link);

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "insv-case-toast-close";
    closeBtn.textContent = "×";
    closeBtn.title = t("close_toast");
    closeBtn.setAttribute("aria-label", t("close_toast"));
    closeBtn.addEventListener("click", () => remove());
    toast.appendChild(closeBtn);

    container.appendChild(toast);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => toast.classList.add("show"));
    });

    let hideTimer = null;
    let remaining = CASE_TOAST_DURATION_MS;
    let startedAt = Date.now();
    let paused = false;
    let removed = false;

    const remove = () => {
      if (removed) return; // X + timer podem correr — só o primeiro vale
      removed = true;
      clearTimeout(hideTimer);
      _caseToastsAtivos.delete(handle);
      toast.classList.remove("show");
      setTimeout(() => { if (toast.parentNode) toast.remove(); }, 250);
      // Fechar via X acontece com o mouse sobre o toast, que some sob o
      // cursor — mouseleave não dispara em elemento removido e o hover
      // ficaria preso pausando tudo. Via timer o hover já era false.
      _caseToastHovered = false;
      retomarTodosCaseToasts();
      // Abriu vaga — mostra o próximo da fila (sem som: o som desse lote já
      // tocou quando ele foi detectado).
      drenarCaseToastsPendentes();
      atualizarBotaoFecharTodos();
    };
    const pause = () => {
      if (paused) return;
      paused = true;
      clearTimeout(hideTimer);
      remaining -= Date.now() - startedAt;
      if (remaining < 0) remaining = 0;
    };
    const resume = () => {
      if (!paused || removed) return;
      paused = false;
      startedAt = Date.now();
      hideTimer = setTimeout(remove, remaining);
    };
    const handle = { pause, resume, dismiss: remove };
    _caseToastsAtivos.add(handle);

    toast.addEventListener("mouseenter", () => {
      _caseToastHovered = true;
      pausarTodosCaseToasts();
    });
    toast.addEventListener("mouseleave", () => {
      _caseToastHovered = false;
      retomarTodosCaseToasts();
    });

    // Nasce pausado e só começa a contar se não houver hover ativo em outro
    // toast — quem está lendo não perde os que acabaram de chegar.
    paused = true;
    if (!_caseToastHovered) resume();
    atualizarBotaoFecharTodos();
  }

  function showCaseToast(caseIds, labelKey, variant, hrefPorId) {
    const idSet = new Set(caseIds);
    const cases = [];
    document.querySelectorAll(CASE_LINK_SELECTOR).forEach((link) => {
      const id = link.textContent.trim();
      if (idSet.has(id) && !cases.some((c) => c.id === id)) {
        cases.push({ id, href: link.getAttribute("href") || "" });
      }
    });
    // Chamado detectado pela API com a fila fora da tela não tem link na grid
    // para consultar. A grid vem primeiro de propósito: com ela na tela, o
    // clique sintético na linha é a navegação mais fiel ao que o usuário faria.
    if (hrefPorId) {
      caseIds.forEach((id) => {
        if (cases.some((c) => c.id === id)) return;
        const href = hrefPorId.get(id);
        if (href) cases.push({ id, href });
      });
    }
    if (!cases.length) return;

    ensureCaseToastStyle();
    const container = ensureCaseToastContainer();
    cases.forEach((caseInfo) => {
      if (_caseToastsAtivos.size < MAX_CASE_TOASTS_VISIVEIS) {
        showSingleCaseToast(caseInfo, labelKey, variant, container);
      } else {
        _caseToastsPendentes.push({ caseInfo, labelKey, variant });
      }
    });
    // Cobre o caminho em que tudo foi para a fila (contador do pill muda
    // mesmo sem toast novo na tela).
    atualizarBotaoFecharTodos();
  }

  // Lista, não Map por nome: duas filas com o mesmo nome sobrescreviam a
  // entrada e o monitor antigo virava órfão — timer e listener de
  // visibilitychange vivos para sempre, cada um com seu próprio seenCaseIds,
  // todos tocando som ao mesmo tempo quando a aba voltava a ficar visível.
  let filaMonitores = [];
  const statusNotificationPrevious = {};
  // Modo API (advanced.apiMode): lê as filas pela UI API em vez de raspar a
  // tabela. Fica desligado até o usuário conceder as permissões opcionais.
  let _apiModeAtivo = false;

  // ── Horário de expediente ────────────────────────────────────
  // Fora da janela os ciclos são pulados inteiros (sem refresh, sem som, sem
  // toast); ao voltar pra dentro, o próximo ciclo roda normal e notifica o
  // que mudou nesse meio-tempo. Snapshot atualizado por carregarEIniciarTodos;
  // a transição pelo relógio é avaliada a cada ciclo, sem depender de storage.
  let _workSchedule = null;
  let _foraDoExpedienteAvisado = false;

  function dentroDoExpediente() {
    return isWithinWorkSchedule(_workSchedule);
  }

  function iniciarMonitoramentoFila(fila, globalSound, globalVolume, isPaid) {
    let seenCaseIds = new Set();
    // Monitors are recreated on any settings change (volume nudge included).
    // Without this, the first cycle treats every case already on screen as new
    // and rings. The first cycle seeds the baseline silently.
    let primed = false;

    // Um aviso por monitor: se a API falhar todo ciclo, o usuário não é
    // soterrado de toast — a leitura da tela segue como rede de segurança.
    let _falhaApiAvisada = false;
    function avisarFalhaApi(erro) {
      log(`[Debug] Modo API falhou na fila "${fila.name}": ${erro}`);
      if (_falhaApiAvisada) return;
      _falhaApiAvisada = true;
      showToast(t("api_mode_error"), "warning", 5000);
    }

    const loop = () => {
      const usarApi = _apiModeAtivo;
      const filaNaTela = isRightQueue(fila.name);

      // Sem modo API a extensão só sabe o que está renderizado, então fila
      // fora da tela é ciclo perdido. Com modo API o dado vem do org e o
      // monitoramento continua com o usuário em qualquer página.
      if (!usarApi && !filaNaTela) {
        log(`[Debug] Retornando, fila incorreta: ${fila.name}`);
        return;
      }

      if (!dentroDoExpediente()) {
        if (!_foraDoExpedienteAvisado) {
          _foraDoExpedienteAvisado = true;
          showToast(t("ws_paused_toast"), "warning", 4000);
          reportExtensionActive(); // ícone âmbar
        }
        log(`[Debug] Fora do expediente — ciclo ignorado: "${fila.name}"`);
        return;
      }
      if (_foraDoExpedienteAvisado) {
        _foraDoExpedienteAvisado = false;
        showToast(t("ws_resumed_toast"), "success", 3000);
        reportExtensionActive();
      }

      if (!_initToastShown.has(fila.name)) {
        _initToastShown.add(fila.name);
        showToast(t('monitoring_active', { name: fila.name }), 'info', 4000);
      }

      const userIsEditing = document.querySelector(".mainContentMark .split-left .slds-checkbox [type=checkbox]:checked");

      // O refresh da grid continua mesmo no modo API: é ele que faz o chamado
      // novo aparecer na tela do usuário. O que mudou é que ele deixou de ser
      // a fonte da detecção.
      if (!primed) {
        // Primeira leitura: captura o que já está na fila do jeito que está,
        // sem clicar em refresh. `primed` garante que essa baseline é
        // silenciosa — sem som e sem toast.
        log(`[Debug] Primeira leitura da fila "${fila.name}" — baseline sem refresh`);
      } else if (!filaNaTela) {
        log(`[Debug] Fila fora da tela, sem refresh de grid: "${fila.name}"`);
      } else if (!userIsEditing) {
        log(`[Debug] Executando refresh da fila: "${fila.name}"`);
        doRefresh();
      } else {
        log("[Debug] Ignorou refresh - usuário está com chamado selecionado");
      }

      // Fecha o ciclo com as linhas lidas (null = leitura inutilizável).
      // Recebe sempre o mesmo formato, venha do DOM ou da API.
      function concluirCiclo(linhas) {
        cicloEmAndamento = false;
        // O ciclo é assíncrono. Se o monitor foi cancelado nesse meio-tempo —
        // qualquer gravação em storage recria todos os monitores — este
        // callback ainda estava agendado e tocaria som com o seenCaseIds
        // antigo, somando ao som do monitor novo.
        if (cancelled) {
          log(`[Debug] Ciclo descartado, monitor cancelado: "${fila.name}"`);
          return;
        }

        // Sem leitura confiável não há baseline: primar com lista vazia faria
        // o ciclo seguinte tocar som para a fila inteira.
        if (!linhas || (!usarApi && !document.querySelector(CASE_TABLE_SELECTOR))) {
          log(`[Debug] Sem leitura utilizável, ciclo ignorado: "${fila.name}"`);
          if (!primed && fastRetriesLeft > 0) {
            fastRetriesLeft--;
            schedule(FAST_RETRY_MS);
          }
          return;
        }

        // Alertar exige ou a fila na tela (leitura de DOM) ou dado do org
        // (modo API), nunca uma leitura de tela de outra fila.
        const podeAlertar = usarApi || isRightQueue(fila.name);
        const hrefPorId = new Map();
        linhas.forEach((l) => { if (l.href) hrefPorId.set(l.caseNumber, l.href); });

        const novos = linhas
          .map((l) => l.caseNumber)
          .filter((id) => !seenCaseIds.has(id));

        if (primed && novos.length > 0 && fila.soundEnabled && podeAlertar) {
          log(`[Debug] Novos casos na fila "${fila.name}": "${novos}"`);
          showCaseToast(novos, "new_case_toast_label", undefined, hrefPorId);
          const soundToUse = fila.customSound || globalSound;
          log(`[Debug] Som para fila "${fila.name}": ${soundToUse}`);
          tocarSomDedupado(fila.name, "new", novos, () => tocarSom(soundToUse, globalVolume));
        }

        novos.forEach((id) => seenCaseIds.add(id));
        primed = true;

        // Notificação de mudança de status — config por fila
        // (queues[].statusNotify), recurso premium
        const sn = fila.statusNotify;
        const temStatus = linhas.some((l) => l.status);
        if (isPaid && sn && sn.enabled && (sn.statuses || []).length > 0 && podeAlertar && temStatus) {
          const currentMap = {};
          linhas.forEach((l) => { currentMap[l.caseNumber] = l.status || ""; });
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
          const statusChangedIds = [];
          const statusDedupeKeys = [];
          for (const [caseId, status] of Object.entries(currentMap)) {
            const statusLower = status.toLowerCase();
            const prev = filaMap[caseId];
            if (!isFirstStatusCheck && targetStatuses.has(statusLower) && prev !== status) {
              statusChangedIds.push(caseId);
              // Chave inclui o status: o mesmo chamado mudando para OUTRO
              // status alvo ainda conta como evento inédito no dedupe.
              statusDedupeKeys.push(caseId + "::" + statusLower);
            }
            filaMap[caseId] = status;
          }
          // Som toca só 1x por ciclo (evita empilhar alertas), mas o toast
          // não tem esse limite — lista todo chamado cujo status mudou pro
          // alvo monitorado, não só o que disparou o som.
          if (statusChangedIds.length > 0) {
            showCaseToast(statusChangedIds, "status_updated_toast_label", "status", hrefPorId);
            tocarSomDedupado(fila.name, "status", statusDedupeKeys, () =>
              tocarSom(sn.sound || "notification.mp3", globalVolume)
            );
          }
          // Evict cases that have left the queue so the map stays bounded.
          for (const id of Object.keys(filaMap)) {
            if (!(id in currentMap)) delete filaMap[id];
          }
        }
      }

      cicloEmAndamento = true;

      if (usarApi) {
        lerLinhasDaApi(fila.name).then((r) => {
          if (!r.erro) {
            concluirCiclo(r.linhas);
            return;
          }
          // Sessão expirada, fila sem list view correspondente, org fora do
          // ar: o ciclo não é perdido, cai na leitura de tela quando ela
          // existe.
          avisarFalhaApi(r.erro);
          if (filaNaTela) waitForGridSettle(() => concluirCiclo(lerLinhasDoDom()));
          else concluirCiclo(null);
        });
      } else {
        waitForGridSettle(() => concluirCiclo(lerLinhasDoDom()));
      }
    };
    // Agendamento por timestamp em vez de setInterval: navegadores
    // limitam timers em abas em background, então ao voltar a aba
    // visível comparamos com lastRefreshAt para respeitar o intervalo
    // configurado — no máximo 1 refresh imediato, nunca em rajada.
    const intervalMs = (fila.interval || 15) * 1000;
    // Antes da baseline, ritmo curto e limitado: se a página/fila ainda está
    // carregando (título ou tabela ausentes), tenta de novo logo em vez de
    // esperar o intervalo cheio só pra ler o que já está na tela.
    const FAST_RETRY_MS = 2000;
    let fastRetriesLeft = 15;
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
      // loop() bailou síncrono (fila errada na tela) e ainda não há baseline
      // → retry curto. Ciclo em voo ou já primado → cadência normal.
      if (!primed && !cicloEmAndamento && fastRetriesLeft > 0) {
        fastRetriesLeft--;
        schedule(FAST_RETRY_MS);
      } else {
        schedule(intervalMs);
      }
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
    // Primeiro ciclo imediato — a baseline não espera o intervalo (nem faz
    // refresh, ver loop()). Monitores também são recriados a cada mudança de
    // configuração, então isso vale pro load E pra qualquer ajuste na UI.
    schedule(0);

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
          // Expediente: monitores continuam de pé fora da janela (o pulo é
          // por ciclo, pra transição do relógio funcionar sem evento novo).
          _workSchedule = (data.advanced && data.advanced.workSchedule) || null;
          _apiModeAtivo = !!(data.advanced && data.advanced.apiMode);
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
      const adv = data.advanced || {};
      // Fora do expediente conta como pausado para o ícone, igual à pausa
      // global — o monitoramento existe mas está deliberadamente suspenso.
      const suspenso = !!adv.globalPaused || !isWithinWorkSchedule(adv.workSchedule);
      const active = audioEnabled && queues.length > 0 && !suspenso;
      // Só conta como "pausado" (ícone âmbar) se havia algo de fato pausado —
      // suspensão com nenhuma fila ativa não é diferente de estar inativo.
      const paused = suspenso && queues.length > 0;
      chrome.runtime.sendMessage({ type: "INSV_EXTENSION_ACTIVE", active, paused }).catch(() => {});
    });
  }

  // Contêineres de ação do Lightning, do mais específico pro mais amplo. A
  // busca começa neles porque varrer a página inteira significa clicar em
  // QUALQUER botão cujo rótulo case com "aceitar|accept|take|..." — inclusive
  // em telas que não são a fila, onde o atalho vira um clique às cegas numa
  // ação de massa. Só descemos pro escopo amplo (ainda dentro da área de
  // conteúdo do console) se nenhuma barra de ações tiver o botão.
  const ACCEPT_SCOPES = [
    ".mainContentMark .slds-page-header",
    ".mainContentMark .forceActionsContainer",
    ".mainContentMark .slds-button-group",
    '.mainContentMark [role="toolbar"]',
    ".mainContentMark",
  ];
  const ACCEPT_TEXT_RE = /aceitar|accept|assumir|assume|take|tomar/i;

  function isAcceptButton(btn) {
    const text = (btn.textContent || "").trim();
    const ariaLabel = btn.getAttribute("aria-label") || "";
    const title = btn.getAttribute("title") || "";
    if (!ACCEPT_TEXT_RE.test(text + " " + ariaLabel + " " + title)) return false;
    return !btn.disabled && btn.offsetParent !== null;
  }

  function clickAcceptButton() {
    for (const scope of ACCEPT_SCOPES) {
      for (const container of document.querySelectorAll(scope)) {
        for (const btn of container.querySelectorAll("button")) {
          if (!isAcceptButton(btn)) continue;
          btn.click();
          log(`[Debug] Botão Aceitar clicado via atalho (escopo: ${scope})`);
          showToast(t('case_accepted'), 'success', 2500);
          return true;
        }
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

  const onMensagem = (msg, sender, sendResponse) => {
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
  };
  chrome.runtime.onMessage.addListener(onMensagem);

  carregarEIniciarTodos();
  reportExtensionActive();

  const onStorageLocal = (changes, area) => {
    if (area === "local" && (changes.queues || changes.general || changes.audiosPersonalizados)) {
      log("[Debug] Alterações detectadas no storage. Reiniciando monitoramento...");
      agendarRecarga();
    }
    if (area === "local" && changes.advanced) {
      setupAcceptShortcut();
      setupPauseShortcut();
      // Expediente editado nas opções → recarrega o snapshot dos monitores.
      const wsOld = JSON.stringify((changes.advanced.oldValue || {}).workSchedule || null);
      const wsNew = JSON.stringify((changes.advanced.newValue || {}).workSchedule || null);
      if (wsOld !== wsNew) agendarRecarga();
      const apiAntes = !!(changes.advanced.oldValue && changes.advanced.oldValue.apiMode);
      const apiDepois = !!(changes.advanced.newValue && changes.advanced.newValue.apiMode);
      if (apiAntes !== apiDepois) {
        log(`[Debug] Modo API ${apiDepois ? "ativado" : "desativado"}`);
        agendarRecarga();
      }
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
    // Ligar/desligar o Legacy Mode é assunto do supervisor (aplicarModo): ele
    // dá o teardown neste modo e sobe o outro, sem recarregar a página.
  };
  chrome.storage.onChanged.addListener(onStorageLocal);

  // Teardown do modo normal: tudo que foi registrado aqui sai junto. Sem isso
  // uma troca para o Legacy Mode deixaria monitores, listeners e atalhos vivos
  // em paralelo — foi por isso que a versão antiga recarregava a página.
  return function pararModoNormal() {
    chrome.storage.onChanged.removeListener(onStorageLocal);
    chrome.runtime.onMessage.removeListener(onMensagem);
    clearTimeout(_recargaTimer);
    pararMonitoramentosAtuais();
    if (window._insvAcceptShortcutHandler) {
      document.removeEventListener("keydown", window._insvAcceptShortcutHandler);
      window._insvAcceptShortcutHandler = null;
    }
    if (window._insvPauseShortcutHandler) {
      document.removeEventListener("keydown", window._insvPauseShortcutHandler);
      window._insvPauseShortcutHandler = null;
    }
    // Atalhos e monitores param, mas os toasts na tela continuam: eles somem
    // sozinhos e sumir na hora seria perda de informação pro usuário.
  };
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
