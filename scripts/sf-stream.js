// Streaming (Change Data Capture) como gatilho de verificação.
//
// O que este cliente NÃO faz: tratar o evento como a notificação em si. Um
// evento de CDC traz os campos que mudaram no chamado, não a informação de
// que ele entrou na list view que o usuário monitora (a list view pode
// filtrar por fila, status, prioridade, o que for). Replicar esse filtro aqui
// seria adivinhação.
//
// O que ele faz: quando qualquer Case muda no org, acorda os monitores para
// uma leitura imediata pela API. O intervalo configurado continua valendo como
// rede de segurança; o streaming só encurta a espera entre o fato e o alerta.
//
// Depende de scripts/sf-session.js (mesmo escopo de service worker).
// Requer Change Data Capture habilitado para Case no Setup do org. Sem isso a
// assinatura falha, o erro fica registrado para a tela de opções e o
// monitoramento segue no ritmo do polling.

const SF_STREAM_CANAL = "/data/CaseChangeEvent";
const SF_STREAM_ALARME = "insv-stream-keepalive";
const SF_STREAM_DEBOUNCE_MS = 1500;
// Tentativas de reconexão antes de desistir e deixar só o polling.
const SF_STREAM_MAX_FALHAS = 5;

const _sfStream = {
  geracao: 0, // invalida loops de gerações anteriores
  apiHost: "",
  clientId: "",
  replayId: -1, // -1 = só eventos novos
  conectado: false,
  // rodando cobre a janela entre o start e o primeiro connect bem-sucedido
  // (handshake, subscribe, espera de backoff). Sem ele o alarme de 1 minuto
  // dispararia um segundo loop por cima de um start ainda em andamento.
  rodando: false,
  // desistiu = estourou o limite de falhas. Só uma mudança de configuração
  // faz tentar de novo; o alarme sozinho não fica reinsistindo para sempre.
  desistiu: false,
  erro: "",
  falhas: 0,
  avisoTimer: null,
};

function sfStreamEstado() {
  return {
    conectado: _sfStream.conectado,
    apiHost: _sfStream.apiHost,
    erro: _sfStream.erro,
  };
}

