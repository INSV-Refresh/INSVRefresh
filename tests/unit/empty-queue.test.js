"use strict";

/**
 * gridRefresh.js — iniciarMonitoramentoFila com a fila vazia.
 *
 * Bug: com zero casos o Salesforce mostra o estado vazio e não renderiza a
 * tabela. Sem tabela o ciclo nunca virava baseline, `primed` ficava false
 * para sempre e o refresh, que só rodava depois da baseline, nunca disparava.
 *
 * O monitor roda aqui contra um relógio falso e um DOM mínimo: a fila na tela,
 * o botão de refresh e a tabela (ou a falta dela) são estado do teste.
 */

const { read, extractFunction, check, ok, section } = require("../lib/harness");

const SRC = read("gridRefresh.js");
const FN = extractFunction(SRC, "iniciarMonitoramentoFila");

const SETTLE_MS = 700; // GRID_SETTLE_INITIAL_GRACE_MS: leitura após o grid assentar

/**
 * Monta um monitor isolado.
 * cenario.rows: null = sem tabela (estado vazio); array = números dos casos.
 * cenario.onRefresh(env): opcional, muda o estado quando o refresh é clicado.
 */
function criarMonitor(cenario) {
  const env = {
    now: 0,
    timers: [],
    seq: 0,
    rows: cenario.rows,
    onScreen: cenario.onScreen !== false,
    refreshButton: cenario.refreshButton !== false,
    refreshes: [],
    sounds: [],
    toasts: [],
  };

  const setTimeoutFake = (fn, ms) => {
    const id = ++env.seq;
    env.timers.push({ id, at: env.now + (ms || 0), fn });
    return id;
  };
  const clearTimeoutFake = (id) => {
    env.timers = env.timers.filter((t) => t.id !== id);
  };

  const document = {
    visibilityState: "visible",
    addEventListener() {},
    removeEventListener() {},
    querySelector(sel) {
      if (sel === CASE_TABLE_SELECTOR) return env.rows ? {} : null;
      if (sel === 'button[name="refreshButton"]') return env.refreshButton ? {} : null;
      return null; // checkbox marcado (usuário editando): nunca
    },
  };

  const CASE_TABLE_SELECTOR = '.mainContentMark .split-left table[role="grid"]';

  const deps = {
    document,
    setTimeout: setTimeoutFake,
    clearTimeout: clearTimeoutFake,
    Date: { now: () => env.now },
    CASE_TABLE_SELECTOR,
    STREAM_PULSE_FLOOR_MS: 3000,
    statusNotificationPrevious: {},
    filaMonitores: [],
    _initToastShown: new Set(),
    _apiModeAtivo: false,
    log() {},
    t: (k) => k,
    showToast() {},
    reportExtensionActive() {},
    dentroDoExpediente: () => true,
    isRightQueue: () => env.onScreen,
    lerLinhasDoDom: () =>
      (env.rows || []).map((n) => ({ caseNumber: n, recordId: "", href: "", status: "" })),
    lerLinhasDaApi: () => Promise.resolve({ erro: "off" }),
    waitForGridSettle: (cb) => setTimeoutFake(cb, SETTLE_MS),
    doRefresh: () => {
      env.refreshes.push(env.now);
      if (cenario.onRefresh) cenario.onRefresh(env);
      return true;
    },
    showCaseToast: (ids) => env.toasts.push(ids.slice()),
    tocarSomDedupado: (_fila, _tipo, keys, play) => {
      env.sounds.push(keys.slice());
      play();
    },
    tocarSom() {},
  };

  const nomes = Object.keys(deps);
  const iniciar = new Function(
    ...nomes,
    "let _foraDoExpedienteAvisado = false;\n" + FN + "\nreturn iniciarMonitoramentoFila;"
  )(...nomes.map((n) => deps[n]));

  iniciar({ name: "A - LINX DIGITAL - N1 Commerce", interval: 15, soundEnabled: true }, "bubble.mp3", 50);

  env.advance = (ms) => {
    const fim = env.now + ms;
    for (;;) {
      env.timers.sort((a, b) => a.at - b.at || a.id - b.id);
      const prox = env.timers[0];
      if (!prox || prox.at > fim) break;
      env.timers.shift();
      env.now = prox.at;
      prox.fn();
    }
    env.now = fim;
  };
  env.stop = () => deps.filaMonitores.forEach((m) => m.cancel());
  return env;
}

module.exports = function () {
  section("fila vazia: o refresh não trava sem tabela");
  {
    const env = criarMonitor({ rows: null });
    env.advance(14 * 1000);
    check("nenhum refresh antes do primeiro intervalo (sem rajada de cliques)", env.refreshes.length, 0);
    env.advance(46 * 1000);
    ok(
      "fila vazia na tela dispara refresh a cada intervalo",
      env.refreshes.length >= 3,
      "refreshes em 60s: " + env.refreshes.length
    );
    const gaps = env.refreshes.slice(1).map((t, i) => t - env.refreshes[i]);
    ok(
      "refreshes respeitam o intervalo de 15s",
      gaps.every((g) => g >= 15 * 1000),
      "intervalos: " + JSON.stringify(gaps)
    );
    check("fila vazia não toca som", env.sounds.length, 0);
    env.stop();
  }

  section("fila vazia: o primeiro caso que entra toca som");
  {
    const env = criarMonitor({ rows: null });
    env.advance(60 * 1000);
    env.rows = ["00123456"];
    env.advance(20 * 1000);
    check("som para o caso novo", env.sounds, [["00123456"]]);
    check("aviso para o caso novo", env.toasts, [["00123456"]]);
    env.advance(60 * 1000);
    check("mesmo caso não toca de novo", env.sounds.length, 1);
    env.stop();
  }

  section("fila carregando: tabela atrasada não gera alerta falso");
  {
    // Tabela aparece sozinha antes do primeiro refresh.
    const env = criarMonitor({ rows: null });
    env.advance(5 * 1000);
    env.rows = ["001", "002", "003"];
    env.advance(60 * 1000);
    check("casos já existentes viram baseline em silêncio", env.sounds.length, 0);
    env.stop();
  }
  {
    // Tabela só aparece depois do primeiro refresh: uma leitura vazia não basta
    // para assumir fila vazia.
    const env = criarMonitor({
      rows: null,
      onRefresh: (e) => {
        if (e.refreshes.length === 2) e.rows = ["001", "002", "003"];
      },
    });
    env.advance(90 * 1000);
    check("uma única leitura vazia após refresh não vira baseline", env.sounds.length, 0);
    env.stop();
  }

  section("fila com casos: comportamento anterior mantido");
  {
    const env = criarMonitor({ rows: ["001", "002"] });
    env.advance(14 * 1000);
    check("primeira leitura sem refresh", env.refreshes.length, 0);
    check("baseline silenciosa", env.sounds.length, 0);
    env.advance(16 * 1000);
    ok("refresh após a baseline", env.refreshes.length >= 1);
    env.rows = ["001", "002", "003"];
    env.advance(16 * 1000);
    check("som só para o caso novo", env.sounds, [["003"]]);
    env.stop();
  }

  section("fila fora da tela: sem refresh e sem baseline vazia");
  {
    const env = criarMonitor({ rows: null, onScreen: false });
    env.advance(60 * 1000);
    check("nenhum refresh com a fila fora da tela", env.refreshes.length, 0);
    env.onScreen = true;
    env.rows = ["001"];
    env.advance(20 * 1000);
    check("casos ao voltar para a fila viram baseline em silêncio", env.sounds.length, 0);
    env.stop();
  }
};
