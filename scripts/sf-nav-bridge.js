// Ponte com o Aura no mundo da página (content script com "world": "MAIN").
//
// O resto da extensão roda no mundo isolado, que não enxerga o $A do
// Lightning. Sem essa ponte só sobram gambiarras de DOM: navegar por
// window.location (recarrega o one.app inteiro) e clicar no botão de refresh
// (some do DOM em vários estados do console). Aqui falamos com o container
// one.app pelos eventos que ele mesmo publica.
//
// Protocolo: o mundo isolado dispara "insv:aura-request" com
// {reqId, action, ...} e escuta "insv:aura-result" com {reqId, ok, motivo}.
// Toda ação responde exatamente uma vez; quem pediu usa timeout curto porque
// esta ponte pode simplesmente não existir (Chrome sem suporte a
// "world": "MAIN").
(function () {
  "use strict";

  const REQ_EVENT = "insv:aura-request";
  const RES_EVENT = "insv:aura-result";

  function responder(reqId, ok, motivo) {
    window.dispatchEvent(
      new CustomEvent(RES_EVENT, { detail: { reqId, ok: !!ok, motivo: motivo || "" } })
    );
  }

  // Põe o fire dentro do ciclo do Aura (fila de eventos + rerender). Disparar
  // cru de fora do framework pode ser descartado silenciosamente.
  function dispararNoAura(aura, auraEvent) {
    const fn =
      typeof aura.getCallback === "function"
        ? aura.getCallback(() => auraEvent.fire())
        : () => auraEvent.fire();
    fn();
  }

  // navigateToSObject é o caminho direto pro registro: em app de console, o
  // one.app abre (ou foca, se já estiver aberta) a aba de trabalho dele.
  // Sem recordId utilizável, a URL relativa também é roteada pelo one.app.
  function navegar(aura, detail) {
    let auraEvent = null;
    if (detail.recordId) {
      auraEvent = aura.get("e.force:navigateToSObject");
      if (auraEvent) auraEvent.setParams({ recordId: detail.recordId });
    }
    if (!auraEvent && detail.url) {
      auraEvent = aura.get("e.force:navigateToURL");
      if (auraEvent) auraEvent.setParams({ url: detail.url });
    }
    if (!auraEvent) return "no-event";
    dispararNoAura(aura, auraEvent);
    return "";
  }

  // force:refreshView recarrega os dados dos componentes padrão da view. Só é
  // usado quando o botão de refresh da list view não está no DOM: as docs
  // avisam que o evento custa caro e que disparo repetido não é suportado,
  // então ele é caminho de exceção, não o de todo ciclo.
  function atualizarView(aura) {
    const auraEvent = aura.get("e.force:refreshView");
    if (!auraEvent) return "no-event";
    dispararNoAura(aura, auraEvent);
    return "";
  }

  window.addEventListener(REQ_EVENT, (event) => {
    const detail = event.detail || {};
    const reqId = detail.reqId;
    const aura = window.$A;

    // $A só existe dentro do one.app. Setup, Visualforce em iframe e telas
    // pré-Aura não têm — quem pediu cai no seu próprio fallback.
    if (!aura || typeof aura.get !== "function") {
      responder(reqId, false, "no-aura");
      return;
    }

    try {
      let motivo = "";
      switch (detail.action) {
        case "navigate":
          motivo = navegar(aura, detail);
          break;
        case "refresh":
          motivo = atualizarView(aura);
          break;
        case "ping":
          motivo = "";
          break;
        default:
          motivo = "unknown-action";
      }
      responder(reqId, !motivo, motivo);
    } catch (e) {
      responder(reqId, false, (e && e.message) || "erro");
    }
  });
})();
