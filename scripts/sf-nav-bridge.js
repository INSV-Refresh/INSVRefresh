// Ponte de navegação no mundo da página (content script com "world": "MAIN").
//
// Os toasts vivem no mundo isolado da extensão, que não enxerga o $A do
// Lightning. Sem essa ponte, a única saída para um chamado fora da grid
// visível era window.location.assign — e isso derruba e recarrega o one.app
// inteiro. Aqui disparamos o mesmo evento Aura que a própria grid dispara ao
// ser clicada, então o console abre o chamado como aba de trabalho, sem
// reload. Ver docs: force:navigateToSObject / force:navigateToURL são
// tratados pelo container one.app.
(function () {
  "use strict";

  const REQ_EVENT = "insv:navigate-to-record";
  const RES_EVENT = "insv:navigate-result";

  function responder(reqId, ok, motivo) {
    window.dispatchEvent(
      new CustomEvent(RES_EVENT, { detail: { reqId, ok: !!ok, motivo: motivo || "" } })
    );
  }

  window.addEventListener(REQ_EVENT, (event) => {
    const detail = event.detail || {};
    const reqId = detail.reqId;
    const aura = window.$A;

    // $A só existe dentro do one.app. Setup, Visualforce em iframe e telas
    // pré-Aura não têm — quem pediu cai no fallback de URL.
    if (!aura || typeof aura.get !== "function") {
      responder(reqId, false, "no-aura");
      return;
    }

    try {
      let auraEvent = null;
      // Por recordId é o caminho direto: em app de console, o one.app abre (ou
      // foca, se já estiver aberto) a aba de trabalho do registro.
      if (detail.recordId) {
        auraEvent = aura.get("e.force:navigateToSObject");
        if (auraEvent) auraEvent.setParams({ recordId: detail.recordId });
      }
      // Sem recordId utilizável (URL em outro formato), a navegação por URL
      // relativa também é roteada pelo one.app, sem recarregar a página.
      if (!auraEvent && detail.url) {
        auraEvent = aura.get("e.force:navigateToURL");
        if (auraEvent) auraEvent.setParams({ url: detail.url });
      }
      if (!auraEvent) {
        responder(reqId, false, "no-event");
        return;
      }
      // getCallback põe o fire dentro do ciclo do Aura (fila de eventos +
      // rerender). Disparar cru de fora do framework pode ser descartado.
      const disparar =
        typeof aura.getCallback === "function"
          ? aura.getCallback(() => auraEvent.fire())
          : () => auraEvent.fire();
      disparar();
      responder(reqId, true);
    } catch (e) {
      responder(reqId, false, (e && e.message) || "erro");
    }
  });
})();
