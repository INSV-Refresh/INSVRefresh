// Leitura de filas pela UI API, em vez de raspar a tabela renderizada.
//
// A raspagem só enxerga o que está na tela: exige a fila aberta, depende do
// markup do Lightning e lê status como texto de célula. Aqui os mesmos dados
// vêm de list-records, com id de registro e valor de campo de verdade.
// Depende de scripts/sf-session.js (mesmo escopo de service worker).

const SF_CASE_PAGE_SIZE = 200;
const SF_LIST_VIEWS_TTL_MS = 10 * 60 * 1000;

// apiHost -> { ts, porLabel: Map(labelNormalizado -> listView) }
const _sfListViewsCache = new Map();

function sfNormalizarLabel(s) {
  return String(s || "").replace(/\s+/g, " ").trim().toLowerCase();
}

async function sfCarregarListViews(apiHost) {
  const cache = _sfListViewsCache.get(apiHost);
  if (cache && Date.now() - cache.ts < SF_LIST_VIEWS_TTL_MS) return cache.porLabel;

  const versao = await sfVersaoApi(apiHost);
  const dados = await sfFetchJson(apiHost, `/services/data/v${versao}/sobjects/Case/listviews`);
  const porLabel = new Map();
  for (const lv of (dados && dados.listviews) || []) {
    if (!lv || !lv.developerName) continue;
    porLabel.set(sfNormalizarLabel(lv.label), {
      id: lv.id,
      label: lv.label,
      developerName: lv.developerName,
    });
  }
  _sfListViewsCache.set(apiHost, { ts: Date.now(), porLabel });
  return porLabel;
}

// O usuário configura a fila pelo rótulo que vê na tela; a API indexa por nome
// de API. Se o rótulo não bater, tenta o developerName — assim uma fila
// configurada em outro idioma da UI ainda resolve.
async function sfResolverListView(apiHost, label) {
  const porLabel = await sfCarregarListViews(apiHost);
  const alvo = sfNormalizarLabel(label);
  const direto = porLabel.get(alvo);
  if (direto) return direto;
  for (const lv of porLabel.values()) {
    if (sfNormalizarLabel(lv.developerName) === alvo) return lv;
  }
  return null;
}

// UI API devolve campo como {value, displayValue}; displayValue é o que a tela
// mostra (picklist traduzida, por exemplo) e é ele que deve casar com o status
// configurado pelo usuário, com value como reserva.
function sfValorDeCampo(rec, nome) {
  const campo = rec && rec.fields && rec.fields[nome];
  if (!campo) return "";
  const v = campo.displayValue != null ? campo.displayValue : campo.value;
  return v == null ? "" : String(v).trim();
}

// Devolve as linhas da fila no mesmo formato que o resto da extensão usa:
// número do chamado (o que o usuário vê e o que vira toast), id de registro
// (para a navegação nativa) e status.
async function sfLerFila(apiHost, label) {
  const lv = await sfResolverListView(apiHost, label);
  if (!lv) throw new Error("list view não encontrada para esta fila");

  const versao = await sfVersaoApi(apiHost);
  const path =
    `/services/data/v${versao}/ui-api/list-records/Case/${encodeURIComponent(lv.developerName)}` +
    `?pageSize=${SF_CASE_PAGE_SIZE}` +
    `&optionalFields=${encodeURIComponent("Case.CaseNumber,Case.Status")}`;
  const dados = await sfFetchJson(apiHost, path);

  const linhas = [];
  for (const rec of (dados && dados.records) || []) {
    const caseNumber = sfValorDeCampo(rec, "CaseNumber");
    if (!caseNumber) continue; // sem número não há como casar com a UI
    linhas.push({
      caseNumber,
      recordId: rec.id || "",
      status: sfValorDeCampo(rec, "Status"),
    });
  }
  return { linhas, listView: lv };
}
