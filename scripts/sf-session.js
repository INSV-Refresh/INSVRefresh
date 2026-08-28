// Sessão do Salesforce para chamadas de API a partir do service worker.
//
// SEGURANÇA — leia antes de mexer:
// O token lido aqui é o session id do usuário: quem o tem age como o usuário
// no org inteiro. Regras que este arquivo mantém e que devem continuar
// valendo em qualquer alteração:
//   1. o token nunca é gravado (nem em storage, nem em variável de módulo);
//      é lido do cookie jar a cada requisição e vive só na chamada;
//   2. o token nunca é logado, nem inteiro nem em pedaço, nem dentro de
//      mensagem de erro (ver limparErro);
//   3. o token só sai em requisição para o host de API do próprio org, e só
//      para caminhos /services/data/ (ver assertCaminhoDeApi);
//   4. nada disso funciona sem o usuário conceder as permissões opcionais
//      (cookies + host do org) explicitamente nas opções.

const SF_API_PERMISSIONS = {
  permissions: ["cookies"],
  origins: ["https://*.my.salesforce.com/*"],
};

// Versão usada se a negociação com o org falhar. Conservadora de propósito:
// list-records por nome de API existe bem antes disso.
const SF_API_VERSION_FALLBACK = "60.0";

// Host do LEX -> host de API do mesmo org. Vale para domínio aprimorado e
// para sandbox (foo--sb.sandbox.lightning.force.com -> ...sandbox.my...).
function sfApiHostFromLightningHost(host) {
  const h = String(host || "").toLowerCase();
  const sufixo = ".lightning.force.com";
  if (!h.endsWith(sufixo)) return "";
  return h.slice(0, -sufixo.length) + ".my.salesforce.com";
}

function sfApiHostFromUrl(url) {
  try {
    return sfApiHostFromLightningHost(new URL(url).hostname);
  } catch (e) {
    return "";
  }
}

// Só aceitamos hosts de API do Salesforce. Blindagem contra um host vindo de
// lugar inesperado virar destino de uma requisição com o session id junto.
function isSalesforceApiHost(apiHost) {
  return /^[a-z0-9-]+(\.[a-z0-9-]+)*\.my\.salesforce\.com$/.test(String(apiHost || ""));
}

function assertCaminhoDeApi(path) {
  if (typeof path !== "string" || !path.startsWith("/services/data/")) {
    throw new Error("caminho de API inválido");
  }
}

// Mensagem de erro higienizada: nada que venha de resposta do Salesforce (ou
// de exceção de rede) entra em log sem passar por aqui.
function limparErro(e) {
  const msg = (e && e.message) || String(e || "erro");
  return msg
    // Formato do session id: orgId!token. O "!" quebraria uma classe de
    // caracteres comum em dois pedaços curtos, então ele vem primeiro.
    .replace(/00D[A-Za-z0-9]{12,15}![^\s"']+/g, "[redigido]")
    // Rede: qualquer sequência longa o bastante para ser segredo.
    .replace(/[A-Za-z0-9!._-]{30,}/g, "[redigido]")
    .slice(0, 200);
}

async function sfTemPermissoes() {
  try {
    return await chrome.permissions.contains(SF_API_PERMISSIONS);
  } catch (e) {
    return false;
  }
}

// Session id do org, direto do cookie jar. O cookie sid do domínio lightning
// NÃO serve para a API REST; o que vale é o do host my.salesforce.com.
async function sfLerToken(apiHost) {
  if (!isSalesforceApiHost(apiHost)) throw new Error("host de API inválido");
  const cookie = await chrome.cookies.get({ url: `https://${apiHost}/`, name: "sid" });
  if (!cookie || !cookie.value) throw new Error("sem sessão ativa neste org");
  return cookie.value;
}

const _sfVersaoPorHost = new Map();

// Versão da API negociada com o próprio org, não fixada no código: org em
// release antiga não engasga e org novo não fica preso numa versão velha.
async function sfVersaoApi(apiHost) {
  if (_sfVersaoPorHost.has(apiHost)) return _sfVersaoPorHost.get(apiHost);
  let versao = SF_API_VERSION_FALLBACK;
  try {
    const token = await sfLerToken(apiHost);
    const resp = await fetch(`https://${apiHost}/services/data/`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      credentials: "omit",
    });
    if (resp.ok) {
      const lista = await resp.json();
      const maior = (Array.isArray(lista) ? lista : [])
        .map((v) => parseFloat(v && v.version))
        .filter((n) => isFinite(n))
        .sort((a, b) => b - a)[0];
      if (maior) versao = maior.toFixed(1);
    }
  } catch (e) {
    console.warn("[INSV] Versão da API não negociada, usando fallback:", limparErro(e));
  }
  _sfVersaoPorHost.set(apiHost, versao);
  return versao;
}

// GET autenticado em /services/data/. `path` já deve vir com a versão.
async function sfFetchJson(apiHost, path) {
  if (!isSalesforceApiHost(apiHost)) throw new Error("host de API inválido");
  assertCaminhoDeApi(path);
  const token = await sfLerToken(apiHost);
  const resp = await fetch(`https://${apiHost}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    // credentials omit: a autenticação é o header. Mandar o cookie junto só
    // ampliaria o alcance da requisição sem necessidade.
    credentials: "omit",
  });
  if (resp.status === 401 || resp.status === 403) {
    throw new Error("sessão expirada ou sem acesso");
  }
  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status}`);
  }
  return resp.json();
}