// ── Transporte Bayeux ─────────────────────────────────────────
// Todas as mensagens (handshake, subscribe, connect) vão para o mesmo
// endpoint por POST. credentials:"include" aqui é intencional e diferente do
// resto: o CometD do Salesforce emite o cookie BAYEUX_BROWSER no handshake e
// recusa os connects seguintes sem ele. É o mesmo host do org.
async function sfBayeux(apiHost, versao, mensagens) {
  const token = await sfLerToken(apiHost);
  const resp = await fetch(`https://${apiHost}/cometd/${versao}/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(mensagens),
    credentials: "include",
  });
  if (resp.status === 401 || resp.status === 403) throw new Error("sessão expirada ou sem acesso");
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const dados = await resp.json();
  return Array.isArray(dados) ? dados : [dados];
}

function sfRespostaDoCanal(mensagens, canal) {
  return mensagens.find((m) => m && m.channel === canal);
}

// ── Ciclo de vida ─────────────────────────────────────────────

async function sfStreamHandshake(apiHost, versao) {
  const resp = await sfBayeux(apiHost, versao, [
    {
      channel: "/meta/handshake",
      version: "1.0",
      supportedConnectionTypes: ["long-polling"],
      // Liga a extensão de replay: sem ela o servidor ignora o replayId da
      // assinatura e uma reconexão perde os eventos do intervalo.
      ext: { replay: true },
      id: "1",
    },
  ]);
  const hs = sfRespostaDoCanal(resp, "/meta/handshake");
  if (!hs || !hs.successful || !hs.clientId) {
    throw new Error((hs && hs.error) || "handshake recusado");
  }
  return hs.clientId;
}

async function sfStreamSubscribe(apiHost, versao, clientId, replayId) {
  const resp = await sfBayeux(apiHost, versao, [
    {
      channel: "/meta/subscribe",
      clientId,
      subscription: SF_STREAM_CANAL,
      ext: { replay: { [SF_STREAM_CANAL]: replayId } },
      id: "2",
    },
  ]);
  const sub = sfRespostaDoCanal(resp, "/meta/subscribe");
  if (!sub || !sub.successful) {
    // Erro típico aqui: CDC não habilitado para Case no Setup do org.
    throw new Error((sub && sub.error) || "assinatura recusada");
  }
}

// Um evento por chamado alterado vira uma verificação só: uma atualização em
// massa no org não pode virar uma rajada de leituras de API.
function sfStreamAvisarAbas() {
  if (_sfStream.avisoTimer) return;
  _sfStream.avisoTimer = setTimeout(async () => {
    _sfStream.avisoTimer = null;
    try {
      const abas = await chrome.tabs.query({ url: "*://*.lightning.force.com/*" });
      for (const aba of abas) {
        chrome.tabs.sendMessage(aba.id, { type: "SF_STREAM_TICK" }).catch(() => {});
      }
    } catch (e) {
      console.warn("[INSV] Falha ao avisar as abas:", limparErro(e));
    }
  }, SF_STREAM_DEBOUNCE_MS);
}

function sfStreamProcessarEventos(mensagens) {
  let houveEvento = false;
  for (const m of mensagens) {
    if (!m || m.channel !== SF_STREAM_CANAL) continue;
    houveEvento = true;
    const replay = m.data && m.data.event && m.data.event.replayId;
    if (typeof replay === "number") _sfStream.replayId = replay;
  }
  if (houveEvento) {
    // Guardado em storage.session (memória, não vai para disco): se o service
    // worker for encerrado, a reconexão retoma de onde parou.
    chrome.storage.session.set({ sfStreamReplayId: _sfStream.replayId }).catch(() => {});
    sfStreamAvisarAbas();
  }
}

async function sfStreamLoop(apiHost, versao, geracao) {
  let n = 3;
  while (_sfStream.geracao === geracao) {
    const resp = await sfBayeux(apiHost, versao, [
      {
        channel: "/meta/connect",
        clientId: _sfStream.clientId,
        connectionType: "long-polling",
        id: String(n++),
      },
    ]);
    if (_sfStream.geracao !== geracao) return;

    sfStreamProcessarEventos(resp);

    const conn = sfRespostaDoCanal(resp, "/meta/connect");
    if (!conn || !conn.successful) {
      const erro = (conn && conn.error) || "conexão recusada";
      // 402::Unknown client = o servidor esqueceu o clientId (expiração,
      // service worker reciclado, cookie perdido). Refazer o handshake é a
      // recuperação prevista pelo protocolo, não um caso de erro.
      throw new Error(erro);
    }
    _sfStream.falhas = 0;
    _sfStream.conectado = true;
    _sfStream.erro = "";
  }
}

async function sfStreamIniciar(apiHost) {
  const geracao = ++_sfStream.geracao;
  _sfStream.apiHost = apiHost;
  _sfStream.conectado = false;
  _sfStream.rodando = true;

  try {
    await sfStreamCiclo(apiHost, geracao);
  } finally {
    // Só limpa se ninguém tomou o lugar: uma geração mais nova já é dona da
    // flag e não pode ser desligada pela saída da geração antiga.
    if (_sfStream.geracao === geracao) _sfStream.rodando = false;
  }
}

async function sfStreamCiclo(apiHost, geracao) {
  const guardado = await chrome.storage.session.get("sfStreamReplayId").catch(() => ({}));
  if (typeof (guardado && guardado.sfStreamReplayId) === "number") {
    _sfStream.replayId = guardado.sfStreamReplayId;
  }

  while (_sfStream.geracao === geracao && _sfStream.falhas < SF_STREAM_MAX_FALHAS) {
    try {
      const versao = await sfVersaoApi(apiHost);
      _sfStream.clientId = await sfStreamHandshake(apiHost, versao);
      await sfStreamSubscribe(apiHost, versao, _sfStream.clientId, _sfStream.replayId);
      _sfStream.conectado = true;
      _sfStream.erro = "";
      console.log("[INSV] Streaming de Case conectado");
      await sfStreamLoop(apiHost, versao, geracao);
    } catch (e) {
      if (_sfStream.geracao !== geracao) return;
      _sfStream.falhas++;
      _sfStream.conectado = false;
      _sfStream.erro = limparErro(e);
      console.warn(`[INSV] Streaming falhou (${_sfStream.falhas}/${SF_STREAM_MAX_FALHAS}):`, _sfStream.erro);
      // Backoff: 2s, 4s, 8s, 16s, 32s. O polling continua rodando o tempo
      // todo, então esperar aqui não deixa o usuário sem monitoramento.
      const espera = Math.min(2000 * Math.pow(2, _sfStream.falhas - 1), 32000);
      await new Promise((r) => setTimeout(r, espera));
    }
  }

  if (_sfStream.geracao === geracao && _sfStream.falhas >= SF_STREAM_MAX_FALHAS) {
    _sfStream.conectado = false;
    _sfStream.desistiu = true;
    console.warn("[INSV] Streaming desistiu; seguindo só com polling");
  }
}

function sfStreamParar(motivo) {
  _sfStream.geracao++; // invalida o loop em voo
  _sfStream.conectado = false;
  _sfStream.rodando = false;
  _sfStream.clientId = "";
  _sfStream.falhas = 0;
  // Parada completa zera a desistência: quando o streaming voltar a fazer
  // sentido (aba do org reaberta, config religada) ele tenta de novo.
  _sfStream.desistiu = false;
  _sfStream.erro = motivo || "";
}

// Reconciliação: chamada na subida do service worker, em mudança de config e
// no alarme. Decide sozinha se o streaming deve estar de pé.
// forcar = veio de mudança de configuração, então volta a tentar mesmo se
// tinha desistido. Chamadas do alarme não forçam.
async function sfStreamReconciliar(forcar) {
  if (forcar) {
    _sfStream.desistiu = false;
    _sfStream.falhas = 0;
  }
  // Recurso do plano Empresa. Desligado, nem lê a configuração: um flag
  // gravado à mão em storage não pode virar assinatura de CometD, que consome
  // cliente concorrente do org.
  if (!ENTERPRISE_FEATURES.stream) {
    sfStreamParar("");
    return;
  }

  let ligado = false;
  try {
    const dados = await chrome.storage.local.get("advanced");
    const adv = (dados && dados.advanced) || {};
    // Streaming só faz sentido junto do modo API: é ele que sabe ler a fila
    // quando o evento chega.
    ligado = !!(adv.apiMode && adv.streamMode);
  } catch (e) {
    ligado = false;
  }

  if (!ligado || !(await sfTemPermissoes())) {
    sfStreamParar("");
    return;
  }

  const apiHost = await sfDescobrirApiHost("");
  if (!apiHost) {
    // Nenhuma aba do Salesforce aberta: não há para quem avisar.
    sfStreamParar("");
    return;
  }

  const mesmoOrg = _sfStream.apiHost === apiHost;
  if (mesmoOrg && (_sfStream.rodando || _sfStream.desistiu)) return;
  if (_sfStream.apiHost && !mesmoOrg) sfStreamParar("");
  _sfStream.falhas = 0;
  // Sem await de propósito: o loop de long-poll vive enquanto o streaming
  // estiver ligado. O catch existe porque uma falha fora do laço interno
  // (storage.session indisponível, por exemplo) viraria rejeição solta.
  sfStreamIniciar(apiHost).catch((e) => {
    _sfStream.conectado = false;
    _sfStream.erro = limparErro(e);
    console.warn("[INSV] Streaming não iniciou:", _sfStream.erro);
  });
}

// O service worker do MV3 é encerrado por inatividade e o long-poll morre
// junto. O alarme traz ele de volta e a reconciliação reconecta a partir do
// último replayId.
//
// Com o recurso desligado o alarme não é criado: ele acordaria o service
// worker a cada minuto, para sempre, só para reconciliar um streaming que
// nunca vai subir. Um alarme de instalação anterior é apagado no mesmo passo.
if (ENTERPRISE_FEATURES.stream) {
  chrome.alarms.create(SF_STREAM_ALARME, { periodInMinutes: 1 });
  chrome.alarms.onAlarm.addListener((alarme) => {
    if (alarme.name === SF_STREAM_ALARME) sfStreamReconciliar();
  });
} else {
  chrome.alarms.clear(SF_STREAM_ALARME).catch(() => {});
}
